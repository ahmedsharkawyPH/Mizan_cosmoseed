
import { supabase, isSupabaseConfigured } from './supabase';
import { localStore, OutboxItem } from './localStore';
import { openDB } from 'idb'; // DEXIE MIGRATION: Used for one-time migration
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem, ABCAnalysis, InventoryValuationItem
} from '../types';

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
  private syncListeners: ((isBusy: boolean) => void)[] = [];
  private saveTimeout: any = null;

  constructor() {}

  onSyncStateChange(callback: (isBusy: boolean) => void) {
    this.syncListeners.push(callback);
    return () => { this.syncListeners = this.syncListeners.filter(l => l !== callback); };
  }

  private notifySyncState() {
    this.syncListeners.forEach(l => l(this.activeOperations > 0));
  }

  async init(onProgress?: (msg: string) => void) {
    if (onProgress) onProgress("جاري تهيئة قاعدة البيانات...");
    await localStore.init(); 

    await this.migrateFromOldIdb(onProgress);

    if (onProgress) onProgress("جاري تحميل البيانات المحلية...");
    await this.loadFromLocalStore();

    if (!isSupabaseConfigured) {
      console.warn("Supabase is not configured. Running in local mode.");
      this.isFullyLoaded = true;
      return;
    }

    const hasData = this.products.length > 0 || this.invoices.length > 0;
    
    if (!hasData) {
      console.log("No local data found. Starting full cloud sync...");
      await this.syncFromCloud(onProgress);
    } else {
      console.log("Local data found. Ready.");
      this.syncToCloud().catch(console.error);
    }

    this.recalculateAllBalances();
    this.isFullyLoaded = true;
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
    
    const outbox = await localStore.getOutbox();
    if (outbox.length === 0) return;

    this.activeOperations++;
    this.notifySyncState();

    try {
      // تنفيذ الـ Outbox بالترتيب المحفوظ
      for (const item of outbox) {
        const { entityType, operation, payload, id } = item;
        let success = false;

        try {
          if (operation === 'insert' || operation === 'update') {
            const table = this.mapEntityTypeToTable(entityType);
            let syncPayload = { ...payload };
            let options: any = {};
            
            if (entityType === 'products') {
              // لتجنب خطأ 23503 عند تعارض الكود، نقوم باستثناء الـ ID من التحديث
              // بحيث يتم تحديث بيانات المنتج المرتبط بالكود دون محاولة تغيير معرفه الفريد
              const { id, ...rest } = payload;
              syncPayload = rest;
              options = { onConflict: 'code', ignoreDuplicates: false };
            }
            
            const { error } = await supabase.from(table).upsert(syncPayload, options);
            
            if (!error) success = true;
            else {
              console.error(`Sync error on ${entityType}:`, error);
              if (error.code === '23503') {
                 console.error("خطأ علاقات (23503): لا يمكن تحديث المنتج لأن الكود مرتبط بـ ID مختلف له حركات مخزنية.");
              } else if (error.code === '23505') {
                 console.error("خطأ تكرار (23505): الكود مستخدم بالفعل.");
              }
            }
          } else if (operation === 'delete') {
            const { error } = await supabase.from(this.mapEntityTypeToTable(entityType)).delete().eq('id', payload.id);
            if (!error) success = true;
            else console.error(`Sync error on ${entityType} deletion:`, error);
          }

          if (success && id !== undefined) {
            await localStore.removeFromOutbox(id);
          }
        } catch (err) {
          console.error(`Failed to sync outbox item ${id}:`, err);
        }
      }
    } finally {
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

  async addToOutbox(entityType: string, operation: 'insert' | 'update' | 'delete', payload: any) {
    await localStore.addToOutbox({
      entityType,
      operation,
      payload,
      createdAt: new Date().toISOString()
    });
    this.syncToCloud().catch(console.error);
  }

  async syncFromCloud(onProgress?: (msg: string) => void) {
    if (!isSupabaseConfigured) return;
    
    this.activeOperations++;
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

      for (const table of tables) {
        if (onProgress) onProgress(`جاري جلب ${table.label}...`);
        const data = await this.fetchAllFromTable(table.name);
        (this as any)[table.prop] = data;
      }

      if (onProgress) onProgress("جاري جلب الإعدادات...");
      const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').single();
      if (!settingsError && settingsData) {
        this.settings = { ...this.settings, ...settingsData };
      }

      await this.saveToLocalStore(true);
      if (onProgress) onProgress("تمت المزامنة بنجاح");
    } catch (err) {
      console.error("Cloud sync failed:", err);
      if (onProgress) onProgress("فشلت المزامنة، جاري العمل بالوضع المحلي");
    } finally {
      this.activeOperations--;
      this.notifySyncState();
    }
  }

  async fetchAllFromTable(table: string) {
    if (!isSupabaseConfigured) return [];
    try {
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;
        let retryCount = 0;
        const maxRetries = 3;

        while (hasMore) {
            const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
            
            if (error) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    await new Promise(r => setTimeout(r, 1000 * retryCount));
                    continue;
                }
                throw error;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += data.length;
                if (data.length < 1000) hasMore = false;
                retryCount = 0;
            } else {
                hasMore = false;
            }
        }
        return allData;
    } catch (err) { 
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
        if (data[table]) (this as any)[table] = data[table];
      });
      if (data.settings) this.settings = { ...this.settings, ...data.settings };
    }
  }

  async saveToLocalStore(force: boolean = false) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    const perform = async () => {
      const pkg = {
        products: this.products, batches: this.batches, customers: this.customers,
        invoices: this.invoices, suppliers: this.suppliers, cashTransactions: this.cashTransactions,
        warehouses: this.warehouses, representatives: this.representatives, dailyClosings: this.dailyClosings,
        pendingAdjustments: this.pendingAdjustments, purchaseOrders: this.purchaseOrders,
        purchaseInvoices: this.purchaseInvoices, settings: this.settings
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
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return { success: false, id: '', message: 'العميل غير موجود' };
    
    const total_before = items.reduce((s, it) => s + (it.quantity * (it.unit_price || it.batch?.selling_price || it.product.selling_price || 0)), 0);
    const total_disc = items.reduce((s, it) => s + (it.quantity * (it.unit_price || 0) * (it.discount_percentage / 100)), 0);
    const netAfterAdd = Math.max(0, total_before - total_disc - addDisc);
    const cashDiscValue = netAfterAdd * (cashDiscPercent / 100);
    const net = Math.max(0, netAfterAdd - cashDiscValue);
    
    const prevBalance = manualPrevBalance !== undefined ? manualPrevBalance : customer.current_balance;
    const invoiceId = generateId(); // استخدام المعرف الآمن
    
    const invoice: Invoice = {
        id: invoiceId, 
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        customer_id: customerId, 
        date: new Date().toISOString(), 
        total_before_discount: total_before,
        total_discount: total_disc, 
        additional_discount: addDisc, 
        cash_discount_percent: cashDiscPercent, 
        cash_discount_value: cashDiscValue,
        net_total: net,
        previous_balance: prevBalance, 
        final_balance: isReturn ? prevBalance - net : prevBalance + net,
        payment_status: PaymentStatus.UNPAID, 
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
    await this.addToOutbox('invoices', 'insert', invoice);

    // 2. تحديث العميل
    customer.current_balance = invoice.final_balance;
    await this.addToOutbox('customers', 'update', customer);
    
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
        });
    }
    
    await this.saveToLocalStore(); 
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

    if (oldInv.type === 'SALE') customer.current_balance -= oldInv.net_total; else customer.current_balance += oldInv.net_total;
    if (oldInv.type === 'SALE') customer.current_balance += net; else customer.current_balance -= net;
    
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
    if (customer) { 
      if (inv.type === 'SALE') customer.current_balance -= inv.net_total; else customer.current_balance += inv.net_total; 
      await this.addToOutbox('customers', 'update', customer);
    }
    this.invoices = this.invoices.filter(i => i.id !== id);
    await this.addToOutbox('invoices', 'delete', { id });
    await this.saveToLocalStore(); return { success: true };
  }

  async addCashTransaction(data: any) {
      const tx: CashTransaction = { id: generateId(), ref_number: `TX-${Date.now().toString().slice(-6)}`, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.cashTransactions.push(tx); 
      await this.addToOutbox('cashTransactions', 'insert', tx);
      await this.saveToLocalStore(); return { success: true };
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
      const p: Product = { id: generateId(), ...pData, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.products.push(p); 
      await this.addToOutbox('products', 'insert', p);
      if (bData.quantity > 0) {
        const b: Batch = { id: generateId(), product_id: p.id, ...bData, batch_status: BatchStatus.ACTIVE, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
        this.batches.push(b);
        await this.addToOutbox('batches', 'insert', b);
      }
      await this.saveToLocalStore(); return { success: true };
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
          const supplier = this.suppliers.find(s => s.id === supplierId);
          if (!supplier && supplierId) return { success: false, id: '', message: 'المورد غير موجود' };
          const total = items.reduce((s, it) => s + (it.quantity * it.cost_price), 0);
          
          const invId = generateId(); // معرف آمن
          
          const inv: PurchaseInvoice = { 
              id: invId, 
              invoice_number: `PUR-${Date.now().toString().slice(-6)}`, 
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
          await this.addToOutbox('purchaseInvoices', 'insert', inv);

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
              await this.addToOutbox('batches', 'insert', batch);

              const pIdx = this.products.findIndex(p => p.id === item.product_id);
              if (pIdx !== -1) {
                  this.products[pIdx].purchase_price = item.cost_price;
                  this.products[pIdx].selling_price = item.selling_price;
                  this.products[pIdx].selling_price_wholesale = item.selling_price_wholesale;
                  this.products[pIdx].selling_price_half_wholesale = item.selling_price_half_wholesale;
                  this.products[pIdx].updated_at = new Date().toISOString();
                  await this.addToOutbox('products', 'update', this.products[pIdx]);
              }
          }

          if (supplier) { 
            if (isReturn) supplier.current_balance -= total; else supplier.current_balance += total; 
            if (cashPaid > 0) { 
              await this.addCashTransaction({ 
                  type: isReturn ? 'RECEIPT' : 'EXPENSE', 
                  category: 'SUPPLIER_PAYMENT', 
                  reference_id: supplier.id, 
                  related_name: supplier.name, 
                  amount: cashPaid, 
                  notes: `سداد فاتورة مشتريات #${inv.invoice_number}`, 
                  date: inv.date 
              }); 
              supplier.current_balance -= cashPaid; 
            } 
            await this.addToOutbox('suppliers', 'update', supplier);
          }

          await this.saveToLocalStore(); 
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
          if (inv.type === 'PURCHASE') supplier.current_balance -= inv.total_amount; else supplier.current_balance += inv.total_amount; 
          await this.addToOutbox('suppliers', 'update', supplier);
        } 
      }
      this.purchaseInvoices = this.purchaseInvoices.filter(i => i.id !== id); 
      await this.addToOutbox('purchaseInvoices', 'delete', { id });
      await this.saveToLocalStore(); return { success: true }; 
  }

  async createPurchaseOrder(supplierId: string, items: any[]) { 
    const po: PurchaseOrder = { id: generateId(), order_number: `ORD-${Date.now().toString().slice(-6)}`, supplier_id: supplierId, date: new Date().toISOString(), order_status: 'PENDING', items, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }; 
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
  getNextTransactionRef(type: any) { return `TX-${type.charAt(0)}-${Date.now().toString().slice(-6)}`; }
  getNextProductCode() { 
    return `P-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 899)}`; 
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
