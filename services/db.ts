
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
} from '../types';

const DB_VERSION = 4.1; // Fortress Edition

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

  constructor() {
    this.loadFromLocalCache();
  }

  // --- CORE HELPERS (V4.1 SECURITY) ---

  private createBase(prefix: string): any {
    const now = new Date().toISOString();
    return {
      id: `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: now,
      updated_at: now,
      version: 1,
      status: 'ACTIVE'
    };
  }

  private async safeCloudOperation(fn: () => Promise<any>) {
    try {
      this.incrementOp();
      return await fn();
    } catch (e) {
      console.error("Cloud operation failed:", e);
      throw e;
    } finally {
      this.decrementOp();
    }
  }

  private validateStockAvailability(items: CartItem[], isReturn: boolean) {
    if (isReturn) return;
    for (const item of items) {
      const batchId = item.batch?.id;
      if (!batchId) continue;
      const batch = this.batchMap.get(batchId);
      if (!batch) throw new Error(`التشغيلة المختارة للصنف ${item.product.name} غير موجودة.`);
      const requested = (item.quantity || 0) + (item.bonus_quantity || 0);
      if (batch.quantity < requested) {
        throw new Error(`عفواً، الرصيد لا يكفي للصنف: ${item.product.name}. المتاح: ${batch.quantity}`);
      }
    }
  }

  private generateSimpleSeq(list: any[], prefix: string, key: string): string {
    const numbers = list
      .map(item => {
        const val = item[key] || '';
        const match = val.match(new RegExp(`^${prefix}(\\d+)$`));
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    const nextSeq = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
    return `${prefix}${nextSeq}`;
  }

  onSyncStateChange(callback: (isBusy: boolean) => void) {
    this.syncListeners.push(callback);
    return () => { this.syncListeners = this.syncListeners.filter(l => l !== callback); };
  }

  private notifySyncState() {
    this.syncListeners.forEach(l => l(this.activeOperations > 0));
  }

  private incrementOp() { this.activeOperations++; this.notifySyncState(); }
  private decrementOp() { this.activeOperations = Math.max(0, this.activeOperations - 1); this.notifySyncState(); }

  async init() {
    if (isSupabaseConfigured) await this.syncFromCloud();
    this.isFullyLoaded = true;
  }

  private updateMaps() {
    this.productMap = new Map(this.products.map(p => [p.id, p]));
    this.batchMap = new Map(this.batches.map(b => [b.id, b]));
    this.customerMap = new Map(this.customers.map(c => [c.id, c]));
  }

  async syncFromCloud() {
    if (!isSupabaseConfigured) return;
    try {
        this.incrementOp();
        const [
          { data: p }, { data: b }, { data: c }, { data: inv }, { data: tx },
          { data: wh }, { data: rep }, { data: sup }, { data: pinv },
          { data: po }, { data: dc }, { data: pa }, { data: sett }
        ] = await Promise.all([
          supabase.from('products').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('invoices').select('*'),
          supabase.from('cash_transactions').select('*'),
          supabase.from('warehouses').select('*'),
          supabase.from('representatives').select('*'),
          supabase.from('suppliers').select('*'),
          supabase.from('purchase_invoices').select('*'),
          supabase.from('purchase_orders').select('*'),
          supabase.from('daily_closings').select('*'),
          supabase.from('pending_adjustments').select('*'),
          supabase.from('settings').select('*').single()
        ]);

        if (p) this.products = p;
        if (b) this.batches = b;
        if (c) this.customers = c;
        if (inv) this.invoices = inv;
        if (tx) this.cashTransactions = tx;
        if (wh) this.warehouses = wh;
        if (rep) this.representatives = rep;
        if (sup) this.suppliers = sup;
        if (pinv) this.purchaseInvoices = pinv;
        if (po) this.purchaseOrders = po;
        if (dc) this.dailyClosings = dc;
        if (pa) this.pendingAdjustments = pa;
        if (sett) this.settings = sett;

        this.updateMaps();
        this.saveToLocalCache(true);
    } finally {
        this.decrementOp();
    }
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
    };
    if (force) perform(); else this.saveTimeout = setTimeout(perform, 300);
  }

  // --- RECALCULATE ENGINE (O(N) PERFORMANCE) ---

  recalculateAllBalances() {
    const customerInvoiceMap = new Map<string, Invoice[]>();
    const supplierInvoiceMap = new Map<string, PurchaseInvoice[]>();
    const txMap = new Map<string, CashTransaction[]>();

    this.invoices.forEach(inv => {
      if (inv.status === 'ACTIVE') {
        if (!customerInvoiceMap.has(inv.customer_id)) customerInvoiceMap.set(inv.customer_id, []);
        customerInvoiceMap.get(inv.customer_id)!.push(inv);
      }
    });

    this.purchaseInvoices.forEach(p => {
      if (p.status === 'ACTIVE') {
        if (!supplierInvoiceMap.has(p.supplier_id)) supplierInvoiceMap.set(p.supplier_id, []);
        supplierInvoiceMap.get(p.supplier_id)!.push(p);
      }
    });

    this.cashTransactions.forEach(t => {
      if (t.status === 'CANCELLED' || !t.reference_id) return;
      if (!txMap.has(t.reference_id)) txMap.set(t.reference_id, []);
      txMap.get(t.reference_id)!.push(t);
    });

    this.customers.forEach(c => {
      const invs = customerInvoiceMap.get(c.id) || [];
      const sales = invs.filter(i => i.type === 'SALE').reduce((s, i) => s + i.net_total, 0);
      const returns = invs.filter(i => i.type === 'RETURN').reduce((s, i) => s + i.net_total, 0);
      
      let paid = 0;
      let refunded = 0;
      
      invs.forEach(inv => {
        const txs = txMap.get(inv.id) || [];
        paid += txs.filter(t => t.type === 'RECEIPT' && t.category === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);
        refunded += txs.filter(t => t.type === 'EXPENSE' && t.category === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);
      });

      const directTxs = txMap.get(c.id) || [];
      paid += directTxs.filter(t => t.type === 'RECEIPT' && t.category === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);
      refunded += directTxs.filter(t => t.type === 'EXPENSE' && t.category === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);

      c.current_balance = (c.opening_balance || 0) + sales - returns - paid + refunded;
    });

    this.suppliers.forEach(s => {
      const pinvs = supplierInvoiceMap.get(s.id) || [];
      const purchases = pinvs.filter(p => p.type === 'PURCHASE').reduce((sum, p) => sum + p.total_amount, 0);
      const returns = pinvs.filter(p => p.type === 'RETURN').reduce((sum, p) => sum + p.total_amount, 0);
      
      let paid = 0;
      pinvs.forEach(p => {
          const txs = txMap.get(p.id) || [];
          paid += txs.filter(t => t.type === 'EXPENSE' && t.category === 'SUPPLIER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
      });
      
      const directTxs = txMap.get(s.id) || [];
      paid += directTxs.filter(t => t.type === 'EXPENSE' && t.category === 'SUPPLIER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);

      s.current_balance = (s.opening_balance || 0) + purchases - returns - paid;
    });

    this.saveToLocalCache();
  }

  // --- Invoice Logic (V4.1 Snapshot Rollback & Optimistic Lock) ---

  async createInvoice(customer_id: string, items: CartItem[], cash_paid: number, is_return: boolean, disc: number, creator: any, commission: number = 0): Promise<any> {
    try {
      this.validateStockAvailability(items, is_return);
      
      const subtotal = items.reduce((s, i) => s + (i.quantity * (i.unit_price || 0)), 0);
      const itemDisc = items.reduce((s, i) => s + (i.quantity * (i.unit_price || 0) * (i.discount_percentage / 100)), 0);
      const net = Math.max(0, subtotal - itemDisc - disc);
      const customer = this.customerMap.get(customer_id);
      if (!customer) throw new Error("Customer not found");

      const invoice: Invoice = {
        ...this.createBase('inv-'),
        invoice_number: this.generateSimpleSeq(this.invoices, is_return ? 'SR' : 'S', 'invoice_number'),
        customer_id, created_by: creator?.id, created_by_name: creator?.name,
        date: new Date().toISOString(), total_before_discount: subtotal, total_discount: itemDisc,
        additional_discount: disc, commission_value: commission, net_total: net,
        previous_balance: customer.current_balance,
        final_balance: customer.current_balance + (is_return ? -net : net),
        payment_status: PaymentStatus.UNPAID, items, type: is_return ? 'RETURN' : 'SALE'
      };

      await this.safeCloudOperation(async () => {
          if (isSupabaseConfigured) {
              const { error } = await supabase.from('invoices').insert(invoice);
              if (error) throw error;
          }
      });

      items.forEach(item => {
          const b = this.batchMap.get(item.batch?.id || '');
          if (b) b.quantity += is_return ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
      });
      
      this.invoices.push(invoice);
      if (cash_paid > 0) await this.recordInvoicePayment(invoice.id, cash_paid);
      
      this.recalculateAllBalances();
      return { success: true, id: invoice.id };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  async updateInvoice(id: string, customer_id: string, newItems: CartItem[], cash_paid: number): Promise<any> {
      const invoice = this.invoices.find(i => i.id === id);
      if (!invoice) return { success: false, message: 'Invoice not found' };

      // Snapshot for memory rollback
      const relevantBatchIds = Array.from(new Set([
          ...invoice.items.map(it => it.batch?.id),
          ...newItems.map(it => it.batch?.id)
      ])).filter(Boolean) as string[];
      
      const stockSnapshot = new Map(relevantBatchIds.map(bid => [bid, this.batchMap.get(bid)!.quantity]));

      try {
        // 1. Reverse old stock
        invoice.items.forEach(item => {
          const b = this.batchMap.get(item.batch?.id || '');
          if (b) b.quantity += (invoice.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity));
        });

        // 2. Validate and apply new stock
        this.validateStockAvailability(newItems, invoice.type === 'RETURN');
        newItems.forEach(item => {
          const b = this.batchMap.get(item.batch?.id || '');
          if (b) b.quantity -= (invoice.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity));
        });

        // 3. Update Invoice Data & Optimistic Lock Increment
        const oldVersion = invoice.version;
        const subtotal = newItems.reduce((s, i) => s + (i.quantity * (i.unit_price || 0)), 0);
        const itemDisc = newItems.reduce((s, i) => s + (i.quantity * (i.unit_price || 0) * (i.discount_percentage / 100)), 0);
        const net = Math.max(0, subtotal - itemDisc - (invoice.additional_discount || 0));

        invoice.customer_id = customer_id;
        invoice.items = newItems;
        invoice.total_before_discount = subtotal;
        invoice.total_discount = itemDisc;
        invoice.net_total = net;
        invoice.updated_at = new Date().toISOString();
        invoice.version += 1;

        await this.safeCloudOperation(async () => {
            if (isSupabaseConfigured) {
                const { error, count } = await supabase.from('invoices')
                    .update(invoice)
                    .eq('id', id)
                    .eq('version', oldVersion); // OPTIMISTIC LOCKING
                
                if (error) throw error;
                if (count === 0) throw new Error("تم تعديل هذه الفاتورة من قبل مستخدم آخر، يرجى تحديث الصفحة.");
            }
        });

        this.recalculateAllBalances();
        return { success: true, id: invoice.id };
      } catch (e: any) {
          // MEMORY ROLLBACK - Instant & Safe
          stockSnapshot.forEach((qty, bid) => {
              const b = this.batchMap.get(bid);
              if (b) b.quantity = qty;
          });
          return { success: false, message: e.message };
      }
  }

  async deleteInvoice(id: string): Promise<any> {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return { success: false };
    
    inv.items.forEach(item => {
        const b = this.batchMap.get(item.batch?.id || '');
        if (b) b.quantity += inv.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
    });

    inv.status = 'CANCELLED';
    inv.updated_at = new Date().toISOString();
    inv.version += 1;

    if (isSupabaseConfigured) {
        await supabase.from('invoices').update({ status: 'CANCELLED', version: inv.version }).eq('id', id);
        // Soft cancel cash transactions instead of zeroing amount
        await supabase.from('cash_transactions').update({ status: 'CANCELLED', notes: 'إلغاء تابع للفاتورة' }).eq('reference_id', id);
    }

    this.cashTransactions.forEach(t => {
        if(t.reference_id === id) t.status = 'CANCELLED';
    });

    this.recalculateAllBalances();
    return { success: true };
  }

  // --- Financial Support Methods (O(N) Optimized) ---

  getInvoicePaidAmount(invId: string) {
      return this.cashTransactions
        .filter(t => t.reference_id === invId && t.status !== 'CANCELLED')
        .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
  }

  getDailySummary(date: string) {
    const todayStart = new Date(date);
    todayStart.setHours(0,0,0,0);
    
    const txs = this.cashTransactions.filter(t => t.date.startsWith(date) && t.status !== 'CANCELLED');
    const pinvs = this.purchaseInvoices.filter(p => p.date.startsWith(date) && p.status !== 'CANCELLED');
    
    const cashSales = txs.filter(t => t.type === 'RECEIPT' && t.category === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((s, t) => s + t.amount, 0);
    const cashPurchases = pinvs.reduce((s, p) => s + p.paid_amount, 0);
    
    const openingCash = this.cashTransactions
        .filter(t => new Date(t.date) < todayStart && t.status !== 'CANCELLED')
        .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
        
    const expectedCash = openingCash + cashSales - expenses - cashPurchases;
    const valuation = this.getInventoryValuationReport();
    const inventoryValue = valuation.reduce((s, p) => s + p.totalValue, 0);
    
    return { openingCash, cashSales, expenses, cashPurchases, expectedCash, inventoryValue };
  }

  getInventoryValuationReport() {
    const soldQtyMap = new Map<string, number>();
    this.invoices.forEach(inv => { 
        if(inv.type === 'SALE' && inv.status === 'ACTIVE') {
            inv.items.forEach(it => soldQtyMap.set(it.product.id, (soldQtyMap.get(it.product.id) || 0) + it.quantity)); 
        }
    });

    const batchMapByProduct = new Map<string, Batch[]>();
    this.batches.forEach(b => {
        if (!batchMapByProduct.has(b.product_id)) batchMapByProduct.set(b.product_id, []);
        batchMapByProduct.get(b.product_id)!.push(b);
    });

    return this.products.filter(p => p.status !== 'INACTIVE').map(p => {
      const pBatches = batchMapByProduct.get(p.id) || [];
      const totalQty = pBatches.reduce((s, b) => s + b.quantity, 0);
      
      const latestCost = pBatches.length > 0 ? [...pBatches].sort((a,b) => b.version - a.version)[0].purchase_price : (p.purchase_price || 0);
      const totalActualValue = pBatches.reduce((sum, b) => sum + (b.purchase_price * b.quantity), 0);
      const wac = totalQty > 0 ? totalActualValue / totalQty : latestCost;
      
      const sold = soldQtyMap.get(p.id) || 0;
      const turnoverRate = totalQty > 0 ? (sold / totalQty).toFixed(1) : "0.0";

      return { id: p.id, name: p.name, code: p.code || '', totalQty, wac, latestCost, totalValue: totalActualValue, turnoverRate };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }

  // --- CRUD (V4.1 SOFT DELETE IMPLEMENTATION) ---

  async deleteProduct(id: string): Promise<any> {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return { success: false };
    
    prod.status = 'INACTIVE';
    prod.updated_at = new Date().toISOString();
    prod.version += 1;

    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('products').update({ status: 'INACTIVE', version: prod.version }).eq('id', id);
    });
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteCustomer(id: string): Promise<any> {
    const cust = this.customers.find(c => c.id === id);
    if (!cust) return { success: false };

    cust.status = 'INACTIVE';
    cust.updated_at = new Date().toISOString();
    cust.version += 1;

    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('customers').update({ status: 'INACTIVE', version: cust.version }).eq('id', id);
    });
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteSupplier(id: string): Promise<any> {
    const supp = this.suppliers.find(s => s.id === id);
    if (!supp) return { success: false };

    supp.status = 'INACTIVE';
    supp.updated_at = new Date().toISOString();
    supp.version += 1;

    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('suppliers').update({ status: 'INACTIVE', version: supp.version }).eq('id', id);
    });
    this.saveToLocalCache();
    return { success: true };
  }

  // Common Getters & Adders
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

  getProductsWithBatches(): ProductWithBatches[] {
      return this.products.filter(p => p.status !== 'INACTIVE').map(p => ({ ...p, batches: this.batches.filter(b => b.product_id === p.id) }));
  }

  getCashBalance() {
      return this.cashTransactions.filter(t => t.status !== 'CANCELLED').reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
  }

  async addCashTransaction(data: any): Promise<any> {
    const tx: CashTransaction = { ...this.createBase('tx-'), ...data, ref_number: data.ref_number || this.getNextTransactionRef(data.type) };
    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(tx);
    });
    this.cashTransactions.push(tx);
    this.recalculateAllBalances();
    return { success: true };
  }

  async addProduct(pData: any, bData: any): Promise<any> {
    const product: Product = { ...this.createBase('p-'), ...pData, purchase_price: bData.purchase_price, selling_price: bData.selling_price };
    const batch: Batch = { ...this.createBase('b-'), product_id: product.id, ...bData, batch_status: BatchStatus.ACTIVE };
    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) {
            await supabase.from('products').insert(product);
            await supabase.from('batches').insert(batch);
        }
    });
    this.products.push(product);
    this.batches.push(batch);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<any> {
    const product = this.products.find(p => p.id === id);
    if (!product) return { success: false, message: 'Product not found' };
    const oldVer = product.version;
    Object.assign(product, { ...data, updated_at: new Date().toISOString(), version: oldVer + 1 });
    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) {
            const { count } = await supabase.from('products').update(product).eq('id', id).eq('version', oldVer);
            if (count === 0) throw new Error("Conflict Detected");
        }
    });
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async addCustomer(data: any): Promise<any> {
    const customer: Customer = { ...this.createBase('c-'), ...data, current_balance: data.opening_balance || 0 };
    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('customers').insert(customer);
    });
    this.customers.push(customer);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<any> {
    const customer = this.customers.find(c => c.id === id);
    if (!customer) return { success: false, message: 'Customer not found' };
    const oldVer = customer.version;
    Object.assign(customer, { ...data, updated_at: new Date().toISOString(), version: oldVer + 1 });
    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('customers').update(customer).eq('id', id).eq('version', oldVer);
    });
    this.recalculateAllBalances();
    return { success: true };
  }

  async createPurchaseInvoice(supplier_id: string, items: PurchaseItem[], paid_amount: number, is_return: boolean = false, docNo?: string, date?: string): Promise<any> {
    const total = items.reduce((s, i) => s + (i.quantity * i.cost_price), 0);
    const invoice: PurchaseInvoice = {
      ...this.createBase('pinv-'),
      invoice_number: this.generateSimpleSeq(this.purchaseInvoices, is_return ? 'PR' : 'P', 'invoice_number'),
      supplier_id,
      document_number: docNo,
      date: date || new Date().toISOString(),
      total_amount: total,
      paid_amount,
      type: is_return ? 'RETURN' : 'PURCHASE'
    };

    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('purchase_invoices').insert(invoice);
    });
    
    items.forEach(item => {
        const prod = this.productMap.get(item.product_id);
        if (prod) {
            prod.purchase_price = item.cost_price;
            prod.selling_price = item.selling_price;
        }
        let b = this.batches.find(x => x.product_id === item.product_id && x.warehouse_id === item.warehouse_id);
        if (!b) {
            b = { ...this.createBase('b-'), product_id: item.product_id, warehouse_id: item.warehouse_id, quantity: 0, purchase_price: item.cost_price, selling_price: item.selling_price, expiry_date: item.expiry_date, batch_number: item.batch_number, batch_status: BatchStatus.ACTIVE };
            this.batches.push(b);
            this.batchMap.set(b.id, b);
        }
        b.quantity += is_return ? -item.quantity : item.quantity;
    });

    this.purchaseInvoices.push(invoice);
    if (paid_amount > 0) {
        await this.addCashTransaction({
            type: CashTransactionType.EXPENSE,
            category: 'SUPPLIER_PAYMENT',
            reference_id: invoice.id,
            related_name: this.suppliers.find(s => s.id === supplier_id)?.name,
            amount: paid_amount,
            date: invoice.date,
            notes: `سداد فاتورة مشتريات #${invoice.invoice_number}`
        });
    }
    
    this.recalculateAllBalances();
    return { success: true, id: invoice.id };
  }

  async deletePurchaseInvoice(id: string, updateInventory: boolean = false, updateBalance: boolean = false): Promise<any> {
    const pinv = this.purchaseInvoices.find(p => p.id === id);
    if (!pinv) return { success: false };
    
    if (updateInventory) {
        pinv.items.forEach(item => {
            const b = this.batches.find(x => x.product_id === item.product_id && x.warehouse_id === item.warehouse_id);
            if (b) b.quantity -= (pinv.type === 'PURCHASE' ? item.quantity : -item.quantity);
        });
    }
    
    pinv.status = 'CANCELLED';
    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('purchase_invoices').update({ status: 'CANCELLED' }).eq('id', id);
    });
    
    this.recalculateAllBalances();
    return { success: true };
  }

  async recordInvoicePayment(invoiceId: string, amount: number) {
      const inv = this.invoices.find(i => i.id === invoiceId);
      if (!inv) return { success: false, message: 'Invoice not found' };
      return await this.addCashTransaction({
          type: inv.type === 'SALE' ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
          category: 'CUSTOMER_PAYMENT', reference_id: invoiceId,
          related_name: this.customerMap.get(inv.customer_id)?.name,
          amount, date: new Date().toISOString(), notes: `سداد فاتورة #${inv.invoice_number}`
      });
  }

  getNextTransactionRef(type: CashTransactionType): string {
      return this.generateSimpleSeq(this.cashTransactions, type === 'RECEIPT' ? 'REC' : 'EXP', 'ref_number');
  }

  async updateSettings(newSettings: any): Promise<any> {
    this.settings = { ...this.settings, ...newSettings };
    await this.safeCloudOperation(async () => {
        if (isSupabaseConfigured) await supabase.from('settings').upsert({ id: 1, ...this.settings });
    });
    this.saveToLocalCache();
    return true;
  }

  async resetDatabase() {
      localStorage.removeItem('mizan_db');
      window.location.reload();
  }

  exportDbData() { return JSON.stringify({ version: DB_VERSION, products: this.products, batches: this.batches, customers: this.customers, suppliers: this.suppliers, invoices: this.invoices, txs: this.cashTransactions, purchaseInvoices: this.purchaseInvoices, purchaseOrders: this.purchaseOrders, settings: this.settings }); }
  importDbData(json: string) {
      try {
          const data = JSON.parse(json);
          this.products = data.products || [];
          this.batches = data.batches || [];
          this.customers = data.customers || [];
          this.suppliers = data.suppliers || [];
          this.invoices = data.invoices || [];
          this.purchaseInvoices = data.purchaseInvoices || [];
          this.purchaseOrders = data.purchaseOrders || [];
          this.cashTransactions = data.txs || data.cashTransactions || [];
          this.settings = data.settings || this.settings;
          this.updateMaps();
          this.saveToLocalCache(true);
          return true;
      } catch { return false; }
  }
  
  // Stubs for other methods
  async addSupplier(data: any): Promise<any> { 
      const s = { ...this.createBase('s-'), ...data, current_balance: data.opening_balance || 0 };
      if (isSupabaseConfigured) await supabase.from('suppliers').insert(s);
      this.suppliers.push(s); this.saveToLocalCache(); return { success: true }; 
  }
  async updateSupplier(id: string, data: any): Promise<any> { 
      const s = this.suppliers.find(x => x.id === id);
      if (s) { Object.assign(s, { ...data, updated_at: new Date().toISOString() }); if (isSupabaseConfigured) await supabase.from('suppliers').update(s).eq('id', id); this.saveToLocalCache(); }
      return { success: true }; 
  }
  async addWarehouse(name: string): Promise<any> { 
      const w = { ...this.createBase('wh-'), name, is_default: this.warehouses.length === 0 };
      if (isSupabaseConfigured) await supabase.from('warehouses').insert(w);
      this.warehouses.push(w); this.saveToLocalCache(); return { success: true }; 
  }
  async updateWarehouse(id: string, name: string): Promise<any> { 
      const w = this.warehouses.find(x => x.id === id);
      if (w) { w.name = name; if (isSupabaseConfigured) await supabase.from('warehouses').update(w).eq('id', id); this.saveToLocalCache(); }
      return { success: true }; 
  }
  async deleteWarehouse(id: string): Promise<any> { 
      const w = this.warehouses.find(x => x.id === id);
      if (w?.is_default) return { success: false, message: 'Default warehouse cannot be deleted' };
      this.warehouses = this.warehouses.filter(x => x.id !== id);
      if (isSupabaseConfigured) await supabase.from('warehouses').delete().eq('id', id);
      this.saveToLocalCache(); return { success: true }; 
  }
  async addRepresentative(data: any) { 
      const r = { ...this.createBase('r-'), ...data };
      if (isSupabaseConfigured) await supabase.from('representatives').insert(r);
      this.representatives.push(r); this.saveToLocalCache(); return { success: true }; 
  }
  async updateRepresentative(id: string, data: any) { 
      const r = this.representatives.find(x => x.id === id);
      if (r) { Object.assign(r, { ...data, updated_at: new Date().toISOString() }); if (isSupabaseConfigured) await supabase.from('representatives').update(r).eq('id', id); this.saveToLocalCache(); }
      return { success: true }; 
  }
  async deleteRepresentative(id: string) { 
      this.representatives = this.representatives.filter(x => x.id !== id);
      if (isSupabaseConfigured) await supabase.from('representatives').delete().eq('id', id);
      this.saveToLocalCache(); return { success: true }; 
  }
  async submitStockTake(adjs: any[]) { 
      const pas = adjs.map(a => ({ ...this.createBase('adj-'), ...a, adj_status: 'PENDING' }));
      this.pendingAdjustments.push(...pas);
      if (isSupabaseConfigured) await supabase.from('pending_adjustments').insert(pas);
      this.saveToLocalCache(); return { success: true }; 
  }
  async approveAdjustment(id: string) { 
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (!adj) return false;
      const b = this.batches.find(x => x.product_id === adj.product_id && x.warehouse_id === adj.warehouse_id);
      if (b) { b.quantity = adj.actual_qty; adj.adj_status = 'APPROVED'; if (isSupabaseConfigured) { await supabase.from('batches').update({ quantity: b.quantity }).eq('id', b.id); await supabase.from('pending_adjustments').update({ adj_status: 'APPROVED' }).eq('id', id); } this.saveToLocalCache(); return true; }
      return false;
  }
  async rejectAdjustment(id: string) { 
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (adj) { adj.adj_status = 'REJECTED'; if (isSupabaseConfigured) await supabase.from('pending_adjustments').update({ adj_status: 'REJECTED' }).eq('id', id); this.saveToLocalCache(); return true; }
      return false;
  }
  async saveDailyClosing(data: any) { 
      const dc = { ...this.createBase('dc-'), ...data };
      this.dailyClosings.push(dc); if (isSupabaseConfigured) await supabase.from('daily_closings').insert(dc);
      this.saveToLocalCache(); return true; 
  }
  async createPurchaseOrder(sid: string, items: any[]) { 
      const po = { ...this.createBase('po-'), supplier_id: sid, items, order_number: this.generateSimpleSeq(this.purchaseOrders, 'PO', 'order_number'), date: new Date().toISOString(), order_status: 'PENDING' };
      this.purchaseOrders.push(po); if (isSupabaseConfigured) await supabase.from('purchase_orders').insert(po);
      this.saveToLocalCache(); return { success: true }; 
  }
  async updatePurchaseOrderStatus(id: string, status: any) { 
      const po = this.purchaseOrders.find(x => x.id === id);
      if (po) { po.order_status = status; if (isSupabaseConfigured) await supabase.from('purchase_orders').update({ order_status: status }).eq('id', id); this.saveToLocalCache(); return true; }
      return false;
  }
  async addExpenseCategory(c: string) { 
      if (!this.settings.expenseCategories) this.settings.expenseCategories = [];
      if (!this.settings.expenseCategories.includes(c)) { this.settings.expenseCategories.push(c); await this.updateSettings(this.settings); }
      return true; 
  }
  
  // --- Data Management Methods (Security Operations) ---

  /**
   * Clears all sales records (invoices) from local and cloud storage.
   */
  async clearAllSales() {
    this.invoices = [];
    if (isSupabaseConfigured) {
        await supabase.from('invoices').delete().neq('id', '0');
    }
    this.recalculateAllBalances();
  }

  /**
   * Resets customer accounts by clearing sales and payments.
   */
  async resetCustomerAccounts() {
    this.invoices = [];
    this.cashTransactions = this.cashTransactions.filter(t => t.category !== 'CUSTOMER_PAYMENT');
    if (isSupabaseConfigured) {
        await supabase.from('invoices').delete().neq('id', '0');
        await supabase.from('cash_transactions').delete().eq('category', 'CUSTOMER_PAYMENT');
    }
    this.customers.forEach(c => {
        c.current_balance = c.opening_balance || 0;
    });
    this.recalculateAllBalances();
  }

  /**
   * Clears all purchase records from local and cloud storage.
   */
  async clearAllPurchases() {
    this.purchaseInvoices = [];
    if (isSupabaseConfigured) {
        await supabase.from('purchase_invoices').delete().neq('id', '0');
    }
    this.recalculateAllBalances();
  }

  /**
   * Clears all draft purchase orders.
   */
  async clearAllOrders() {
    this.purchaseOrders = [];
    if (isSupabaseConfigured) {
        await supabase.from('purchase_orders').delete().neq('id', '0');
    }
    this.saveToLocalCache();
  }

  /**
   * Resets the entire cash register history.
   */
  async resetCashRegister() {
    this.cashTransactions = [];
    if (isSupabaseConfigured) {
        await supabase.from('cash_transactions').delete().neq('id', '0');
    }
    this.recalculateAllBalances();
  }

  /**
   * Resets stock levels for all products in a specific warehouse.
   */
  async clearWarehouseStock(warehouseId: string) {
    this.batches.forEach(b => {
      if (b.warehouse_id === warehouseId) b.quantity = 0;
    });
    if (isSupabaseConfigured) {
        await supabase.from('batches').update({ quantity: 0 }).eq('warehouse_id', warehouseId);
    }
    this.updateMaps();
    this.saveToLocalCache();
  }

  getABCAnalysis() {
    const revenueMap = new Map<string, number>();
    this.invoices.forEach(inv => {
      if (inv.status !== 'ACTIVE') return;
      inv.items.forEach(item => {
        const val = (item.quantity * (item.unit_price || 0)) * (1 - (item.discount_percentage / 100));
        const current = revenueMap.get(item.product.id) || 0;
        revenueMap.set(item.product.id, current + (inv.type === 'SALE' ? val : -val));
      });
    });

    const productsWithRevenue = this.products.filter(p => p.status !== 'INACTIVE').map(p => ({
      id: p.id,
      name: p.name,
      revenue: Math.max(0, revenueMap.get(p.id) || 0)
    })).sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = productsWithRevenue.reduce((s, p) => s + p.revenue, 0);
    let runningTotal = 0;

    const classifiedProducts = productsWithRevenue.map(p => {
      runningTotal += p.revenue;
      const pct = totalRevenue > 0 ? (runningTotal / totalRevenue) * 100 : 100;
      let category = 'C';
      if (pct <= 80) category = 'A';
      else if (pct <= 95) category = 'B';
      return { ...p, category };
    });

    return { classifiedProducts };
  }
}

export const db = new Database();