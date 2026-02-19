
import { supabase, isSupabaseConfigured } from './supabase';
import { localStore, OutboxItem } from './localStore';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem, ABCAnalysis, InventoryValuationItem
} from '../types';

const DB_VERSION = 4.3; 

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

  constructor() {
    // We don't call loadFromLocalCache here anymore because it's async
    // It will be called in init()
  }

  onSyncStateChange(callback: (isBusy: boolean) => void) {
    this.syncListeners.push(callback);
    return () => { this.syncListeners = this.syncListeners.filter(l => l !== callback); };
  }

  private notifySyncState() {
    this.syncListeners.forEach(l => l(this.activeOperations > 0));
  }

  async init(onProgress?: (msg: string) => void) {
    if (onProgress) onProgress("جاري تحميل البيانات المحلية...");
    await this.loadFromLocalStore();

    if (!isSupabaseConfigured) {
      console.warn("Supabase is not configured. Running in local mode.");
      this.isFullyLoaded = true;
      return;
    }

    // Check if we have data
    const hasData = this.products.length > 0 || this.invoices.length > 0;
    
    if (!hasData) {
      console.log("No local data found. Starting full cloud sync...");
      await this.syncFromCloud(onProgress);
    } else {
      console.log("Local data found. Ready.");
      // Background sync outbox
      this.syncToCloud().catch(console.error);
    }

    this.isFullyLoaded = true;
  }

  async syncToCloud() {
    if (!isSupabaseConfigured) return;
    
    const outbox = await localStore.getOutbox();
    if (outbox.length === 0) return;

    this.activeOperations++;
    this.notifySyncState();

    try {
      for (const item of outbox) {
        const { entityType, operation, payload, id } = item;
        let success = false;

        try {
          if (operation === 'insert' || operation === 'update') {
            const { error } = await supabase.from(this.mapEntityTypeToTable(entityType)).upsert(payload);
            if (!error) success = true;
          } else if (operation === 'delete') {
            const { error } = await supabase.from(this.mapEntityTypeToTable(entityType)).delete().eq('id', payload.id);
            if (!error) success = true;
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
    // Trigger background sync
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
        console.log(`Syncing table: ${table.name}`);
        const data = await this.fetchAllFromTable(table.name);
        (this as any)[table.prop] = data;
        console.log(`Loaded ${data.length} items from ${table.name}`);
      }

      // Special case for settings
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

  // --- دوال الجلب الضخمة ---
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
                console.error(`Error fetching ${table} at range ${from}-${from+999}:`, error);
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`Retrying ${table} (${retryCount}/${maxRetries})...`);
                    await new Promise(r => setTimeout(r, 1000 * retryCount));
                    continue;
                }
                throw error;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += data.length;
                if (data.length < 1000) hasMore = false;
                retryCount = 0; // Reset retry on success
            } else {
                hasMore = false;
            }
        }
        return allData;
    } catch (err) { 
        console.error(`Failed to fetch all from ${table}:`, err);
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

  // --- إدارة الكاش المحلي ---
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

  // Deprecated localStorage methods for compatibility
  loadFromLocalCache() { this.loadFromLocalStore(); }
  saveToLocalCache(force: boolean = false) { this.saveToLocalStore(force); }

  // --- Getters ---
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
  async createInvoice(customerId: string, items: CartItem[], cashPayment: number, isReturn: boolean, addDisc: number, createdBy?: any, commission: number = 0): Promise<{ success: boolean; id: string; message?: string }> {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return { success: false, id: '', message: 'العميل غير موجود' };
    const total_before = items.reduce((s, it) => s + (it.quantity * (it.unit_price || it.batch?.selling_price || it.product.selling_price || 0)), 0);
    const total_disc = items.reduce((s, it) => s + (it.quantity * (it.unit_price || 0) * (it.discount_percentage / 100)), 0);
    const net = Math.max(0, total_before - total_disc - addDisc);
    const invoiceId = Math.random().toString(36).substring(7);
    const invoice: Invoice = {
        id: invoiceId, invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        customer_id: customerId, date: new Date().toISOString(), total_before_discount: total_before,
        total_discount: total_disc, additional_discount: addDisc, net_total: net,
        previous_balance: customer.current_balance, final_balance: isReturn ? customer.current_balance - net : customer.current_balance + net,
        payment_status: PaymentStatus.UNPAID, items, type: isReturn ? 'RETURN' : 'SALE', created_by: createdBy?.id, created_by_name: createdBy?.name, commission_value: commission,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE'
    };
    this.invoices.push(invoice);
    customer.current_balance = invoice.final_balance;
    if (cashPayment > 0) await this.addCashTransaction({ type: isReturn ? 'EXPENSE' : 'RECEIPT', category: 'CUSTOMER_PAYMENT', reference_id: invoice.id, related_name: customer.name, amount: cashPayment, notes: `سداد فاتورة #${invoice.invoice_number}`, date: invoice.date });
    
    await this.addToOutbox('invoices', 'insert', invoice);
    await this.addToOutbox('customers', 'update', customer);
    
    await this.saveToLocalStore(); return { success: true, id: invoiceId };
  }

  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPayment: number): Promise<{ success: boolean; id: string; message?: string }> {
    const idx = this.invoices.findIndex(inv => inv.id === id);
    if (idx === -1) return { success: false, id: '', message: 'الفاتورة غير موجودة' };
    const oldInv = this.invoices[idx];
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return { success: false, id: '', message: 'العميل غير موجود' };
    const total_before = items.reduce((s, it) => s + (it.quantity * (it.unit_price || it.batch?.selling_price || it.product.selling_price || 0)), 0);
    const total_disc = items.reduce((s, it) => s + (it.quantity * (it.unit_price || 0) * (it.discount_percentage / 100)), 0);
    const net = Math.max(0, total_before - total_disc - (oldInv.additional_discount || 0));
    if (oldInv.type === 'SALE') customer.current_balance -= oldInv.net_total; else customer.current_balance += oldInv.net_total;
    if (oldInv.type === 'SALE') customer.current_balance += net; else customer.current_balance -= net;
    Object.assign(this.invoices[idx], { customer_id: customerId, items, net_total: net, total_before_discount: total_before, total_discount: total_disc, updated_at: new Date().toISOString(), version: oldInv.version + 1 });
    
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
      const tx: CashTransaction = { id: Math.random().toString(36).substring(7), ref_number: `TX-${Date.now().toString().slice(-6)}`, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
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
      const p: Product = { id: Math.random().toString(36).substring(7), ...pData, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.products.push(p); 
      await this.addToOutbox('products', 'insert', p);
      if (bData.quantity > 0) {
        const b: Batch = { id: Math.random().toString(36).substring(7), product_id: p.id, ...bData, batch_status: BatchStatus.ACTIVE, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
        this.batches.push(b);
        await this.addToOutbox('batches', 'insert', b);
      }
      await this.saveToLocalStore(); return { success: true };
  }

  async updateProduct(id: string, data: any) {
      const idx = this.products.findIndex(x => x.id === id); 
      if (idx !== -1) { 
        Object.assign(this.products[idx], data); 
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
    const c: Customer = { id: Math.random().toString(36).substring(7), ...data, current_balance: data.opening_balance || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
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
    const s: Supplier = { id: Math.random().toString(36).substring(7), ...data, current_balance: data.opening_balance || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
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
    const w: Warehouse = { id: Math.random().toString(36).substring(7), name, is_default: this.warehouses.length === 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
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
    const r: Representative = { id: Math.random().toString(36).substring(7), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
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
          const invId = Math.random().toString(36).substring(7);
          const inv: PurchaseInvoice = { id: invId, invoice_number: `PUR-${Date.now().toString().slice(-6)}`, document_number: docNo, supplier_id: supplierId, date: date || new Date().toISOString(), total_amount: total, paid_amount: cashPaid, type: isReturn ? 'RETURN' : 'PURCHASE', items, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
          this.purchaseInvoices.push(inv);
          if (supplier) { 
            if (isReturn) supplier.current_balance -= total; else supplier.current_balance += total; 
            if (cashPaid > 0) { 
              await this.addCashTransaction({ type: isReturn ? 'RECEIPT' : 'EXPENSE', category: 'SUPPLIER_PAYMENT', reference_id: supplier.id, related_name: supplier.name, amount: cashPaid, notes: `سداد فاتورة مشتريات #${inv.invoice_number}`, date: inv.date }); 
              supplier.current_balance -= cashPaid; 
            } 
            await this.addToOutbox('suppliers', 'update', supplier);
          }
          await this.addToOutbox('purchaseInvoices', 'insert', inv);
          await this.saveToLocalStore(); return { success: true, id: invId };
      } catch (err: any) { return { success: false, id: '', message: err.message }; }
  }

  async deletePurchaseInvoice(id: string, updateInventory: boolean = true, updateBalance: boolean = true): Promise<{ success: boolean; message?: string }> { 
      const inv = this.purchaseInvoices.find(i => i.id === id);
      if (!inv) return { success: false, message: 'الفاتورة غير موجودة' };
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
    const po: PurchaseOrder = { id: Math.random().toString(36).substring(7), order_number: `ORD-${Date.now().toString().slice(-6)}`, supplier_id: supplierId, date: new Date().toISOString(), order_status: 'PENDING', items, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }; 
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
      const adj: PendingAdjustment = { id: Math.random().toString(36).substring(7), ...a, date: new Date().toISOString(), adj_status: 'PENDING', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
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
    const dc: DailyClosing = { id: Math.random().toString(36).substring(7), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
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
  async recalculateAllBalances() { console.log("Recalculating..."); }
  getNextTransactionRef(type: any) { return `TX-${type.charAt(0)}-${Date.now().toString().slice(-6)}`; }
  getNextProductCode() { return `P-${Math.floor(1000 + Math.random() * 9000)}`; }
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
