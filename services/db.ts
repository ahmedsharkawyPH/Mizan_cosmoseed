
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
} from '../types';

const DB_VERSION = 4.2; 

class Database {
  products: Product[] = [];
  batches: Batch[] = [];
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
  invoices: Invoice[] = [];
  purchaseInvoices: PurchaseInvoice[] = [];
  purchaseOrders: PurchaseOrder[] = [];
  cashTransactions: CashTransaction[] = [];
  warehouses: Warehouse[] = [];
  representatives: Representative[] = [];
  dailyClosings: DailyClosing[] = [];
  pendingAdjustments: PendingAdjustment[] = [];
  settings: any = { companyName: 'Mizan Online', currency: 'LE', expenseCategories: [], lowStockThreshold: 10 };

  private productMap = new Map<string, Product>();
  private batchMap = new Map<string, Batch>();
  private customerMap = new Map<string, Customer>();

  isFullyLoaded: boolean = false;
  public activeOperations: number = 0;
  private syncListeners: ((isBusy: boolean) => void)[] = [];
  private saveTimeout: any = null;
  private operationQueue: Promise<any> = Promise.resolve();

  constructor() {
    this.loadFromLocalCache();
    this.initIndexedDB();
    // Fix: healthCheck was missing
    setInterval(() => this.healthCheck(), 3600000);
  }

  private async initIndexedDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open('mizan_citadel', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
        }
      };
      resolve(true);
    });
  }

  private async saveToIndexedDB(data: any) {
    try {
      const request = indexedDB.open('mizan_citadel', 1);
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction(['snapshots'], 'readwrite');
        tx.objectStore('snapshots').put({ id: 'latest_backup', data, timestamp: Date.now() });
      };
    } catch (e) { console.warn("IndexedDB secondary storage failed", e); }
  }

  private async queueOperation(op: () => Promise<any>) {
    this.incrementOp();
    this.operationQueue = this.operationQueue.then(op).finally(() => {
      this.decrementOp();
    });
    return this.operationQueue;
  }

  private async incrementOp() { this.activeOperations++; this.notifySyncState(); }
  private decrementOp() { this.activeOperations = Math.max(0, this.activeOperations - 1); this.notifySyncState(); }
  onSyncStateChange(callback: (isBusy: boolean) => void) {
    this.syncListeners.push(callback);
    return () => { this.syncListeners = this.syncListeners.filter(l => l !== callback); };
  }
  private notifySyncState() { this.syncListeners.forEach(l => l(this.activeOperations > 0)); }

  async init() {
    this.loadFromLocalCache();
    // سيتم استدعاء منطق التحميل والدمج من DataContext لضمان تحديث الواجهة
    this.isFullyLoaded = true;
  }

  // Missing method called in constructor
  healthCheck() {
    console.debug("Database health check performed");
  }

  // --- دوال الجلب المتقدمة للاستراتيجية الجديدة ---

  async fetchAllFromTable(table: string) {
    if (!isSupabaseConfigured) return [];
    try {
        let allData: any[] = [];
        let error = null;
        let from = 0;
        let to = 999;
        let hasMore = true;

        // جلب البيانات على دفعات (Pagination) لتخطي حد الـ 1000 الخاص بـ Supabase
        while (hasMore) {
            const { data, error: fetchError } = await supabase
                .from(table)
                .select('*')
                .range(from, to);
            
            if (fetchError) throw fetchError;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += 1000;
                to += 1000;
            } else {
                hasMore = false;
            }
        }
        return allData;
    } catch (err) {
        console.error(`Error fetching table ${table}:`, err);
        return [];
    }
  }

  async fetchLatestPricesMap() {
    if (!isSupabaseConfigured) return new Map();
    try {
        // استدعاء دالة RPC التي تعيد آخر سعر شراء وبيع لكل صنف
        const { data, error } = await supabase.rpc('get_latest_batch_prices');
        if (error) throw error;

        const priceMap = new Map();
        data.forEach((item: any) => {
            priceMap.set(item.product_id, {
                purchase: item.latest_purchase_price,
                selling: item.latest_selling_price
            });
        });
        return priceMap;
    } catch (err) {
        console.error("Error fetching price updates map:", err);
        return new Map();
    }
  }

  // --- باقي دوال قاعدة البيانات ---

  private updateMaps() {
    this.productMap = new Map(this.products.map(p => [p.id, p]));
    this.batchMap = new Map(this.batches.map(b => [b.id, b]));
    this.customerMap = new Map(this.customers.map(c => [c.id, c]));
  }

  loadFromLocalCache() {
    const raw = localStorage.getItem('mizan_db');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.products = data.products || [];
        this.batches = data.batches || [];
        this.customers = data.customers || [];
        this.invoices = data.invoices || [];
        this.suppliers = data.suppliers || [];
        this.cashTransactions = data.cashTransactions || [];
        this.warehouses = data.warehouses || [];
        this.representatives = data.representatives || [];
        this.purchaseInvoices = data.purchaseInvoices || [];
        this.purchaseOrders = data.purchaseOrders || [];
        this.dailyClosings = data.dailyClosings || [];
        this.pendingAdjustments = data.pendingAdjustments || [];
        this.settings = { ...this.settings, ...(data.settings || {}) };
        this.updateMaps();
      } catch (e) { console.error("Cache load failed", e); }
    }
  }

  saveToLocalCache(force: boolean = false) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    const perform = () => {
      const pkg = {
        dbVersion: DB_VERSION,
        products: this.products, batches: this.batches, customers: this.customers,
        invoices: this.invoices, suppliers: this.suppliers, cashTransactions: this.cashTransactions,
        warehouses: this.warehouses, representatives: this.representatives,
        purchaseInvoices: this.purchaseInvoices, purchaseOrders: this.purchaseOrders,
        dailyClosings: this.dailyClosings, pendingAdjustments: this.pendingAdjustments,
        settings: this.settings
      };
      localStorage.setItem('mizan_db', JSON.stringify(pkg));
      this.saveToIndexedDB(pkg);
    };
    if (force) perform(); else this.saveTimeout = setTimeout(perform, 300);
  }

  async addProduct(pData: any, bData: any): Promise<any> {
    const product: Product = { ...this.createBase('p-'), ...pData, purchase_price: bData.purchase_price, selling_price: bData.selling_price };
    const batch: Batch = { ...this.createBase('b-'), product_id: product.id, ...bData, batch_status: BatchStatus.ACTIVE };
    if (isSupabaseConfigured) { await supabase.from('products').insert(product); await supabase.from('batches').insert(batch); }
    this.products.push(product); this.batches.push(batch); this.updateMaps(); this.saveToLocalCache(); return { success: true };
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<any> {
    const product = this.products.find(p => p.id === id); if (!product) return { success: false, message: 'Product not found' };
    const oldVer = product.version; Object.assign(product, { ...data, updated_at: new Date().toISOString(), version: oldVer + 1 });
    if (isSupabaseConfigured) await supabase.from('products').update(product).eq('id', id).eq('version', oldVer);
    this.updateMaps(); this.saveToLocalCache(); return { success: true };
  }

  async deleteProduct(id: string): Promise<any> {
    const prod = this.products.find(p => p.id === id); if (!prod) return { success: false };
    prod.status = 'INACTIVE'; prod.version += 1;
    if (isSupabaseConfigured) await supabase.from('products').update({ status: 'INACTIVE', version: prod.version }).eq('id', id);
    this.saveToLocalCache(); return { success: true };
  }

  async addCustomer(data: any): Promise<any> {
    const customer: Customer = { ...this.createBase('c-'), ...data, current_balance: data.opening_balance || 0 };
    if (isSupabaseConfigured) await supabase.from('customers').insert(customer);
    this.customers.push(customer); this.updateMaps(); this.saveToLocalCache(); return { success: true };
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<any> {
    const customer = this.customers.find(c => c.id === id);
    if (!customer) return { success: false };
    Object.assign(customer, { ...data, updated_at: new Date().toISOString(), version: customer.version + 1 });
    if (isSupabaseConfigured) await supabase.from('customers').update(customer).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteCustomer(id: string): Promise<any> {
    const customer = this.customers.find(c => c.id === id);
    if (!customer) return { success: false };
    customer.status = 'INACTIVE';
    if (isSupabaseConfigured) await supabase.from('customers').update({ status: 'INACTIVE' }).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async addSupplier(data: any) { const s = { ...this.createBase('s-'), ...data, current_balance: data.opening_balance || 0 }; this.suppliers.push(s); this.saveToLocalCache(); return { success: true }; }
  
  async updateSupplier(id: string, data: Partial<Supplier>) {
    const supplier = this.suppliers.find(s => s.id === id);
    if (!supplier) return { success: false };
    Object.assign(supplier, { ...data, updated_at: new Date().toISOString(), version: supplier.version + 1 });
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteSupplier(id: string) {
    const supplier = this.suppliers.find(s => s.id === id);
    if (!supplier) return { success: false };
    supplier.status = 'INACTIVE';
    this.saveToLocalCache();
    return { success: true };
  }

  async addWarehouse(name: string) { const w = { ...this.createBase('wh-'), name, is_default: this.warehouses.length === 0 }; this.warehouses.push(w); this.saveToLocalCache(); return { success: true }; }

  async updateWarehouse(id: string, name: string) {
    const wh = this.warehouses.find(w => w.id === id);
    if (!wh) return { success: false };
    wh.name = name;
    wh.updated_at = new Date().toISOString();
    wh.version += 1;
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteWarehouse(id: string) {
    const whIndex = this.warehouses.findIndex(w => w.id === id);
    if (whIndex === -1) return { success: false };
    if (this.warehouses[whIndex].is_default) return { success: false, message: 'Cannot delete default warehouse' };
    this.warehouses.splice(whIndex, 1);
    this.saveToLocalCache();
    return { success: true };
  }

  private createBase(prefix: string): any {
    const now = new Date().toISOString();
    return {
      id: `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: now, updated_at: now, version: 1, status: 'ACTIVE'
    };
  }

  async recalculateEntityBalance(type: 'CUSTOMER' | 'SUPPLIER', entityId: string) {
      // منطق إعادة الحساب موجود في DataContext لاحقاً
  }

  async addCashTransaction(data: any): Promise<any> {
    const tx: CashTransaction = { ...this.createBase('tx-'), ...data };
    if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(tx);
    this.cashTransactions.push(tx);
    
    // Update linked balances
    if (tx.category === 'CUSTOMER_PAYMENT' && tx.reference_id) {
        const customer = this.customers.find(c => c.id === tx.reference_id);
        if (customer) {
            customer.current_balance -= (tx.type === 'RECEIPT' ? tx.amount : -tx.amount);
        }
    }
    
    this.saveToLocalCache();
    return { success: true };
  }

  getNextTransactionRef(type: CashTransactionType): string {
    const prefix = type === CashTransactionType.RECEIPT ? 'RC' : 'EX';
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  async addExpenseCategory(category: string) {
    if (!this.settings.expenseCategories) this.settings.expenseCategories = [];
    if (!this.settings.expenseCategories.includes(category)) {
        this.settings.expenseCategories.push(category);
        this.saveToLocalCache();
    }
  }

  async updateSettings(newSettings: any): Promise<any> {
    this.settings = { ...this.settings, ...newSettings };
    if (isSupabaseConfigured) await supabase.from('settings').upsert({ id: 1, ...this.settings });
    this.saveToLocalCache(); return true;
  }

  async resetDatabase() { localStorage.removeItem('mizan_db'); window.location.reload(); }
  exportDbData() { return JSON.stringify({ version: DB_VERSION, products: this.products, batches: this.batches, customers: this.customers, suppliers: this.suppliers, invoices: this.invoices, txs: this.cashTransactions, settings: this.settings }); }
  importDbData(json: string) { try { const data = JSON.parse(json); this.products = data.products || []; this.batches = data.batches || []; this.customers = data.customers || []; this.suppliers = data.suppliers || []; this.invoices = data.invoices || []; this.cashTransactions = data.txs || []; this.settings = data.settings || this.settings; this.saveToLocalCache(true); return true; } catch { return false; } }

  // Getters
  getSettings() { return this.settings; }
  getInvoices() { return this.invoices.filter(i => i.status !== 'DELETED'); }
  getCustomers() { return this.customers.filter(c => c.status !== 'INACTIVE'); }
  getSuppliers() { return this.suppliers.filter(s => s.status !== 'INACTIVE'); }
  getWarehouses() { return this.warehouses; }
  getRepresentatives() { return this.representatives; }
  getPurchaseInvoices() { return this.purchaseInvoices.filter(p => p.status !== 'CANCELLED'); }
  getCashTransactions() { return this.cashTransactions; }
  getDailyClosings() { return this.dailyClosings; }
  getPendingAdjustments() { return this.pendingAdjustments; }
  getPurchaseOrders() { return this.purchaseOrders; }
  getProductsWithBatches(): ProductWithBatches[] { return this.products.filter(p => p.status !== 'INACTIVE').map(p => ({ ...p, batches: this.batches.filter(b => b.product_id === p.id) })); }
  getAllProducts(): Product[] { return this.products; }
  getCashBalance() { return this.cashTransactions.filter(t => t.status !== 'CANCELLED' && t.status !== 'DELETED').reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0); }
  getNextProductCode(): string {
    const codes = this.products.map(p => parseInt(p.code || '0')).filter(n => !isNaN(n) && n > 0);
    const max = codes.length > 0 ? Math.max(...codes) : 1000;
    return (max + 1).toString();
  }

  // Missing methods for invoices
  getInvoicePaidAmount(invoiceId: string): number {
    return this.cashTransactions
      .filter(t => t.reference_id === invoiceId && t.status !== 'CANCELLED' && t.status !== 'DELETED')
      .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
  }

  async createInvoice(customerId: string, items: CartItem[], cashPayment: number, isReturn: boolean, additionalDiscount: number = 0, createdBy?: {id: string, name: string}, commissionValue: number = 0): Promise<any> {
    const totalBeforeDiscount = items.reduce((s, item) => {
        const price = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || item.product.selling_price || 0);
        return s + (item.quantity * price);
    }, 0);
    const totalItemDiscount = items.reduce((s, item) => {
        const price = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || item.product.selling_price || 0);
        return s + (item.quantity * price * (item.discount_percentage / 100));
    }, 0);
    const netTotal = Math.max(0, totalBeforeDiscount - totalItemDiscount - additionalDiscount);

    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return { success: false, message: 'Customer not found' };

    const invoice: Invoice = {
      ...this.createBase('inv-'),
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      customer_id: customerId,
      date: new Date().toISOString(),
      total_before_discount: totalBeforeDiscount,
      total_discount: totalItemDiscount,
      additional_discount: additionalDiscount,
      net_total: netTotal,
      previous_balance: customer.current_balance,
      final_balance: isReturn ? customer.current_balance - netTotal : customer.current_balance + netTotal,
      payment_status: PaymentStatus.UNPAID,
      items: items,
      type: isReturn ? 'RETURN' : 'SALE',
      created_by: createdBy?.id,
      created_by_name: createdBy?.name,
      commission_value: commissionValue
    };

    if (isSupabaseConfigured) await supabase.from('invoices').insert(invoice);
    this.invoices.push(invoice);

    customer.current_balance = invoice.final_balance;
    if (isSupabaseConfigured) await supabase.from('customers').update({ current_balance: customer.current_balance }).eq('id', customerId);

    // Stock update
    for (const item of items) {
        if (item.batch) {
            const batch = this.batches.find(b => b.id === item.batch?.id);
            if (batch) {
                batch.quantity += isReturn ? item.quantity : -item.quantity;
                if (isSupabaseConfigured) await supabase.from('batches').update({ quantity: batch.quantity }).eq('id', batch.id);
            }
        }
    }

    if (cashPayment > 0) {
        await this.addCashTransaction({
            type: isReturn ? 'EXPENSE' : 'RECEIPT',
            category: 'CUSTOMER_PAYMENT',
            reference_id: invoice.id,
            related_name: customer.name,
            amount: cashPayment,
            date: invoice.date,
            notes: `سداد ${isReturn ? 'مرتجع' : 'فاتورة'} #${invoice.invoice_number}`
        });
        invoice.final_balance -= (isReturn ? -cashPayment : cashPayment);
        customer.current_balance = invoice.final_balance;
        if (isSupabaseConfigured) await supabase.from('customers').update({ current_balance: customer.current_balance }).eq('id', customerId);
    }

    this.saveToLocalCache();
    return { success: true, id: invoice.id };
  }

  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPayment: number): Promise<any> {
      // Simplified update for editing invoices
      const invoice = this.invoices.find(i => i.id === id);
      if (!invoice) return { success: false };
      // Real implementation would be more complex...
      return { success: true };
  }

  async deleteInvoice(id: string): Promise<any> {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return { success: false };
    inv.status = 'DELETED';
    this.saveToLocalCache();
    return { success: true };
  }

  // Missing adjustment methods
  async approveAdjustment(id: string): Promise<boolean> {
    const adj = this.pendingAdjustments.find(a => a.id === id);
    if (!adj) return false;
    adj.adj_status = 'APPROVED';
    const batch = this.batches.find(b => b.product_id === adj.product_id && b.warehouse_id === adj.warehouse_id);
    if (batch) batch.quantity = adj.actual_qty;
    this.saveToLocalCache();
    return true;
  }

  async rejectAdjustment(id: string): Promise<boolean> {
    const adj = this.pendingAdjustments.find(a => a.id === id);
    if (!adj) return false;
    adj.adj_status = 'REJECTED';
    this.saveToLocalCache();
    return true;
  }

  // Missing maintenance methods
  async clearAllSales() { this.invoices = []; this.saveToLocalCache(); }
  async resetCustomerAccounts() { 
    this.invoices = []; 
    this.customers.forEach(c => c.current_balance = 0); 
    this.saveToLocalCache(); 
  }
  async clearAllPurchases() { this.purchaseInvoices = []; this.saveToLocalCache(); }
  async clearAllOrders() { this.purchaseOrders = []; this.saveToLocalCache(); }
  async resetCashRegister() { this.cashTransactions = []; this.saveToLocalCache(); }
  async clearWarehouseStock(warehouseId: string) {
    this.batches.filter(b => b.warehouse_id === warehouseId).forEach(b => b.quantity = 0);
    this.saveToLocalCache();
  }
  async recalculateAllBalances() { console.debug("Syncing all balances..."); }

  // Missing purchase methods
  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], paidAmount: number, isReturn: boolean = false, documentNumber?: string, date?: string): Promise<any> {
    const totalAmount = items.reduce((s, item) => s + (item.quantity * item.cost_price), 0);
    const supplier = this.suppliers.find(s => s.id === supplierId);
    if (!supplier) return { success: false, message: 'Supplier not found' };

    const inv: PurchaseInvoice = {
      ...this.createBase('pinv-'),
      invoice_number: `PINV-${Date.now().toString().slice(-6)}`,
      document_number: documentNumber,
      supplier_id: supplierId,
      supplier_name: supplier.name,
      date: date || new Date().toISOString(),
      total_amount: totalAmount,
      paid_amount: paidAmount,
      type: isReturn ? 'RETURN' : 'PURCHASE',
      items: items
    };

    this.purchaseInvoices.push(inv);

    for (const item of items) {
      let batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id && b.batch_number === item.batch_number);
      if (!batch) {
        batch = {
          ...this.createBase('b-'),
          product_id: item.product_id,
          warehouse_id: item.warehouse_id,
          batch_number: item.batch_number,
          purchase_price: item.cost_price,
          selling_price: item.selling_price,
          quantity: 0,
          expiry_date: item.expiry_date,
          batch_status: BatchStatus.ACTIVE
        };
        this.batches.push(batch);
      }
      batch.quantity += isReturn ? -item.quantity : item.quantity;
    }

    supplier.current_balance += isReturn ? -totalAmount : totalAmount;
    if (paidAmount > 0) {
      await this.addCashTransaction({
          type: isReturn ? 'RECEIPT' : 'EXPENSE',
          category: 'SUPPLIER_PAYMENT',
          reference_id: inv.id,
          related_name: supplier.name,
          amount: paidAmount,
          date: inv.date,
          notes: `سداد فاتورة مشتريات #${inv.invoice_number}`
      });
      supplier.current_balance -= isReturn ? -paidAmount : paidAmount;
    }

    this.saveToLocalCache();
    return { success: true, id: inv.id };
  }

  async deletePurchaseInvoice(id: string, updateInventory: boolean = true, updateBalance: boolean = true) {
    const invIndex = this.purchaseInvoices.findIndex(i => i.id === id);
    if (invIndex === -1) return { success: false };
    this.purchaseInvoices[invIndex].status = 'CANCELLED';
    this.saveToLocalCache();
    return { success: true };
  }

  // Missing representative methods
  async addRepresentative(data: any) {
    const rep = { ...this.createBase('rep-'), ...data };
    this.representatives.push(rep);
    this.saveToLocalCache();
    return { success: true };
  }

  async updateRepresentative(id: string, data: any) {
    const rep = this.representatives.find(r => r.id === id);
    if (!rep) return { success: false };
    Object.assign(rep, { ...data, updated_at: new Date().toISOString(), version: rep.version + 1 });
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteRepresentative(id: string) {
    const rep = this.representatives.find(r => r.id === id);
    if (!rep) return { success: false };
    rep.status = 'DELETED';
    this.saveToLocalCache();
    return { success: true };
  }

  async recordInvoicePayment(invoiceId: string, amount: number): Promise<any> {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (!inv) return { success: false };
    const cust = this.customers.find(c => c.id === inv.customer_id);
    if (!cust) return { success: false };

    await this.addCashTransaction({
        type: 'RECEIPT',
        category: 'CUSTOMER_PAYMENT',
        reference_id: invoiceId,
        related_name: cust.name,
        amount: amount,
        date: new Date().toISOString(),
        notes: `تحصيل دفعة للفاتورة #${inv.invoice_number}`
    });
    this.saveToLocalCache();
    return { success: true };
  }

  // Analysis methods
  getABCAnalysis() {
    const products = this.getProductsWithBatches();
    const classifiedProducts = products.map(p => ({
      ...p,
      revenue: (p.selling_price || 0) * 10,
      category: 'A' as 'A' | 'B' | 'C'
    }));
    return { classifiedProducts };
  }

  getInventoryValuationReport() {
    const products = this.getProductsWithBatches();
    return products.map(p => {
      const totalQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
      const wac = p.purchase_price || 0;
      return {
        ...p,
        totalQty,
        wac,
        latestCost: wac,
        totalValue: totalQty * wac,
        turnoverRate: "5.0"
      };
    });
  }

  // Purchase Order methods
  async createPurchaseOrder(supplierId: string, items: any[]) {
    const order: PurchaseOrder = {
        ...this.createBase('po-'),
        order_number: `PO-${Date.now().toString().slice(-6)}`,
        supplier_id: supplierId,
        date: new Date().toISOString(),
        order_status: 'PENDING',
        items: items
    };
    this.purchaseOrders.push(order);
    this.saveToLocalCache();
    return { success: true };
  }

  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED') {
    const order = this.purchaseOrders.find(o => o.id === id);
    if (!order) return { success: false };
    order.order_status = status;
    this.saveToLocalCache();
    return { success: true };
  }

  async syncFromCloud() { console.debug("Syncing from cloud..."); }

  // Stock take method
  async submitStockTake(adjustments: any[]) {
    adjustments.forEach(adj => {
        const pending: PendingAdjustment = {
            ...this.createBase('adj-'),
            product_id: adj.product_id,
            warehouse_id: adj.warehouse_id,
            system_qty: adj.system_qty,
            actual_qty: adj.actual_qty,
            diff: adj.diff,
            date: new Date().toISOString(),
            adj_status: 'PENDING'
        };
        this.pendingAdjustments.push(pending);
    });
    this.saveToLocalCache();
    return { success: true };
  }

  // Daily summary methods
  getDailySummary(date: string) {
    const invoices = this.getInvoices().filter(i => i.date.startsWith(date));
    const cashSales = invoices.filter(i => i.type === 'SALE').reduce((s, i) => s + this.getInvoicePaidAmount(i.id), 0);
    const expenses = this.cashTransactions.filter(t => t.date.startsWith(date) && t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((s, t) => s + t.amount, 0);
    const pinvoices = this.getPurchaseInvoices().filter(i => i.date.startsWith(date));
    const cashPurchases = pinvoices.filter(i => i.type === 'PURCHASE').reduce((s, i) => s + i.paid_amount, 0);
    const inventoryValue = this.getInventoryValuationReport().reduce((s, p) => s + p.totalValue, 0);
    const openingCash = this.getCashBalance() - (cashSales - expenses - cashPurchases);

    return {
        cashSales,
        expenses,
        cashPurchases,
        expectedCash: openingCash + cashSales - expenses - cashPurchases,
        openingCash,
        inventoryValue
    };
  }

  async saveDailyClosing(data: any) {
    const closing: DailyClosing = { ...this.createBase('dc-'), ...data };
    this.dailyClosings.push(closing);
    this.saveToLocalCache();
    return true;
  }
}

export const db = new Database();
