import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
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
    this.loadFromLocalCache();
  }

  onSyncStateChange(callback: (isBusy: boolean) => void) {
    this.syncListeners.push(callback);
    return () => { this.syncListeners = this.syncListeners.filter(l => l !== callback); };
  }

  private notifySyncState() {
    this.syncListeners.forEach(l => l(this.activeOperations > 0));
  }

  async init() {
    // إذا كانت البيانات فارغة (مثل أول مرة على الموبايل)، قم بجلبها من السحابة
    if (this.products.length === 0 && isSupabaseConfigured) {
      console.log('📱 Initializing empty mobile database. Fetching from cloud...');
      await this.syncFromCloud();
    }
    this.isFullyLoaded = true;
  }

  // --- دوال الجلب الضخمة ---
  async fetchAllFromTable(table: string) {
    if (!isSupabaseConfigured) return [];
    try {
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase.from(table).select('*').range(from, from + 999).order('created_at', { ascending: false });
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += 1000;
                if (data.length < 1000) hasMore = false;
            } else hasMore = false;
        }
        return allData;
    } catch (err) { return []; }
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
  loadFromLocalCache() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log('📱 Mobile DB Check: Current Engine Version', DB_VERSION);
    }

    const raw = localStorage.getItem('mizan_db');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        
        if (isMobile) {
          console.log('📱 Cache Info: Version', data.dbVersion, '| Items:', data.products?.length);
        }

        // إذا كانت نسخة الداتابيز قديمة جداً على الموبايل، امسحها لفرض التحميل من السحابة
        if (isMobile && (!data.dbVersion || data.dbVersion < 4.0)) {
          console.warn('⚠️ Critical: Old cache schema on mobile. Purging...');
          localStorage.removeItem('mizan_db');
          return;
        }

        Object.assign(this, data);
        this.settings = { ...this.settings, ...(data.settings || {}) };
      } catch (e) {
        if (isMobile) console.error('📱 Cache Error:', e);
      }
    }
  }

  saveToLocalCache(force: boolean = false) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    const perform = () => {
      const pkg = {
        dbVersion: DB_VERSION, products: this.products, batches: this.batches, customers: this.customers,
        invoices: this.invoices, suppliers: this.suppliers, cashTransactions: this.cashTransactions,
        warehouses: this.warehouses, representatives: this.representatives, dailyClosings: this.dailyClosings,
        pendingAdjustments: this.pendingAdjustments, purchaseOrders: this.purchaseOrders,
        purchaseInvoices: this.purchaseInvoices, settings: this.settings
      };
      localStorage.setItem('mizan_db', JSON.stringify(pkg));
    };
    if (force) perform(); else this.saveTimeout = setTimeout(perform, 300);
  }

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
    this.saveToLocalCache(); return { success: true, id: invoiceId };
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
    this.saveToLocalCache(); return { success: true, id };
  }

  async deleteInvoice(id: string): Promise<{ success: boolean; message?: string }> {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return { success: false, message: 'الفاتورة غير موجودة' };
    const customer = this.customers.find(c => c.id === inv.customer_id);
    if (customer) { if (inv.type === 'SALE') customer.current_balance -= inv.net_total; else customer.current_balance += inv.net_total; }
    this.invoices = this.invoices.filter(i => i.id !== id);
    this.saveToLocalCache(); return { success: true };
  }

  async addCashTransaction(data: any) {
      const tx: CashTransaction = { id: Math.random().toString(36).substring(7), ref_number: `TX-${Date.now().toString().slice(-6)}`, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.cashTransactions.push(tx); this.saveToLocalCache(); return { success: true };
  }

  async recordInvoicePayment(invoiceId: string, amount: number): Promise<{ success: boolean; message?: string }> {
      const inv = this.invoices.find(i => i.id === invoiceId);
      if (!inv) return { success: false, message: 'الفاتورة غير موجودة' };
      const customer = this.customers.find(c => c.id === inv.customer_id);
      if (!customer) return { success: false, message: 'العميل غير موجود' };
      await this.addCashTransaction({ type: inv.type === 'SALE' ? 'RECEIPT' : 'EXPENSE', category: 'CUSTOMER_PAYMENT', reference_id: inv.id, related_name: customer.name, amount, notes: `سداد فاتورة #${inv.invoice_number}`, date: new Date().toISOString() });
      customer.current_balance -= (inv.type === 'SALE' ? amount : -amount);
      this.saveToLocalCache(); return { success: true };
  }

  async addProduct(pData: any, bData: any) {
      const p: Product = { id: Math.random().toString(36).substring(7), ...pData, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
      this.products.push(p); if (bData.quantity > 0) this.batches.push({ id: Math.random().toString(36).substring(7), product_id: p.id, ...bData, batch_status: BatchStatus.ACTIVE, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' });
      this.saveToLocalCache(); return { success: true };
  }

  async updateProduct(id: string, data: any) {
      const idx = this.products.findIndex(x => x.id === id); if (idx !== -1) { Object.assign(this.products[idx], data); this.saveToLocalCache(); return { success: true }; } return { success: false };
  }

  async deleteProduct(id: string) { this.products = this.products.filter(p => p.id !== id); this.saveToLocalCache(); return { success: true }; }
  async addCustomer(data: any) { this.customers.push({ id: Math.random().toString(36).substring(7), ...data, current_balance: data.opening_balance || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }); this.saveToLocalCache(); return { success: true }; }
  async updateCustomer(id: string, data: any) { const idx = this.customers.findIndex(c => c.id === id); if (idx !== -1) { Object.assign(this.customers[idx], data); this.saveToLocalCache(); return { success: true }; } return { success: false }; }
  async deleteCustomer(id: string) { this.customers = this.customers.filter(c => c.id !== id); this.saveToLocalCache(); return { success: true }; }
  async addSupplier(data: any) { this.suppliers.push({ id: Math.random().toString(36).substring(7), ...data, current_balance: data.opening_balance || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }); this.saveToLocalCache(); return { success: true }; }
  async updateSupplier(id: string, data: any) { const idx = this.suppliers.findIndex(s => s.id === id); if (idx !== -1) { Object.assign(this.suppliers[idx], data); this.saveToLocalCache(); return { success: true }; } return { success: false }; }
  async deleteSupplier(id: string) { this.suppliers = this.suppliers.filter(s => s.id !== id); this.saveToLocalCache(); return { success: true }; }
  async addWarehouse(name: string) { this.warehouses.push({ id: Math.random().toString(36).substring(7), name, is_default: this.warehouses.length === 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }); this.saveToLocalCache(); return { success: true }; }
  async updateWarehouse(id: string, name: string) { const idx = this.warehouses.findIndex(w => w.id === id); if (idx !== -1) { this.warehouses[idx].name = name; this.saveToLocalCache(); return { success: true }; } return { success: false }; }
  async deleteWarehouse(id: string): Promise<{ success: boolean; message?: string }> { 
    const warehouse = this.warehouses.find(w => w.id === id);
    if (!warehouse) return { success: false, message: 'المخزن غير موجود' };
    if (warehouse.is_default) return { success: false, message: 'لا يمكن حذف المخزن الافتراضي' };
    const hasStock = this.batches.some(b => b.warehouse_id === id && b.quantity > 0);
    if (hasStock) return { success: false, message: 'لا يمكن حذف المخزن لوجود أرصدة' };
    this.warehouses = this.warehouses.filter(w => w.id !== id); 
    this.saveToLocalCache(); return { success: true }; 
  }

  async addRepresentative(data: any) { this.representatives.push({ id: Math.random().toString(36).substring(7), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }); this.saveToLocalCache(); return { success: true }; }
  async updateRepresentative(id: string, data: any) { const idx = this.representatives.findIndex(r => r.id === id); if (idx !== -1) { Object.assign(this.representatives[idx], data); this.saveToLocalCache(); return { success: true }; } return { success: false }; }
  async deleteRepresentative(id: string) { this.representatives = this.representatives.filter(r => r.id !== id); this.saveToLocalCache(); return { success: true }; }

  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean, docNo?: string, date?: string): Promise<{ success: boolean; id: string; message?: string }> {
      try {
          const supplier = this.suppliers.find(s => s.id === supplierId);
          if (!supplier && supplierId) return { success: false, id: '', message: 'المورد غير موجود' };
          const total = items.reduce((s, it) => s + (it.quantity * it.cost_price), 0);
          const invId = Math.random().toString(36).substring(7);
          const inv: PurchaseInvoice = { id: invId, invoice_number: `PUR-${Date.now().toString().slice(-6)}`, document_number: docNo, supplier_id: supplierId, date: date || new Date().toISOString(), total_amount: total, paid_amount: cashPaid, type: isReturn ? 'RETURN' : 'PURCHASE', items, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' };
          this.purchaseInvoices.push(inv);
          if (supplier) { if (isReturn) supplier.current_balance -= total; else supplier.current_balance += total; if (cashPaid > 0) { await this.addCashTransaction({ type: isReturn ? 'RECEIPT' : 'EXPENSE', category: 'SUPPLIER_PAYMENT', reference_id: supplier.id, related_name: supplier.name, amount: cashPaid, notes: `سداد فاتورة مشتريات #${inv.invoice_number}`, date: inv.date }); supplier.current_balance -= cashPaid; } }
          this.saveToLocalCache(); return { success: true, id: invId };
      } catch (err: any) { return { success: false, id: '', message: err.message }; }
  }

  async deletePurchaseInvoice(id: string, updateInventory: boolean = true, updateBalance: boolean = true): Promise<{ success: boolean; message?: string }> { 
      const inv = this.purchaseInvoices.find(i => i.id === id);
      if (!inv) return { success: false, message: 'الفاتورة غير موجودة' };
      if (updateBalance) { const supplier = this.suppliers.find(s => s.id === inv.supplier_id); if (supplier) { if (inv.type === 'PURCHASE') supplier.current_balance -= inv.total_amount; else supplier.current_balance += inv.total_amount; } }
      this.purchaseInvoices = this.purchaseInvoices.filter(i => i.id !== id); 
      this.saveToLocalCache(); return { success: true }; 
  }

  async createPurchaseOrder(supplierId: string, items: any[]) { const po: PurchaseOrder = { id: Math.random().toString(36).substring(7), order_number: `ORD-${Date.now().toString().slice(-6)}`, supplier_id: supplierId, date: new Date().toISOString(), order_status: 'PENDING', items, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }; this.purchaseOrders.push(po); this.saveToLocalCache(); return { success: true }; }
  async updatePurchaseOrderStatus(id: string, status: any) { const idx = this.purchaseOrders.findIndex(o => o.id === id); if (idx !== -1) { this.purchaseOrders[idx].order_status = status; this.saveToLocalCache(); } }
  async submitStockTake(adjs: any[]) { adjs.forEach(a => this.pendingAdjustments.push({ id: Math.random().toString(36).substring(7), ...a, date: new Date().toISOString(), adj_status: 'PENDING', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' })); this.saveToLocalCache(); }
  async approveAdjustment(id: string) { const idx = this.pendingAdjustments.findIndex(a => a.id === id); if (idx !== -1) { this.pendingAdjustments[idx].adj_status = 'APPROVED'; this.saveToLocalCache(); return true; } return false; }
  async rejectAdjustment(id: string) { const idx = this.pendingAdjustments.findIndex(a => a.id === id); if (idx !== -1) { this.pendingAdjustments[idx].adj_status = 'REJECTED'; this.saveToLocalCache(); return true; } return false; }
  async saveDailyClosing(data: any) { this.dailyClosings.push({ id: Math.random().toString(36).substring(7), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, status: 'ACTIVE' }); this.saveToLocalCache(); return true; }
  getDailySummary(date: string) { const sales = this.invoices.filter(i => i.date.startsWith(date) && i.type === 'SALE').reduce((s, i) => s + i.net_total, 0); const exp = this.cashTransactions.filter(t => t.date.startsWith(date) && t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0); const cash = this.getCashBalance(); return { cashSales: sales, expenses: exp, cashPurchases: 0, expectedCash: cash, openingCash: cash - (sales - exp), inventoryValue: 0 }; }
  async updateSettings(s: any) { this.settings = { ...this.settings, ...s }; this.saveToLocalCache(); return true; }
  async resetDatabase() { localStorage.removeItem('mizan_db'); window.location.reload(); }
  async clearAllSales() { this.invoices = []; this.saveToLocalCache(); }
  async resetCustomerAccounts() { this.customers.forEach(c => c.current_balance = 0); this.invoices = []; this.saveToLocalCache(); }
  async clearAllPurchases() { this.purchaseInvoices = []; this.saveToLocalCache(); }
  async clearAllOrders() { this.purchaseOrders = []; this.saveToLocalCache(); }
  async resetCashRegister() { this.cashTransactions = []; this.saveToLocalCache(); }
  async clearWarehouseStock(id: string) { this.batches = this.batches.filter(b => b.warehouse_id !== id); this.saveToLocalCache(); }
  async recalculateAllBalances() { console.log("Recalculating..."); }

  async syncFromCloud() {
    if (!isSupabaseConfigured) return;
    this.activeOperations++;
    this.notifySyncState();
    try {
        console.log('🔄 Citadel Engine: Starting Full Cloud Sync...');
        const [p, b, c, s, i, pi, t, w, r, dc, pa, po] = await Promise.all([
            this.fetchAllFromTable('products'),
            this.fetchAllFromTable('batches'),
            this.fetchAllFromTable('customers'),
            this.fetchAllFromTable('suppliers'),
            this.fetchAllFromTable('invoices'),
            this.fetchAllFromTable('purchase_invoices'),
            this.fetchAllFromTable('cash_transactions'),
            this.fetchAllFromTable('warehouses'),
            this.fetchAllFromTable('representatives'),
            this.fetchAllFromTable('daily_closings'),
            this.fetchAllFromTable('pending_adjustments'),
            this.fetchAllFromTable('purchase_orders')
        ]);
        
        this.products = p;
        this.batches = b;
        this.customers = c;
        this.suppliers = s;
        this.invoices = i;
        this.purchaseInvoices = pi;
        this.cashTransactions = t;
        this.warehouses = w;
        this.representatives = r;
        this.dailyClosings = dc;
        this.pendingAdjustments = pa;
        this.purchaseOrders = po;
        
        console.log('✅ Sync Completed:', p.length, 'Products loaded.');
        this.saveToLocalCache(true);
    } catch (err) {
        console.error('❌ Sync Failed:', err);
    } finally {
        this.activeOperations--;
        this.notifySyncState();
    }
  }

  getNextTransactionRef(type: any) { return `TX-${type.charAt(0)}-${Date.now().toString().slice(-6)}`; }
  getNextProductCode() { return `P-${Math.floor(1000 + Math.random() * 9000)}`; }
  addExpenseCategory(cat: string) { if (!this.settings.expenseCategories.includes(cat)) { this.settings.expenseCategories.push(cat); this.saveToLocalCache(); } }
  getABCAnalysis() { return { classifiedProducts: [] }; }
  getInventoryValuationReport() { return []; }
  exportDbData() { return JSON.stringify(this); }
  importDbData(json: string) { try { const d = JSON.parse(json); Object.assign(this, d); this.saveToLocalCache(true); return true; } catch { return false; } }
}

export const db = new Database();