
import { supabase, isSupabaseConfigured } from './supabase';
import { localStore } from './localStore';
import { OutboxItem, LocalSnapshot } from './dbTypes';
import { openDB } from 'idb'; // DEXIE MIGRATION: Used for one-time migration
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem, ABCAnalysis, InventoryValuationItem
} from '../types';
import { 
  saleInvoiceSchema, 
  purchaseInvoiceSchema, 
  productSchema, 
  customerSchema, 
  supplierSchema 
} from '../utils/validation';

const DB_VERSION = 4.3; 

// دالة مساعدة لتوليد مُعرّف فريد آمن لتجنب تعارض المفاتيح الأساسية (Primary Keys Collision)
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

class Database {
  products: Product[] = [];
  batches: Batch[] = [];
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
  invoices: Invoice[] = [];
  purchaseInvoices: PurchaseInvoice[] = [];
  cashTransactions: CashTransaction[] = [];
  warehouses: Warehouse[] = [];
  representatives: Representative[] = [];
  dailyClosings: DailyClosing[] = [];
  pendingAdjustments: PendingAdjustment[] = [];
  purchaseOrders: PurchaseOrder[] = [];
  settings: any = { companyName: 'Mizan Online', currency: 'LE', expenseCategories: [], lowStockThreshold: 10 };

  isFullyLoaded: boolean = false;
  public activeOperations: number = 0;
  public lastSyncError: string | null = null;
  private syncListeners: ((isBusy: boolean, error: string | null) => void)[] = [];
  private saveTimeout: any = null;
  private isSyncingToCloud = false;

  constructor() {}

  onSyncStateChange(callback: (isBusy: boolean, error: string | null) => void) {
    this.syncListeners.push(callback);
    return () => { this.syncListeners = this.syncListeners.filter(l => l !== callback); };
  }

  private notifySyncState() {
    this.syncListeners.forEach(l => l(this.activeOperations > 0, this.lastSyncError));
  }

  generateDocNumber(prefix: string, collection?: any[]): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const docNumber = `${prefix}-${timestamp}-${random}`;
    
    if (collection && collection.some((item: any) => item.invoice_number === docNumber || item.ref_number === docNumber || item.order_number === docNumber || item.code === docNumber)) {
        return this.generateDocNumber(prefix, collection);
    }
    return docNumber;
  }

  async init(onProgress?: (msg: string) => void) {
    if (onProgress) onProgress("جاري تهيئة قاعدة البيانات...");
    await localStore.init(); 

    await this.migrateFromOldIdb(onProgress);

    if (onProgress) onProgress("جاري تحميل البيانات المحلية...");
    await this.loadFromLocalStore();

    // وضع علامة التحميل المبدئي للسماح للتطبيق بالعمل فوراً
    this.isFullyLoaded = true;

    if (!isSupabaseConfigured) {
      console.warn("Supabase is not configured. Running in local mode.");
      return;
    }

    // محاولة المزامنة من السحابة عند البداية (Pull)
    // نتحقق من آخر وقت مزامنة لتجنب التكرار المفرط
    const lastSync = this.settings.last_sync_time;
    const now = Date.now();
    const syncInterval = 5 * 60 * 1000; // 5 دقائق

    if (!lastSync || (now - new Date(lastSync).getTime() > syncInterval)) {
      try {
        if (onProgress) onProgress("جاري مزامنة البيانات من السحابة...");
        await this.syncFromCloud(onProgress);
      } catch (err) {
        console.error("Initial sync from cloud failed:", err);
        if (onProgress) onProgress("فشلت المزامنة السحابية، العمل بالوضع المحلي.");
      }
    }

    // تشغيل المزامنة إلى السحابة في الخلفية (Push)
    this.syncToCloud().catch(err => {
      console.error("Background sync to cloud failed:", err);
    });

    this.recalculateAllBalances();
  }

  private async migrateFromOldIdb(onProgress?: (msg: string) => void) {
    const OLD_DB_NAME = 'mizan_db_v4';
    const MIGRATION_KEY = 'mizan_dexie_migrated';
    
    if (localStorage.getItem(MIGRATION_KEY)) return;

    try {
      const oldDb = await openDB(OLD_DB_NAME, 1).catch(() => null);
      if (!oldDb || oldDb.objectStoreNames.length === 0) {
        if(oldDb) oldDb.close();
        localStorage.setItem(MIGRATION_KEY, 'true');
        return;
      }

      if (onProgress) onProgress("جاري ترقية قاعدة البيانات إلى Dexie...");
      
      const tables = [
        'products', 'batches', 'customers', 'suppliers', 'invoices',
        'purchaseInvoices', 'cashTransactions', 'warehouses', 'representatives',
        'dailyClosings', 'pendingAdjustments', 'purchaseOrders', 'outbox'
      ];

      const migrationData: any = {};
      for (const table of tables) {
        if (oldDb.objectStoreNames.contains(table)) {
          migrationData[table] = await oldDb.getAll(table);
        }
      }

      if (oldDb.objectStoreNames.contains('settings')) {
        migrationData.settings = await oldDb.get('settings', 'main');
      }

      if (Object.keys(migrationData).length > 0) {
        await localStore.saveAll(migrationData);
        console.log("Migration to Dexie completed successfully.");
      }

      oldDb.close();
      localStorage.setItem(MIGRATION_KEY, 'true');
    } catch (err) {
      console.error("Migration to Dexie failed:", err);
    }
  }

  async syncToCloud() {
    if (!isSupabaseConfigured) return;
    if (this.isSyncingToCloud) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn("Offline: Sync postponed.");
        return;
    }

    const outbox = await localStore.getOutbox();
    const now = new Date().getTime();
    const pendingItems = outbox.filter(item => {
      if (item.status === 'sent' || item.status === 'permanently_failed' || item.status === 'in_progress') return false;
      
      // If it failed before, check backoff
      if (item.status === 'failed' && item.updatedAt) {
        const lastAttempt = new Date(item.updatedAt).getTime();
        const delay = localStore.calculateBackoff(item.attempts);
        if (now - lastAttempt < delay) return false;
      }
      
      return true;
    });
    if (pendingItems.length === 0) return;

    this.isSyncingToCloud = true;
    this.activeOperations++;
    this.lastSyncError = null;
    this.notifySyncState();

    const MAX_ATTEMPTS = 5;

    // دالة لتنظيف الـ payload قبل الإرسال لـ Supabase
    const cleanPayloadForSupabase = (entityType: string, payload: any) => {
      // الحقول العامة التي يجب إزالتها من كل الجداول
      const { sync_status, sync_error, ...baseClean } = payload;
      
      switch (entityType) {
        case 'invoices': {
          const { commission_value, ...rest } = baseClean;
          return rest;
        }
        case 'warehouses': {
          // إذا كان هناك حقول إضافية في النوع المحلي غير موجودة في السحابة
          return baseClean;
        }
        case 'customers': {
          // التأكد من الحقول الأساسية فقط
          return {
            id: baseClean.id,
            code: baseClean.code,
            name: baseClean.name,
            phone: baseClean.phone ?? null,
            area: baseClean.area ?? null,
            address: baseClean.address ?? null,
            distribution_line: baseClean.distribution_line ?? null,
            opening_balance: baseClean.opening_balance ?? 0,
            current_balance: baseClean.current_balance ?? 0,
            credit_limit: baseClean.credit_limit ?? 0,
            representative_code: baseClean.representative_code ?? null,
            default_discount_percent: baseClean.default_discount_percent ?? 0,
            price_segment: baseClean.price_segment ?? 'retail',
            created_at: baseClean.created_at,
            updated_at: baseClean.updated_at ?? new Date().toISOString(),
            version: baseClean.version ?? 1,
            status: baseClean.status ?? 'ACTIVE'
          };
        }
        default:
          return baseClean;
      }
    };

    try {
      const processItem = async (item: OutboxItem) => {
        const { entityType, operation, payload, id, attempts } = item;
        if (id === undefined) return;
        let success = false;

        // Update status to in_progress
        await localStore.updateOutboxItem(id, { status: 'in_progress' });

        try {
          if (operation === 'insert' || operation === 'update') {
            const table = this.mapEntityTypeToTable(entityType);
            const finalPayload = cleanPayloadForSupabase(entityType, payload);
            
            const { error } = await supabase.from(table).upsert(finalPayload, {
              onConflict: 'id',
              ignoreDuplicates: false 
            });
            
            if (!error) {
              success = true;
              this.updateLocalSyncStatus(entityType, payload.id, 'Synced');
            } else {
              // معالجة أخطاء محددة
              if (error.code === '23505') {
                // تعارض مفتاح فريد - محاولة التحديث
                const { error: updateError } = await supabase.from(table)
                  .update(finalPayload)
                  .eq('id', payload.id);
                  
                if (!updateError) {
                  success = true;
                  this.updateLocalSyncStatus(entityType, payload.id, 'Synced');
                } else {
                  throw updateError;
                }
              } else if (error.code === '23503') {
                // خطأ Foreign Key - قد يكون بسبب ترتيب العمليات، نعتبره نجاحاً مؤقتاً أو نتجاهله إذا كان المنتج موجوداً
                console.warn(`Foreign key conflict for ${entityType}: ${payload.id}`);
                success = true; 
                this.updateLocalSyncStatus(entityType, payload.id, 'Synced');
              } else {
                throw error;
              }
            }
          } else if (operation === 'delete') {
            const { error } = await supabase.from(this.mapEntityTypeToTable(entityType)).delete().eq('id', payload.id);
            if (!error) success = true;
            else throw error;
          }

          if (success) {
            await localStore.markOutboxAsSent(id);
          }
        } catch (err: any) {
          const newAttempts = (attempts || 0) + 1;
          const errorMsg = err.message || String(err);
          const MAX_ATTEMPTS = 5;
          
          if (newAttempts >= MAX_ATTEMPTS) {
            await localStore.updateOutboxItem(id, {
              attempts: newAttempts,
              lastError: errorMsg,
              status: 'permanently_failed'
            });
            await localStore.logError({
              entityType,
              operation,
              payloadId: payload.id || 'N/A',
              error: err,
              metadata: { attempts: newAttempts }
            });
          } else {
            await localStore.updateOutboxItem(id, {
              attempts: newAttempts,
              lastError: errorMsg,
              status: 'failed'
            });
          }
          throw err;
        }
      };

      // تجميع العمليات حسب الجدول (entityType)
      const groups = pendingItems.reduce((acc, item) => {
        if (!acc[item.entityType]) acc[item.entityType] = [];
        acc[item.entityType].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      // معالجة عناصر نفس الجدول بالتسلسل للحفاظ على ترتيب العمليات
      const processGroupSequentially = async (entityType: string) => {
        const items = groups[entityType];
        if (!items) return;
        for (const item of items) {
          try {
            await processItem(item);
          } catch (e) {
            // نتوقف عن معالجة هذه المجموعة في حال فشل عنصر واحد (لأن العمليات التالية قد تعتمد عليه)
            break;
          }
        }
      };

      const independentTables = Object.keys(groups).filter(
        t => !['invoices', 'customers', 'products', 'batches', 'cashTransactions'].includes(t)
      );

      // إرسال الجداول المستقلة بالتزامن مع الحفاظ على الترتيب الإجباري
      await Promise.all([
        (async () => {
          await processGroupSequentially('invoices');
          await processGroupSequentially('customers');
          await processGroupSequentially('cashTransactions');
        })(),
        (async () => {
          await processGroupSequentially('products');
          await processGroupSequentially('batches');
        })(),
        ...independentTables.map(t => processGroupSequentially(t))
      ]);

      if (pendingItems.some(i => i.operation === 'insert' || i.operation === 'update')) {
        await this.saveToLocalStore();
      }

    } finally {
      this.isSyncingToCloud = false;
      this.activeOperations--;
      this.notifySyncState();
    }
  }

  private mapEntityTypeToTable(type: string): string {
    const map: any = {
      'products': 'products',
      'batches': 'batches',
      'customers': 'customers',
      'suppliers': 'suppliers',
      'invoices': 'invoices',
      'purchaseInvoices': 'purchase_invoices',
      'cashTransactions': 'cash_transactions',
      'warehouses': 'warehouses',
      'representatives': 'representatives',
      'dailyClosings': 'daily_closings',
      'pendingAdjustments': 'pending_adjustments',
      'purchaseOrders': 'purchase_orders',
      'settings': 'settings'
    };
    return map[type] || type;
  }

  private updateLocalSyncStatus(entityType: string, id: string, status: 'Pending' | 'Synced' | 'Error', errorMsg?: string) {
    const arr = (this as any)[entityType];
    if (arr && Array.isArray(arr)) {
      const item = arr.find((x: any) => x.id === id);
      if (item) {
        item.sync_status = status;
        item.sync_error = errorMsg;
      }
    }
  }

  async addToOutbox(entityType: string, operation: 'insert' | 'update' | 'delete', payload: any, options?: { noSync?: boolean }) {
    if (operation === 'insert' || operation === 'update') {
      this.updateLocalSyncStatus(entityType, payload.id, 'Pending');
    }
    
    // Strip sync_status and sync_error before saving to outbox
    const { sync_status, sync_error, ...cleanPayload } = payload;
    
    await localStore.addToOutbox({
      entityType,
      entityId: payload.id,
      operation,
      payload: cleanPayload
    });

    if (!options?.noSync) {
      this.syncToCloud().catch(err => {
        console.warn("Background sync failed (expected if offline):", err.message);
      });
    }
  }

  async syncFromCloud(onProgress?: (msg: string) => void) {
    if (!isSupabaseConfigured) return;
    
    this.activeOperations++;
    this.lastSyncError = null;
    this.notifySyncState();
    
    try {
      const tables = [
        { name: 'warehouses', prop: 'warehouses', label: 'المخازن' },
        { name: 'products', prop: 'products', label: 'المنتجات' },
        { name: 'batches', prop: 'batches', label: 'التشغيلات' },
        { name: 'customers', prop: 'customers', label: 'العملاء' },
        { name: 'suppliers', prop: 'suppliers', label: 'الموردين' },
        { name: 'representatives', prop: 'representatives', label: 'المناديب' },
        { name: 'invoices', prop: 'invoices', label: 'الفواتير' },
        { name: 'purchase_invoices', prop: 'purchaseInvoices', label: 'فواتير الشراء' },
        { name: 'cash_transactions', prop: 'cashTransactions', label: 'الخزينة' },
        { name: 'purchase_orders', prop: 'purchaseOrders', label: 'طلبات الشراء' },
        { name: 'daily_closings', prop: 'dailyClosings', label: 'الإغلاق اليومي' },
        { name: 'pending_adjustments', prop: 'pendingAdjustments', label: 'التسويات' }
      ];

      // معالجة الجداول بالتسلسل أو بمحدودية توازي لتجنب الضغط
      for (const table of tables) {
        if (onProgress) onProgress(`جاري جلب ${table.label}...`);
        const cloudData = await this.fetchAllFromTable(table.name);
        
        // Merge logic: Last Write Wins
        const localData = (this as any)[table.prop] || [];
        const mergedData = [...localData];
        
        for (const cloudItem of cloudData) {
          const localIndex = mergedData.findIndex((item: any) => item.id === cloudItem.id);
          if (localIndex === -1) {
            mergedData.push({ ...cloudItem, sync_status: 'Synced' });
          } else {
            const localItem = mergedData[localIndex];
            const localUpdated = new Date(localItem.updated_at || 0).getTime();
            const cloudUpdated = new Date(cloudItem.updated_at || 0).getTime();
            
            if (cloudUpdated > localUpdated) {
              mergedData[localIndex] = { ...cloudItem, sync_status: 'Synced' };
            }
          }
        }
        (this as any)[table.prop] = mergedData;
      }

      if (onProgress) onProgress("جاري جلب الإعدادات...");
      const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').single();
      if (!settingsError && settingsData) {
        this.settings = { ...this.settings, ...settingsData };
      }

      // تحديث وقت المزامنة
      this.settings.last_sync_time = new Date().toISOString();

      await this.saveToLocalStore(true);
      if (onProgress) onProgress("تمت المزامنة بنجاح");
    } catch (err: any) {
      console.error("Cloud sync failed:", err);
      this.lastSyncError = `فشل جلب البيانات من السحابة: ${err.message}`;
      if (onProgress) onProgress("فشلت المزامنة، جاري العمل بالوضع المحلي");
    } finally {
      this.activeOperations--;
      this.notifySyncState();
    }
  }

  /**
   * جلب كافة السجلات من جدول معين باستخدام Pagination (range) لتجاوز حد الـ 1000 صف في Supabase.
   * يدعم التحكم في حجم الدفعة والحد الأقصى للسجلات.
   */
  async fetchAllFromTable(table: string, options: { batchSize?: number; maxRecords?: number } = {}) {
    if (!isSupabaseConfigured) return [];
    
    const pageSize = options.batchSize || 1000;
    const maxRecords = options.maxRecords || 50000; // حد أمان افتراضي
    
    try {
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore && allData.length < maxRecords) {
            let retryCount = 0;
            const maxRetries = 3;
            let pageData: any[] | null = null;

            // محاولة جلب الصفحة مع إعادة المحاولة في حال الفشل
            while (retryCount <= maxRetries) {
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .range(from, from + pageSize - 1)
                    .order('id', { ascending: true }); // ترتيب ثابت لضمان عدم تكرار البيانات
                
                if (error) {
                    console.warn(`Retry ${retryCount} for table ${table} at offset ${from}:`, error.message);
                    if (retryCount < maxRetries) {
                        retryCount++;
                        await new Promise(r => setTimeout(r, 1000 * retryCount));
                        continue;
                    }
                    throw error;
                }
                pageData = data;
                break;
            }

            if (pageData && pageData.length > 0) {
                allData = [...allData, ...pageData];
                
                // إذا كان عدد السجلات أقل من حجم الصفحة، فهذا يعني أننا وصلنا للنهاية
                if (pageData.length < pageSize) {
                    hasMore = false;
                } else {
                    from += pageSize;
                }
            } else {
                hasMore = false;
            }
        }
        return allData;
    } catch (err) { 
        console.error(`Error fetching all from ${table}:`, err);
        return []; 
    }
  }

  async fetchLatestPricesMap() {
    if (!isSupabaseConfigured) return new Map();
    try {
        const { data, error } = await supabase.rpc('get_latest_batch_prices');
        if (error) return new Map();
        const priceMap = new Map();
        if (data) data.forEach((item: any) => priceMap.set(item.product_id, { purchase: item.latest_purchase_price, selling: item.latest_selling_price }));
        return priceMap;
    } catch (err) { return new Map(); }
  }

  async loadFromLocalStore() {
    const data = await localStore.loadAll();
    if (data) {
      const tables = [
        'products', 'batches', 'customers', 'suppliers', 'invoices',
        'purchaseInvoices', 'cashTransactions', 'warehouses', 'representatives',
        'dailyClosings', 'pendingAdjustments', 'purchaseOrders'
      ];
      tables.forEach(table => {
        const key = table as keyof LocalSnapshot;
        if (data[key]) (this as any)[table] = data[key];
      });
      if (data.settings) this.settings = { ...this.settings, ...data.settings };
    }
  }

  async saveToLocalStore(force: boolean = false) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    const perform = async () => {
      const pkg: Partial<LocalSnapshot> = {
        products: this.products, 
        batches: this.batches, 
        customers: this.customers,
        invoices: this.invoices, 
        suppliers: this.suppliers, 
        cashTransactions: this.cashTransactions,
        warehouses: this.warehouses, 
        representatives: this.representatives, 
        dailyClosings: this.dailyClosings,
        pendingAdjustments: this.pendingAdjustments, 
        purchaseOrders: this.purchaseOrders,
        purchaseInvoices: this.purchaseInvoices, 
        settings: this.settings
      };
      await localStore.saveAll(pkg);
    };
    if (force) await perform(); else this.saveTimeout = setTimeout(perform, 300);
  }

  loadFromLocalCache() { this.loadFromLocalStore(); }
  saveToLocalCache(force: boolean = false) { this.saveToLocalStore(force); }

  getSettings() { return this.settings; }
  getInvoices() { return this.invoices.filter(i => i.status !== 'DELETED'); }
  getCustomers() { return this.customers.filter(c => c.status !== 'INACTIVE'); }
  getSuppliers() { return this.suppliers.filter(s => s.status !== 'INACTIVE'); }
  getWarehouses() { return this.warehouses; }
  getRepresentatives() { return this.representatives; }
  getPurchaseInvoices() { return this.purchaseInvoices.filter(p => p.status !== 'CANCELLED'); }
  getCashTransactions() { return this.cashTransactions.filter(t => t.status !== 'DELETED'); }
  getDailyClosings() { return this.dailyClosings; }
  getPurchaseOrders() { return this.purchaseOrders; }
  getPendingAdjustments() { return this.pendingAdjustments.filter(a => a.adj_status === 'PENDING'); }
  getAllProducts() { return this.products; }
  
  getProductsWithBatches(): ProductWithBatches[] {
      return this.products.filter(p => p.status !== 'INACTIVE').map(p => ({ ...p, batches: this.batches.filter(b => b.product_id === p.id) }));
  }

  getCashBalance() {
    return this.cashTransactions.filter(t => t.status !== 'CANCELLED' && t.status !== 'DELETED').reduce((s, t) => s + (t.type === CashTransactionType.RECEIPT ? t.amount : -t.amount), 0);
  }

  getInvoicePaidAmount(invoiceId: string): number {
    return this.cashTransactions.filter(t => t.reference_id === invoiceId && t.status !== 'CANCELLED').reduce((s, t) => s + (t.type === CashTransactionType.RECEIPT ? t.amount : -t.amount), 0);
  }

  // --- Actions ---
  async createInvoice(customerId: string, items: CartItem[], cashPayment: number, isReturn: boolean, addDisc: number, createdBy?: any, commission: number = 0, cashDiscPercent: number = 0, manualPrevBalance?: number): Promise<{ success: boolean; id: string; message?: string }> {
    // التحقق من صحة البيانات
    const validation = saleInvoiceSchema.safeParse({ customerId, items, cashPayment });
    if (!validation.success) {
      return { success: false, id: '', message: validation.error.issues[0].message };
    }

    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return { success: false, id: '', message: 'العميل غير موجود' };
    
    const total_before = items.reduce((s, it) => s + (it.quantity * (it.unit_price || it.batch?.selling_price || it.product.selling_price || 0)), 0);
    const total_disc = items.reduce((s, it) => s + (it.quantity * (it.unit_price || 0) * (it.discount_percentage / 100)), 0);
    const netAfterAdd = Math.max(0, total_before - total_disc - addDisc);
    const cashDiscValue = netAfterAdd * (cashDiscPercent / 100);
    const net = Math.max(0, netAfterAdd - cashDiscValue);
    
    const prevBalance = manualPrevBalance !== undefined ? manualPrevBalance : customer.current_balance;
    const invoiceId = generateId(); // استخدام المعرف الآمن
    
    // حساب الرصيد النهائي بعد الفاتورة والتحصيل
    const finalBalanceAfterInvoice = isReturn ? prevBalance - net : prevBalance + net;
    const finalBalanceAfterPayment = finalBalanceAfterInvoice - (isReturn ? -cashPayment : cashPayment);

    const invoice: Invoice = {
        id: invoiceId, 
        invoice_number: this.generateDocNumber('INV', this.invoices),
        customer_id: customerId, 
        date: new Date().toISOString(), 
        total_before_discount: total_before,
        total_discount: total_disc, 
        additional_discount: addDisc, 
        cash_discount_percent: cashDiscPercent, 
        cash_discount_value: cashDiscValue,
        net_total: net,
        previous_balance: prevBalance, 
        final_balance: finalBalanceAfterPayment,
        payment_status: cashPayment >= net ? PaymentStatus.PAID : (cashPayment > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID), 
        items, 
        type: isReturn ? 'RETURN' : 'SALE', 
        created_by: createdBy?.id, 
        created_by_name: createdBy?.name, 
        commission_value: commission,
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString(), 
        version: 1, 
        status: 'ACTIVE'
    };

    // 1. تسجيل الفاتورة في Outbox أولاً
    this.invoices.push(invoice);
    await this.addToOutbox('invoices', 'insert', invoice, { noSync: true });

    // 2. تحديث العميل
    customer.current_balance = finalBalanceAfterPayment;
    await this.addToOutbox('customers', 'update', customer, { noSync: true });
    
    // 3. إضافة معاملة مالية إن وجدت
    if (cashPayment > 0) {
        await this.addCashTransaction({ 
            type: isReturn ? 'EXPENSE' : 'RECEIPT', 
            category: 'CUSTOMER_PAYMENT', 
            reference_id: invoice.id, 
            related_name: customer.name, 
            amount: cashPayment, 
            notes: `سداد فاتورة #${invoice.invoice_number}`, 
            date: invoice.date 
        }, { noSync: true });
    }

    // 4. تحديث المخزون (التشغيلات)
    for (const item of items) {
        if (item.batch) {
            const batchIdx = this.batches.findIndex(b => b.id === item.batch?.id);
            if (batchIdx !== -1) {
                const change = item.quantity + (item.bonus_quantity || 0);
                // في البيع نطرح، في المرتجع نضيف
                if (isReturn) {
                    this.batches[batchIdx].quantity += change;
                } else {
                    this.batches[batchIdx].quantity -= change;
                }
                this.batches[batchIdx].updated_at = new Date().toISOString();
                await this.addToOutbox('batches', 'update', this.batches[batchIdx], { noSync: true });
            }
        }
    }
    
    await this.saveToLocalStore(); 
    this.syncToCloud().catch(console.error);
    return { success: true, id: invoiceId };
  }

  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPayment: number, cashDiscPercent: number = 0, manualPrevBalance?: number): Promise<{ success: boolean; id: string; message?: string }> {
    const idx = this.invoices.findIndex(inv => inv.id === id);
    if (idx === -1) return { success: false, id: '', message: 'الفاتورة غير موجودة' };
    const oldInv = this.invoices[idx];
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return { success: false, id: '', message: 'العميل غير موجود' };
    
    const total_before = items.reduce((s, it) => s + (it.quantity * (it.unit_price || it.batch?.selling_price || it.product.selling_price || 0)), 0);
    const total_disc = items.reduce((s, it) => s + (it.quantity * (it.unit_price || 0) * (it.discount_percentage / 100)), 0);
    const netAfterAdd = Math.max(0, total_before - total_disc - (oldInv.additional_discount || 0));
    const cashDiscValue = netAfterAdd * (cashDiscPercent / 100);
    const net = Math.max(0, netAfterAdd - cashDiscValue);
    
    const prevBalance = manualPrevBalance !== undefined ? manualPrevBalance : oldInv.previous_balance;
    const isReturn = oldInv.type === 'RETURN';

    // عكس تأثير الفاتورة والتحصيل القديم
    const oldCashTxs = this.cashTransactions.filter(t => t.reference_id === id);
    const oldCashPaid = oldCashTxs.reduce((s, t) => s + t.amount, 0);
    
    if (oldInv.type === 'SALE') {
        customer.current_balance -= (oldInv.net_total - oldCashPaid);
    } else {
        customer.current_balance += (oldInv.net_total - oldCashPaid);
    }

    // حذف المعاملات المالية القديمة
    for (const tx of oldCashTxs) {
        this.cashTransactions = this.cashTransactions.filter(t => t.id !== tx.id);
        await this.addToOutbox('cashTransactions', 'delete', { id: tx.id });
    }
    
    // تطبيق التأثير الجديد
    const newNetBalance = isReturn ? -net : net;
    customer.current_balance += (newNetBalance - (isReturn ? -cashPayment : cashPayment));

    // إضافة المعاملة المالية الجديدة إذا وجدت
    if (cashPayment > 0) {
        await this.addCashTransaction({ 
            type: isReturn ? 'EXPENSE' : 'RECEIPT', 
            category: 'CUSTOMER_PAYMENT', 
            reference_id: id, 
            related_name: customer.name, 
            amount: cashPayment, 
            notes: `تعديل سداد فاتورة #${oldInv.invoice_number}`, 
            date: new Date().toISOString() 
        });
    }
    
    // عكس تأثير المخزون القديم
    for (const item of oldInv.items) {
        if (item.batch) {
            const batchIdx = this.batches.findIndex(b => b.id === item.batch?.id);
            if (batchIdx !== -1) {
                const change = item.quantity + (item.bonus_quantity || 0);
                if (oldInv.type === 'SALE') this.batches[batchIdx].quantity += change;
                else this.batches[batchIdx].quantity -= change;
                await this.addToOutbox('batches', 'update', this.batches[batchIdx]);
            }
        }
    }

    // تطبيق تأثير المخزون الجديد
    for (const item of items) {
        if (item.batch) {
            const batchIdx = this.batches.findIndex(b => b.id === item.batch?.id);
            if (batchIdx !== -1) {
                const change = item.quantity + (item.bonus_quantity || 0);
                if (oldInv.type === 'SALE') this.batches[batchIdx].quantity -= change;
                else this.batches[batchIdx].quantity += change;
                await this.addToOutbox('batches', 'update', this.batches[batchIdx]);
            }
        }
    }

    Object.assign(this.invoices[idx], { 
      customer_id: customerId, 
      items, 
      net_total: net, 
      total_before_discount: total_before, 
      total_discount: total_disc,
      cash_discount_percent: cashDiscPercent,
      cash_discount_value: cashDiscValue,
      previous_balance: prevBalance,
      updated_at: new Date().toISOString(), 
      version: oldInv.version + 1 
    });
    
    await this.addToOutbox('invoices', 'update', this.invoices[idx]);
    await this.addToOutbox('customers', 'update', customer);

    await this.saveToLocalStore(); return { success: true, id };
  }

  async deleteInvoice(id: string): Promise<{ success: boolean; message?: string }> {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return { success: false, message: 'الفاتورة غير موجودة' };
    const customer = this.customers.find(c => c.id === inv.customer_id);
    
    // عكس تأثير المعاملات المالية المرتبطة
    const relatedTxs = this.cashTransactions.filter(t => t.reference_id === id);
    const totalCash = relatedTxs.reduce((s, t) => s + t.amount, 0);

    if (customer) { 
      if (inv.type === 'SALE') {
          customer.current_balance -= (inv.net_total - totalCash);
      } else {
          customer.current_balance += (inv.net_total - totalCash);
      }
      await this.addToOutbox('customers', 'update', customer);
    }

    // حذف المعاملات المالية
    for (const tx of relatedTxs) {
        this.cashTransactions = this.cashTransactions.filter(t => t.id !== tx.id);
        await this.addToOutbox('cashTransactions', 'delete', { id: tx.id });
    }

    // عكس تأثير المخزون
    for (const item of inv.items) {
        if (item.batch) {
            const batchIdx = this.batches.findIndex(b => b.id === item.batch?.id);
            if (batchIdx !== -1) {
                const change = item.quantity + (item.bonus_quantity || 0);
                if (inv.type === 'SALE') this.batches[batchIdx].quantity += change;
                else this.batches[batchIdx].quantity -= change;
                this.batches[batchIdx].updated_at = new Date().toISOString();
                await this.addToOutbox('batches', 'update', this.batches[batchIdx]);
            }
        }
    }

    this.invoices = this.invoices.filter(i => i.id !== id);
    await this.addToOutbox('invoices', 'delete', { id });
    await this.saveToLocalStore(); return { success: true };
  }

  async addCashTransaction(data: any, options?: { noSync?: boolean }) {
      const tx: CashTransaction = { id: generateId(), ref_number: this.generateDocNumber('TX', this.cashTransactions), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.cashTransactions.push(tx); 
      await this.addToOutbox('cashTransactions', 'insert', tx, options);
      await this.saveToLocalStore(); return { success: true };
  }

  async addManualCashTransaction(data: any) {
      const res = await this.addCashTransaction(data);
      if (res.success) {
          const tx = this.cashTransactions[this.cashTransactions.length - 1];
          if (tx.category === 'CUSTOMER_PAYMENT' && tx.reference_id) {
              const customer = this.customers.find(c => c.id === tx.reference_id);
              if (customer) {
                  customer.current_balance -= (tx.type === 'RECEIPT' ? tx.amount : -tx.amount);
                  await this.addToOutbox('customers', 'update', customer);
              }
          } else if (tx.category === 'SUPPLIER_PAYMENT' && tx.reference_id) {
              const supplier = this.suppliers.find(s => s.id === tx.reference_id);
              if (supplier) {
                  supplier.current_balance -= (tx.type === 'EXPENSE' ? tx.amount : -tx.amount);
                  await this.addToOutbox('suppliers', 'update', supplier);
              }
          }
          await this.saveToLocalStore();
      }
      return res;
  }

  async deleteCashTransaction(id: string): Promise<{ success: boolean; message?: string }> {
    const tx = this.cashTransactions.find(t => t.id === id);
    if (!tx) return { success: false, message: 'المعاملة غير موجودة' };

    // Reverse balance effect if it's a customer/supplier payment
    if (tx.category === 'CUSTOMER_PAYMENT' && tx.reference_id) {
        let customer = this.customers.find(c => c.id === tx.reference_id);
        if (!customer) {
            const inv = this.invoices.find(i => i.id === tx.reference_id);
            if (inv) customer = this.customers.find(c => c.id === inv.customer_id);
        }
        if (customer) {
            customer.current_balance += (tx.type === 'RECEIPT' ? tx.amount : -tx.amount);
            await this.addToOutbox('customers', 'update', customer);
        }
    } else if (tx.category === 'SUPPLIER_PAYMENT' && tx.reference_id) {
        let supplier = this.suppliers.find(s => s.id === tx.reference_id);
        if (!supplier) {
            const pinv = this.purchaseInvoices.find(i => i.id === tx.reference_id);
            if (pinv) supplier = this.suppliers.find(s => s.id === pinv.supplier_id);
        }
        if (supplier) {
            supplier.current_balance += (tx.type === 'EXPENSE' ? tx.amount : -tx.amount);
            await this.addToOutbox('suppliers', 'update', supplier);
        }
    }

    this.cashTransactions = this.cashTransactions.filter(t => t.id !== id);
    await this.addToOutbox('cashTransactions', 'delete', { id });
    await this.saveToLocalStore();
    return { success: true };
  }

  async recordInvoicePayment(invoiceId: string, amount: number): Promise<{ success: boolean; message?: string }> {
      const inv = this.invoices.find(i => i.id === invoiceId);
      if (!inv) return { success: false, message: 'الفاتورة غير موجودة' };
      const customer = this.customers.find(c => c.id === inv.customer_id);
      if (!customer) return { success: false, message: 'العميل غير موجود' };
      await this.addCashTransaction({ type: inv.type === 'SALE' ? 'RECEIPT' : 'EXPENSE', category: 'CUSTOMER_PAYMENT', reference_id: inv.id, related_name: customer.name, amount, notes: `سداد فاتورة #${inv.invoice_number}`, date: new Date().toISOString() });
      customer.current_balance -= (inv.type === 'SALE' ? amount : -amount);
      
      await this.addToOutbox('customers', 'update', customer);
      await this.saveToLocalStore(); return { success: true };
  }

  async addProduct(pData: any, bData: any) {
      const validation = productSchema.safeParse(pData);
      if (!validation.success) {
        return { success: false, message: validation.error.issues[0].message };
      }
      const p: Product = { id: generateId(), ...pData, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.products.push(p); 
      await this.addToOutbox('products', 'insert', p);
      if (bData.quantity > 0) {
        const b: Batch = { id: generateId(), product_id: p.id, ...bData, batch_status: BatchStatus.ACTIVE, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
        this.batches.push(b);
        await this.addToOutbox('batches', 'insert', b);
      }
      await this.saveToLocalStore(); return { success: true, id: p.id };
  }

  async updateProduct(id: string, data: any) {
      const idx = this.products.findIndex(x => x.id === id); 
      if (idx !== -1) { 
        Object.assign(this.products[idx], { ...data, updated_at: new Date().toISOString() }); 
        await this.addToOutbox('products', 'update', this.products[idx]);
        await this.saveToLocalStore(); return { success: true }; 
      } 
      return { success: false };
  }

  async deleteProduct(id: string) { 
    this.products = this.products.filter(p => p.id !== id); 
    await this.addToOutbox('products', 'delete', { id });
    await this.saveToLocalStore(); return { success: true }; 
  }
  async addCustomer(data: any) { 
    const validation = customerSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues[0].message };
    }
    const c: Customer = { id: generateId(), ...data, current_balance: data.opening_balance || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
    this.customers.push(c); 
    await this.addToOutbox('customers', 'insert', c);
    await this.saveToLocalStore(); return { success: true }; 
  }
  async updateCustomer(id: string, data: any) { 
    const idx = this.customers.findIndex(c => c.id === id); 
    if (idx !== -1) { 
      Object.assign(this.customers[idx], data); 
      await this.addToOutbox('customers', 'update', this.customers[idx]);
      await this.saveToLocalStore(); return { success: true }; 
    } 
    return { success: false }; 
  }
  async deleteCustomer(id: string) { 
    this.customers = this.customers.filter(c => c.id !== id); 
    await this.addToOutbox('customers', 'delete', { id });
    await this.saveToLocalStore(); return { success: true }; 
  }
  async addSupplier(data: any) { 
    const validation = supplierSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, message: validation.error.issues[0].message };
    }
    const s: Supplier = { id: generateId(), ...data, current_balance: data.opening_balance || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
    this.suppliers.push(s); 
    await this.addToOutbox('suppliers', 'insert', s);
    await this.saveToLocalStore(); return { success: true }; 
  }
  async updateSupplier(id: string, data: any) { 
    const idx = this.suppliers.findIndex(s => s.id === id); 
    if (idx !== -1) { 
      Object.assign(this.suppliers[idx], data); 
      await this.addToOutbox('suppliers', 'update', this.suppliers[idx]);
      await this.saveToLocalStore(); return { success: true }; 
    } 
    return { success: false }; 
  }
  async deleteSupplier(id: string) { 
    this.suppliers = this.suppliers.filter(s => s.id !== id); 
    await this.addToOutbox('suppliers', 'delete', { id });
    await this.saveToLocalStore(); return { success: true }; 
  }
  async addWarehouse(name: string) { 
    const w: Warehouse = { id: generateId(), name, is_default: this.warehouses.length === 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
    this.warehouses.push(w); 
    await this.addToOutbox('warehouses', 'insert', w);
    await this.saveToLocalStore(); return { success: true }; 
  }
  async updateWarehouse(id: string, name: string) { 
    const idx = this.warehouses.findIndex(w => w.id === id); 
    if (idx !== -1) { 
      this.warehouses[idx].name = name; 
      await this.addToOutbox('warehouses', 'update', this.warehouses[idx]);
      await this.saveToLocalStore(); return { success: true }; 
    } 
    return { success: false }; 
  }
  async deleteWarehouse(id: string): Promise<{ success: boolean; message?: string }> { 
    const warehouse = this.warehouses.find(w => w.id === id);
    if (!warehouse) return { success: false, message: 'المخزن غير موجود' };
    if (warehouse.is_default) return { success: false, message: 'لا يمكن حذف المخزن الافتراضي' };
    const hasStock = this.batches.some(b => b.warehouse_id === id && b.quantity > 0);
    if (hasStock) return { success: false, message: 'لا يمكن حذف المخزن لوجود أرصدة' };
    this.warehouses = this.warehouses.filter(w => w.id !== id); 
    await this.addToOutbox('warehouses', 'delete', { id });
    await this.saveToLocalStore(); return { success: true }; 
  }

  async setDefaultWarehouse(id: string) { 
    for (const w of this.warehouses) {
      const wasDefault = w.is_default;
      const shouldBeDefault = w.id === id;
      if (wasDefault !== shouldBeDefault) {
        w.is_default = shouldBeDefault;
        w.updated_at = new Date().toISOString();
        await this.addToOutbox('warehouses', 'update', w);
      }
    }
    await this.saveToLocalStore(); 
    return { success: true }; 
  }

  async addRepresentative(data: any) { 
    const r: Representative = { id: generateId(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
    this.representatives.push(r); 
    await this.addToOutbox('representatives', 'insert', r);
    await this.saveToLocalStore(); return { success: true }; 
  }
  async updateRepresentative(id: string, data: any) { 
    const idx = this.representatives.findIndex(r => r.id === id); 
    if (idx !== -1) { 
      Object.assign(this.representatives[idx], data); 
      await this.addToOutbox('representatives', 'update', this.representatives[idx]);
      await this.saveToLocalStore(); return { success: true }; 
    } 
    return { success: false }; 
  }
  async deleteRepresentative(id: string) { 
    this.representatives = this.representatives.filter(r => r.id !== id); 
    await this.addToOutbox('representatives', 'delete', { id });
    await this.saveToLocalStore(); return { success: true }; 
  }

  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean, docNo?: string, date?: string): Promise<{ success: boolean; id: string; message?: string }> {
      try {
          // التحقق من صحة البيانات
          const validation = purchaseInvoiceSchema.safeParse({ supplierId, items, cashPaid });
          if (!validation.success) {
            return { success: false, id: '', message: validation.error.issues[0].message };
          }

          const supplier = this.suppliers.find(s => s.id === supplierId);
          if (!supplier && supplierId) return { success: false, id: '', message: 'المورد غير موجود' };
          const total = items.reduce((s, it) => s + (it.quantity * it.cost_price), 0);
          
          const invId = generateId(); // معرف آمن
          
          const inv: PurchaseInvoice = { 
              id: invId, 
              invoice_number: this.generateDocNumber('PUR', this.purchaseInvoices), 
              document_number: docNo, 
              supplier_id: supplierId, 
              date: date || new Date().toISOString(), 
              total_amount: total, 
              paid_amount: cashPaid, 
              type: isReturn ? 'RETURN' : 'PURCHASE', 
              items, 
              created_at: new Date().toISOString(), 
              updated_at: new Date().toISOString(), 
              version: 1, 
              status: 'ACTIVE' 
          };
          
          // ⚠️ الخطوة الأهم: إضافة الفاتورة أولاً إلى قاعدة البيانات المحلية وإلى الـ Outbox
          this.purchaseInvoices.push(inv);
          await this.addToOutbox('purchaseInvoices', 'insert', inv, { noSync: true });

          for (const item of items) {
              const batchId = generateId();
              const batch: Batch = {
                  id: batchId,
                  product_id: item.product_id,
                  warehouse_id: item.warehouse_id,
                  batch_number: item.batch_number,
                  quantity: isReturn ? -(item.quantity + (item.bonus_quantity || 0)) : (item.quantity + (item.bonus_quantity || 0)),
                  purchase_price: item.cost_price,
                  selling_price: item.selling_price,
                  selling_price_wholesale: item.selling_price_wholesale,
                  selling_price_half_wholesale: item.selling_price_half_wholesale,
                  purchase_invoice_id: invId, // الارتباط بالفاتورة المنشأة للتو
                  expiry_date: item.expiry_date,
                  batch_status: BatchStatus.ACTIVE,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  version: 1,
                  status: 'ACTIVE'
              };
              
              // ⚠️ إضافة التشغيلة إلى الـ Outbox *بعد* الفاتورة
              this.batches.push(batch);
              await this.addToOutbox('batches', 'insert', batch, { noSync: true });

              const pIdx = this.products.findIndex(p => p.id === item.product_id);
              if (pIdx !== -1) {
                  this.products[pIdx].purchase_price = item.cost_price;
                  this.products[pIdx].selling_price = item.selling_price;
                  this.products[pIdx].selling_price_wholesale = item.selling_price_wholesale;
                  this.products[pIdx].selling_price_half_wholesale = item.selling_price_half_wholesale;
                  this.products[pIdx].updated_at = new Date().toISOString();
                  await this.addToOutbox('products', 'update', this.products[pIdx], { noSync: true });
              }
          }

          if (supplier) { 
            if (isReturn) supplier.current_balance -= total; else supplier.current_balance += total; 
            if (cashPaid > 0) { 
              await this.addCashTransaction({ 
                  type: isReturn ? 'RECEIPT' : 'EXPENSE', 
                  category: 'SUPPLIER_PAYMENT', 
                  reference_id: invId, 
                  related_name: supplier.name, 
                  amount: cashPaid, 
                  notes: `سداد فاتورة مشتريات #${inv.invoice_number}`, 
                  date: inv.date 
              }, { noSync: true }); 
              supplier.current_balance -= cashPaid; 
            } 
            await this.addToOutbox('suppliers', 'update', supplier, { noSync: true });
          }

          await this.saveToLocalStore(); 
          this.syncToCloud().catch(console.error);
          return { success: true, id: invId };
      } catch (err: any) {
          console.error("Error creating purchase invoice:", err);
          return { success: false, id: '', message: `فشل الحفظ: ${err.message}` };
      }
  }

  async deletePurchaseInvoice(id: string, updateInventory: boolean = true, updateBalance: boolean = true): Promise<{ success: boolean; message?: string }> { 
      const inv = this.purchaseInvoices.find(i => i.id === id);
      if (!inv) return { success: false, message: 'الفاتورة غير موجودة' };
      
      const batchesToDelete = this.batches.filter(b => b.purchase_invoice_id === id);
      for (const b of batchesToDelete) {
          await this.addToOutbox('batches', 'delete', { id: b.id });
      }
      this.batches = this.batches.filter(b => b.purchase_invoice_id !== id);

      if (updateBalance) { 
        const supplier = this.suppliers.find(s => s.id === inv.supplier_id); 
        if (supplier) { 
          // عكس تأثير الفاتورة والتحصيل
          const relatedTxs = this.cashTransactions.filter(t => t.reference_id === id);
          const totalCash = relatedTxs.reduce((s, t) => s + t.amount, 0);

          if (inv.type === 'PURCHASE') {
              supplier.current_balance -= (inv.total_amount - totalCash);
          } else {
              supplier.current_balance += (inv.total_amount - totalCash);
          }

          // حذف المعاملات المالية
          for (const tx of relatedTxs) {
              this.cashTransactions = this.cashTransactions.filter(t => t.id !== tx.id);
              await this.addToOutbox('cashTransactions', 'delete', { id: tx.id });
          }

          await this.addToOutbox('suppliers', 'update', supplier);
        } 
      }

      // Revert product prices to previous latest purchase
      if (inv.type === 'PURCHASE') {
          for (const item of inv.items) {
              await this.updateProductPriceFromLatestPurchase(item.product_id);
          }
      }

      this.purchaseInvoices = this.purchaseInvoices.filter(i => i.id !== id); 
      await this.addToOutbox('purchaseInvoices', 'delete', { id });
      await this.saveToLocalStore(); return { success: true }; 
  }

  async updateProductPriceFromLatestPurchase(productId: string) {
      const productPurchaseInvoices = this.purchaseInvoices
          .filter(pi => pi.status !== 'CANCELLED' && pi.type === 'PURCHASE')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (const inv of productPurchaseInvoices) {
          const item = inv.items.find(it => it.product_id === productId);
          if (item) {
              const pIdx = this.products.findIndex(p => p.id === productId);
              if (pIdx !== -1) {
                  this.products[pIdx].purchase_price = item.cost_price;
                  this.products[pIdx].selling_price = item.selling_price;
                  this.products[pIdx].selling_price_wholesale = item.selling_price_wholesale;
                  this.products[pIdx].selling_price_half_wholesale = item.selling_price_half_wholesale;
                  this.products[pIdx].updated_at = new Date().toISOString();
                  await this.addToOutbox('products', 'update', this.products[pIdx]);
                  return;
              }
          }
      }
  }

  async syncAllProductPricesFromLatestPurchases() {
      for (const product of this.products) {
          await this.updateProductPriceFromLatestPurchase(product.id);
      }
      await this.saveToLocalStore();
      return { success: true };
  }

  async createPurchaseOrder(supplierId: string, items: any[]) { 
    const po: PurchaseOrder = { id: generateId(), order_number: this.generateDocNumber('ORD', this.purchaseOrders), supplier_id: supplierId, date: new Date().toISOString(), order_status: 'PENDING', items, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }; 
    this.purchaseOrders.push(po); 
    await this.addToOutbox('purchaseOrders', 'insert', po);
    await this.saveToLocalStore(); return { success: true }; 
  }
  async updatePurchaseOrderStatus(id: string, status: any) { 
    const idx = this.purchaseOrders.findIndex(o => o.id === id); 
    if (idx !== -1) { 
      this.purchaseOrders[idx].order_status = status; 
      await this.addToOutbox('purchaseOrders', 'update', this.purchaseOrders[idx]);
      await this.saveToLocalStore(); 
    } 
  }
  async submitStockTake(adjs: any[]) { 
    for (const a of adjs) {
      const adj: PendingAdjustment = { id: generateId(), ...a, date: new Date().toISOString(), adj_status: 'PENDING', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.pendingAdjustments.push(adj); 
      await this.addToOutbox('pendingAdjustments', 'insert', adj);
    }
    await this.saveToLocalStore(); 
  }
  async approveAdjustment(id: string) { 
    const idx = this.pendingAdjustments.findIndex(a => a.id === id); 
    if (idx !== -1) { 
      this.pendingAdjustments[idx].adj_status = 'APPROVED'; 
      await this.addToOutbox('pendingAdjustments', 'update', this.pendingAdjustments[idx]);
      await this.saveToLocalStore(); return true; 
    } 
    return false; 
  }
  async rejectAdjustment(id: string) { 
    const idx = this.pendingAdjustments.findIndex(a => a.id === id); 
    if (idx !== -1) { 
      this.pendingAdjustments[idx].adj_status = 'REJECTED'; 
      await this.addToOutbox('pendingAdjustments', 'update', this.pendingAdjustments[idx]);
      await this.saveToLocalStore(); return true; 
    } 
    return false; 
  }
  async saveDailyClosing(data: any) { 
    const dc: DailyClosing = { id: generateId(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
    this.dailyClosings.push(dc); 
    await this.addToOutbox('dailyClosings', 'insert', dc);
    await this.saveToLocalStore(); return true; 
  }
  getDailySummary(date: string) { const sales = this.invoices.filter(i => i.date.startsWith(date) && i.type === 'SALE').reduce((s, i) => s + i.net_total, 0); const exp = this.cashTransactions.filter(t => t.date.startsWith(date) && t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0); const cash = this.getCashBalance(); return { cashSales: sales, expenses: exp, cashPurchases: 0, expectedCash: cash, openingCash: cash - (sales - exp), inventoryValue: 0 }; }
  async updateSettings(s: any) { 
    this.settings = { ...this.settings, ...s }; 
    await this.addToOutbox('settings', 'update', this.settings);
    await this.saveToLocalStore(); return true; 
  }
  async resetDatabase() { 
    localStorage.removeItem('mizan_db'); 
    const tables = [
      'products', 'batches', 'customers', 'suppliers', 'invoices',
      'purchaseInvoices', 'cashTransactions', 'warehouses', 'representatives',
      'dailyClosings', 'pendingAdjustments', 'purchaseOrders', 'settings', 'outbox'
    ];
    for (const table of tables) {
      await localStore.clearTable(table);
    }
    window.location.reload(); 
  }
  async clearAllSales() { this.invoices = []; await this.saveToLocalStore(); }
  async resetCustomerAccounts() { this.customers.forEach(c => c.current_balance = 0); this.invoices = []; await this.saveToLocalStore(); }
  async clearAllPurchases() { this.purchaseInvoices = []; await this.saveToLocalStore(); }
  async clearAllOrders() { this.purchaseOrders = []; await this.saveToLocalStore(); }
  async resetCashRegister() { this.cashTransactions = []; await this.saveToLocalStore(); }
  async clearWarehouseStock(id: string) { this.batches = this.batches.filter(b => b.warehouse_id !== id); await this.saveToLocalStore(); }
  async recalculateAllBalances() { 
    console.log("Recalculating all balances...");
    
    this.suppliers.forEach(s => {
      let balance = s.opening_balance || 0;
      this.purchaseInvoices
        .filter(p => p.supplier_id === s.id && p.status !== 'CANCELLED' && p.status !== 'DELETED')
        .forEach(p => {
          if (p.type === 'RETURN') balance -= p.total_amount;
          else balance += p.total_amount;
        });
        
      this.cashTransactions
        .filter(t => t.category === 'SUPPLIER_PAYMENT' && t.reference_id === s.id && t.status !== 'CANCELLED' && t.status !== 'DELETED')
        .forEach(t => {
          if (t.type === CashTransactionType.EXPENSE) balance -= t.amount;
          else if (t.type === CashTransactionType.RECEIPT) balance += t.amount; 
        });
        
      s.current_balance = balance;
    });

    this.customers.forEach(c => {
      let balance = c.opening_balance || 0;
      this.invoices
        .filter(i => i.customer_id === c.id && i.status !== 'CANCELLED' && i.status !== 'DELETED')
        .forEach(i => {
          if (i.type === 'RETURN') balance -= i.net_total;
          else balance += i.net_total;
        });
        
      this.cashTransactions
        .filter(t => t.category === 'CUSTOMER_PAYMENT' && t.reference_id === c.id && t.status !== 'CANCELLED' && t.status !== 'DELETED')
        .forEach(t => {
          if (t.type === CashTransactionType.RECEIPT) balance -= t.amount;
          else if (t.type === CashTransactionType.EXPENSE) balance += t.amount; 
        });
        
      c.current_balance = balance;
    });

    console.log("Recalculation complete.");
    await this.saveToLocalStore(true);
  }
  getNextTransactionRef(type: any) { return this.generateDocNumber(`TX-${type.charAt(0)}`, this.cashTransactions); }
  getNextProductCode() { 
    return this.generateDocNumber('P', this.products); 
  }
  async addExpenseCategory(cat: string) { 
    if (!this.settings.expenseCategories.includes(cat)) { 
      this.settings.expenseCategories.push(cat); 
      await this.addToOutbox('settings', 'update', this.settings);
      await this.saveToLocalStore(); 
    } 
  }
  getABCAnalysis(): ABCAnalysis { return { classifiedProducts: [] }; }
  getInventoryValuationReport(): InventoryValuationItem[] { return []; }
  exportDbData() { return JSON.stringify(this); }
  async importDbData(json: string) { 
    try { 
      const d = JSON.parse(json); 
      Object.assign(this, d); 
      await this.saveToLocalStore(true); 
      return true; 
    } catch { 
      return false; 
    } 
  }
}

export const db = new Database();
