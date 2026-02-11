
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
} from '../types';

const DB_VERSION = 2; // تحديث النسخة للنقلة المعمارية الجديدة

class Database {
  // كائنات البيانات (Arrays للمخرجات)
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

  // فهارس الذاكرة (Maps لسرعة الوصول O(1))
  private productMap = new Map<string, Product>();
  private batchMap = new Map<string, Batch>();
  private customerMap = new Map<string, Customer>();

  // حالة التشغيل
  isFullyLoaded: boolean = false;
  public activeOperations: number = 0;
  private syncListeners: ((isBusy: boolean) => void)[] = [];
  private saveTimeout: any = null;

  constructor() {
    this.loadFromLocalCache();
  }

  // توليد كيان جديد مع البيانات الزمنية
  private createBase(prefix: string): any {
    const now = new Date().toISOString();
    return {
      id: `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: now,
      updated_at: now,
      version: 1
    };
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
        // Fetch all tables for full sync
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

  // --- Invoice Logic ---

  async createInvoice(customer_id: string, items: CartItem[], cash_paid: number, is_return: boolean, disc: number, creator: any, commission: number = 0): Promise<any> {
    this.incrementOp();
    try {
      const subtotal = items.reduce((s, i) => s + (i.quantity * (i.unit_price || 0)), 0);
      const net = Math.max(0, subtotal - disc);
      const customer = this.customerMap.get(customer_id);
      if (!customer) throw new Error("Customer not found");

      const invoice: Invoice = {
        ...this.createBase('inv-'),
        invoice_number: this.generateSimpleSeq(this.invoices, is_return ? 'SR' : 'S', 'invoice_number'),
        customer_id, created_by: creator?.id, created_by_name: creator?.name,
        date: new Date().toISOString(), total_before_discount: subtotal, total_discount: 0,
        additional_discount: disc, commission_value: commission, net_total: net,
        previous_balance: customer.current_balance,
        final_balance: customer.current_balance + (is_return ? -net : net),
        payment_status: PaymentStatus.UNPAID, items, type: is_return ? 'RETURN' : 'SALE', status: 'ACTIVE'
      };

      if (isSupabaseConfigured) {
          const { error } = await supabase.from('invoices').insert(invoice);
          if (error) throw error;
      }

      items.forEach(item => {
          const b = this.batches.find(x => x.id === item.batch?.id);
          if (b) b.quantity += is_return ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
      });
      this.invoices.push(invoice);
      customer.current_balance = invoice.final_balance;
      
      if (cash_paid > 0) await this.recordInvoicePayment(invoice.id, cash_paid);
      this.saveToLocalCache();
      return { success: true, id: invoice.id };
    } catch (e: any) {
        return { success: false, message: e.message };
    } finally {
        this.decrementOp();
    }
  }

  async updateInvoice(id: string, customer_id: string, items: CartItem[], cash_paid: number): Promise<any> {
      await this.deleteInvoice(id);
      return this.createInvoice(customer_id, items, cash_paid, false, 0, null);
  }

  async deleteInvoice(id: string): Promise<any> {
    const idx = this.invoices.findIndex(i => i.id === id);
    if (idx === -1) return { success: false };
    const inv = this.invoices[idx];
    
    inv.items.forEach(item => {
        const b = this.batches.find(x => x.id === item.batch?.id);
        if (b) b.quantity += inv.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
    });

    this.cashTransactions = this.cashTransactions.filter(t => t.reference_id !== id);
    this.invoices.splice(idx, 1);
    if (isSupabaseConfigured) await supabase.from('invoices').delete().eq('id', id);
    
    this.recalculateAllBalances();
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Product Logic ---

  async addProduct(pData: any, bData: any): Promise<any> {
    const product: Product = { ...this.createBase('p-'), ...pData, purchase_price: bData.purchase_price, selling_price: bData.selling_price };
    const batch: Batch = { ...this.createBase('b-'), product_id: product.id, ...bData, status: BatchStatus.ACTIVE };
    if (isSupabaseConfigured) {
        await supabase.from('products').insert(product);
        await supabase.from('batches').insert(batch);
    }
    this.products.push(product);
    this.batches.push(batch);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async updateProduct(id: string, data: any): Promise<any> {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return { success: false, message: 'Product not found' };
    this.products[idx] = { ...this.products[idx], ...data, updated_at: new Date().toISOString() };
    if (isSupabaseConfigured) await supabase.from('products').update(data).eq('id', id);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteProduct(id: string): Promise<any> {
    this.products = this.products.filter(p => p.id !== id);
    this.batches = this.batches.filter(b => b.product_id !== id);
    if (isSupabaseConfigured) {
        await supabase.from('products').delete().eq('id', id);
        await supabase.from('batches').delete().eq('product_id', id);
    }
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Customer Logic ---

  async addCustomer(data: any): Promise<any> {
    const customer: Customer = { ...this.createBase('c-'), ...data, current_balance: data.opening_balance || 0 };
    if (isSupabaseConfigured) await supabase.from('customers').insert(customer);
    this.customers.push(customer);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async updateCustomer(id: string, data: any): Promise<any> {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx === -1) return { success: false };
    this.customers[idx] = { ...this.customers[idx], ...data, updated_at: new Date().toISOString() };
    if (isSupabaseConfigured) await supabase.from('customers').update(data).eq('id', id);
    this.recalculateAllBalances();
    return { success: true };
  }

  async deleteCustomer(id: string): Promise<any> {
    this.customers = this.customers.filter(c => c.id !== id);
    if (isSupabaseConfigured) await supabase.from('customers').delete().eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Supplier Logic ---

  async addSupplier(data: any): Promise<any> {
    const supplier: Supplier = { ...this.createBase('s-'), ...data, current_balance: data.opening_balance || 0 };
    if (isSupabaseConfigured) await supabase.from('suppliers').insert(supplier);
    this.suppliers.push(supplier);
    this.saveToLocalCache();
    return { success: true };
  }

  async updateSupplier(id: string, data: any): Promise<any> {
    const idx = this.suppliers.findIndex(s => s.id === id);
    if (idx === -1) return { success: false };
    this.suppliers[idx] = { ...this.suppliers[idx], ...data, updated_at: new Date().toISOString() };
    if (isSupabaseConfigured) await supabase.from('suppliers').update(data).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteSupplier(id: string): Promise<any> {
    this.suppliers = this.suppliers.filter(s => s.id !== id);
    if (isSupabaseConfigured) await supabase.from('suppliers').delete().eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Purchase Logic ---

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
      type: is_return ? 'RETURN' : 'PURCHASE',
      items
    };

    if (isSupabaseConfigured) await supabase.from('purchase_invoices').insert(invoice);
    
    items.forEach(item => {
        const prod = this.products.find(p => p.id === item.product_id);
        if (prod) {
            prod.purchase_price = item.cost_price;
            prod.selling_price = item.selling_price;
        }
        let b = this.batches.find(x => x.product_id === item.product_id && x.warehouse_id === item.warehouse_id);
        if (!b) {
            b = { ...this.createBase('b-'), product_id: item.product_id, warehouse_id: item.warehouse_id, quantity: 0, purchase_price: item.cost_price, selling_price: item.selling_price, expiry_date: item.expiry_date, batch_number: item.batch_number, status: BatchStatus.ACTIVE };
            this.batches.push(b);
        }
        b.quantity += is_return ? -item.quantity : item.quantity;
        b.purchase_price = item.cost_price;
        b.selling_price = item.selling_price;
    });

    this.purchaseInvoices.push(invoice);
    
    if (paid_amount > 0) {
        const tx: CashTransaction = {
            ...this.createBase('pay-'),
            type: CashTransactionType.EXPENSE,
            category: 'SUPPLIER_PAYMENT',
            reference_id: invoice.id,
            related_name: this.suppliers.find(s => s.id === supplier_id)?.name,
            amount: paid_amount,
            date: invoice.date,
            notes: `سداد فاتورة مشتريات #${invoice.invoice_number}`
        };
        await this.addCashTransaction(tx);
    }
    
    this.recalculateAllBalances();
    return { success: true, id: invoice.id };
  }

  async deletePurchaseInvoice(id: string, updateInventory: boolean = true, updateBalance: boolean = true): Promise<any> {
    const inv = this.purchaseInvoices.find(i => i.id === id);
    if (!inv) return { success: false };
    
    if (updateInventory) {
        inv.items.forEach(item => {
            const b = this.batches.find(x => x.product_id === item.product_id && x.warehouse_id === item.warehouse_id);
            if (b) b.quantity += inv.type === 'PURCHASE' ? -item.quantity : item.quantity;
        });
    }

    this.purchaseInvoices = this.purchaseInvoices.filter(i => i.id !== id);
    this.cashTransactions = this.cashTransactions.filter(t => t.reference_id !== id);
    
    if (isSupabaseConfigured) await supabase.from('purchase_invoices').delete().eq('id', id);
    
    if (updateBalance) this.recalculateAllBalances();
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Purchase Order Logic ---

  async createPurchaseOrder(supplier_id: string, items: any[]): Promise<any> {
    const order: PurchaseOrder = {
        ...this.createBase('po-'),
        order_number: this.generateSimpleSeq(this.purchaseOrders, 'PO', 'order_number'),
        supplier_id,
        date: new Date().toISOString(),
        status: 'PENDING',
        items
    };
    if (isSupabaseConfigured) await supabase.from('purchase_orders').insert(order);
    this.purchaseOrders.push(order);
    this.saveToLocalCache();
    return { success: true };
  }

  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED'): Promise<any> {
    const order = this.purchaseOrders.find(o => o.id === id);
    if (!order) return { success: false };
    order.status = status;
    if (isSupabaseConfigured) await supabase.from('purchase_orders').update({ status }).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Representative Logic ---

  async addRepresentative(data: any): Promise<any> {
    const rep: Representative = { ...this.createBase('r-'), ...data };
    if (isSupabaseConfigured) await supabase.from('representatives').insert(rep);
    this.representatives.push(rep);
    this.saveToLocalCache();
    return { success: true };
  }

  async updateRepresentative(id: string, data: any): Promise<any> {
    const idx = this.representatives.findIndex(r => r.id === id);
    if (idx === -1) return { success: false };
    this.representatives[idx] = { ...this.representatives[idx], ...data, updated_at: new Date().toISOString() };
    if (isSupabaseConfigured) await supabase.from('representatives').update(data).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteRepresentative(id: string): Promise<any> {
    this.representatives = this.representatives.filter(r => r.id !== id);
    if (isSupabaseConfigured) await supabase.from('representatives').delete().eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Warehouse Logic ---

  async addWarehouse(name: string): Promise<any> {
    const wh: Warehouse = { ...this.createBase('wh-'), name, is_default: this.warehouses.length === 0 };
    if (isSupabaseConfigured) await supabase.from('warehouses').insert(wh);
    this.warehouses.push(wh);
    this.saveToLocalCache();
    return { success: true };
  }

  async updateWarehouse(id: string, name: string): Promise<any> {
    const wh = this.warehouses.find(w => w.id === id);
    if (!wh) return { success: false };
    wh.name = name;
    if (isSupabaseConfigured) await supabase.from('warehouses').update({ name }).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async deleteWarehouse(id: string): Promise<any> {
    const wh = this.warehouses.find(w => w.id === id);
    if (!wh || wh.is_default) return { success: false, message: 'Cannot delete default warehouse' };
    this.warehouses = this.warehouses.filter(w => w.id !== id);
    if (isSupabaseConfigured) await supabase.from('warehouses').delete().eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Cash Transaction Logic ---

  getNextTransactionRef(type: CashTransactionType): string {
      return this.generateSimpleSeq(this.cashTransactions, type === 'RECEIPT' ? 'REC' : 'EXP', 'ref_number');
  }

  async addCashTransaction(data: any): Promise<any> {
    const tx: CashTransaction = { ...this.createBase('tx-'), ...data, ref_number: data.ref_number || this.getNextTransactionRef(data.type) };
    if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(tx);
    this.cashTransactions.push(tx);
    this.recalculateAllBalances();
    return { success: true };
  }

  addExpenseCategory(cat: string) {
      if (!this.settings.expenseCategories) this.settings.expenseCategories = [];
      if (!this.settings.expenseCategories.includes(cat)) {
          this.settings.expenseCategories.push(cat);
          this.updateSettings(this.settings);
      }
  }

  // --- Stock Take Logic ---

  async submitStockTake(adjustments: any[]): Promise<any> {
      const pAs = adjustments.map(adj => ({ ...this.createBase('adj-'), ...adj, status: 'PENDING', date: new Date().toISOString() }));
      this.pendingAdjustments.push(...pAs);
      if (isSupabaseConfigured) await supabase.from('pending_adjustments').insert(pAs);
      this.saveToLocalCache();
      return { success: true };
  }

  async approveAdjustment(id: string): Promise<any> {
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (!adj) return false;
      const batch = this.batches.find(b => b.product_id === adj.product_id && b.warehouse_id === adj.warehouse_id);
      if (batch) {
          batch.quantity = adj.actual_qty;
          adj.status = 'APPROVED';
          if (isSupabaseConfigured) {
              await supabase.from('batches').update({ quantity: batch.quantity }).eq('id', batch.id);
              await supabase.from('pending_adjustments').update({ status: 'APPROVED' }).eq('id', id);
          }
          this.saveToLocalCache();
          return true;
      }
      return false;
  }

  async rejectAdjustment(id: string): Promise<any> {
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (!adj) return false;
      adj.status = 'REJECTED';
      if (isSupabaseConfigured) await supabase.from('pending_adjustments').update({ status: 'REJECTED' }).eq('id', id);
      this.saveToLocalCache();
      return true;
  }

  // --- Daily Closing Logic ---

  async saveDailyClosing(data: any): Promise<any> {
      const closing: DailyClosing = { ...this.createBase('dc-'), ...data };
      this.dailyClosings.push(closing);
      if (isSupabaseConfigured) await supabase.from('daily_closings').insert(closing);
      this.saveToLocalCache();
      return true;
  }

  getDailySummary(date: string) {
    const txs = this.cashTransactions.filter(t => t.date.startsWith(date));
    const pinvs = this.purchaseInvoices.filter(p => p.date.startsWith(date));
    
    const cashSales = txs.filter(t => t.type === 'RECEIPT' && t.category === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((s, t) => s + t.amount, 0);
    const cashPurchases = pinvs.reduce((s, p) => s + p.paid_amount, 0);
    
    const openingCash = this.cashTransactions.filter(t => t.date < date).reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
    const expectedCash = openingCash + cashSales - expenses - cashPurchases;
    
    const valuation = this.getInventoryValuationReport();
    const inventoryValue = valuation.reduce((s, p) => s + p.totalValue, 0);
    
    return { openingCash, cashSales, expenses, cashPurchases, expectedCash, inventoryValue };
  }

  // --- Analytics & Reports ---

  getABCAnalysis() {
    const revenueMap = new Map<string, number>();
    this.invoices.forEach(inv => {
      if (inv.type === 'SALE' && inv.status === 'ACTIVE') {
        inv.items.forEach(item => {
          const price = item.unit_price || 0;
          const val = item.quantity * price * (1 - item.discount_percentage / 100);
          revenueMap.set(item.product.id, (revenueMap.get(item.product.id) || 0) + val);
        });
      }
    });

    const products = this.products.map(p => ({ id: p.id, name: p.name, revenue: revenueMap.get(p.id) || 0, category: '' })).sort((a, b) => b.revenue - a.revenue);
    const totalRev = products.reduce((s, p) => s + p.revenue, 0);
    let cumRev = 0;

    products.forEach(p => {
      cumRev += p.revenue;
      const pct = totalRev > 0 ? (cumRev / totalRev) * 100 : 100;
      if (pct <= 80) p.category = 'A';
      else if (pct <= 95) p.category = 'B';
      else p.category = 'C';
    });

    return { classifiedProducts: products };
  }

  getInventoryValuationReport() {
    const soldQtyMap = new Map<string, number>();
    this.invoices.forEach(inv => { if(inv.type === 'SALE') inv.items.forEach(it => soldQtyMap.set(it.product.id, (soldQtyMap.get(it.product.id) || 0) + it.quantity)); });

    return this.products.map(p => {
      const pBatches = this.batches.filter(b => b.product_id === p.id);
      const totalQty = pBatches.reduce((s, b) => s + b.quantity, 0);
      const latestBatch = [...pBatches].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
      const latestCost = latestBatch ? latestBatch.purchase_price : (p.purchase_price || 0);
      const totalValue = pBatches.reduce((sum, b) => sum + (b.purchase_price * b.quantity), 0);
      const wac = totalQty > 0 ? totalValue / totalQty : latestCost;
      
      const sold = soldQtyMap.get(p.id) || 0;
      const turnoverRate = totalQty > 0 ? (sold / totalQty).toFixed(1) : "0.0";

      return { id: p.id, name: p.name, code: p.code || '', totalQty, wac, latestCost, totalValue: totalQty * wac, turnoverRate };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }

  // --- Admin/Maintenance Logic ---

  async updateSettings(newSettings: any): Promise<any> {
    this.settings = { ...this.settings, ...newSettings };
    if (isSupabaseConfigured) await supabase.from('settings').upsert({ id: 1, ...this.settings });
    this.saveToLocalCache();
    return true;
  }

  async clearAllSales() {
    this.invoices = [];
    this.cashTransactions = this.cashTransactions.filter(t => t.category !== 'CUSTOMER_PAYMENT');
    if (isSupabaseConfigured) {
        await supabase.from('invoices').delete().neq('id', 'placeholder');
        await supabase.from('cash_transactions').delete().eq('category', 'CUSTOMER_PAYMENT');
    }
    this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  async resetCustomerAccounts() {
    this.invoices = [];
    this.cashTransactions = this.cashTransactions.filter(t => t.category !== 'CUSTOMER_PAYMENT');
    this.customers.forEach(c => { c.opening_balance = 0; c.current_balance = 0; });
    if (isSupabaseConfigured) {
        await supabase.from('invoices').delete().neq('id', 'placeholder');
        await supabase.from('cash_transactions').delete().eq('category', 'CUSTOMER_PAYMENT');
        await supabase.from('customers').update({ opening_balance: 0, current_balance: 0 }).neq('id', 'placeholder');
    }
    this.saveToLocalCache();
  }

  async clearAllPurchases() {
    this.purchaseInvoices = [];
    if (isSupabaseConfigured) await supabase.from('purchase_invoices').delete().neq('id', 'placeholder');
    this.saveToLocalCache();
  }

  async clearAllOrders() {
    this.purchaseOrders = [];
    if (isSupabaseConfigured) await supabase.from('purchase_orders').delete().neq('id', 'placeholder');
    this.saveToLocalCache();
  }

  async resetCashRegister() {
    this.cashTransactions = [];
    if (isSupabaseConfigured) await supabase.from('cash_transactions').delete().neq('id', 'placeholder');
    this.saveToLocalCache();
  }

  async clearWarehouseStock(whId: string) {
    this.batches.forEach(b => { if(b.warehouse_id === whId) b.quantity = 0; });
    if (isSupabaseConfigured) await supabase.from('batches').update({ quantity: 0 }).eq('warehouse_id', whId);
    this.saveToLocalCache();
  }

  async resetDatabase() {
      localStorage.removeItem('mizan_db');
      if (isSupabaseConfigured) { /* Optional: clean cloud tables */ }
      window.location.reload();
  }

  // تقييم المخزون بفرز زمني دقيق
  // [Already included in re-implementation above]

  // Getters & Common Logic
  getSettings() { return this.settings; }
  getInvoices() { return this.invoices; }
  getCustomers() { return this.customers; }
  getSuppliers() { return this.suppliers; }
  getWarehouses() { return this.warehouses; }
  getRepresentatives() { return this.representatives; }
  getPurchaseInvoices() { return this.purchaseInvoices; }
  getPurchaseOrders() { return this.purchaseOrders; }
  getCashTransactions() { return this.cashTransactions; }
  getDailyClosings() { return this.dailyClosings; }
  getPendingAdjustments() { return this.pendingAdjustments; }
  getProductsWithBatches(): ProductWithBatches[] {
      return this.products.map(p => ({ ...p, batches: this.batches.filter(b => b.product_id === p.id) }));
  }
  getCashBalance() {
      return this.cashTransactions.reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
  }
  getInvoicePaidAmount(invId: string) {
      return this.cashTransactions.filter(t => t.reference_id === invId).reduce((s, t) => s + t.amount, 0);
  }

  // Record Payment
  async recordInvoicePayment(invoiceId: string, amount: number) {
      const inv = this.invoices.find(i => i.id === invoiceId);
      if (!inv) return { success: false, message: 'Invoice not found' };
      const tx: CashTransaction = {
          ...this.createBase('pay-'),
          type: inv.type === 'SALE' ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
          category: 'CUSTOMER_PAYMENT', reference_id: invoiceId,
          related_name: this.customerMap.get(inv.customer_id)?.name,
          amount, date: new Date().toISOString(), notes: `سداد فاتورة #${inv.invoice_number}`
      };
      await this.addCashTransaction(tx);
      return { success: true };
  }

  recalculateAllBalances() {
      this.customers.forEach(c => {
          const sales = this.invoices.filter(i => i.customer_id === c.id && i.type === 'SALE').reduce((s, i) => s + i.net_total, 0);
          const returns = this.invoices.filter(i => i.customer_id === c.id && i.type === 'RETURN').reduce((s, i) => s + i.net_total, 0);
          const payments = this.cashTransactions.filter(t => (t.reference_id === c.id || this.invoices.some(inv => inv.id === t.reference_id && inv.customer_id === c.id)) && t.category === 'CUSTOMER_PAYMENT');
          const paid = payments.filter(t => t.type === 'RECEIPT').reduce((s, t) => s + t.amount, 0);
          const refunded = payments.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
          c.current_balance = (c.opening_balance || 0) + sales - returns - paid + refunded;
      });
      this.suppliers.forEach(s => {
          const purchases = this.purchaseInvoices.filter(p => p.supplier_id === s.id && p.type === 'PURCHASE').reduce((sum, p) => sum + p.total_amount, 0);
          const returns = this.purchaseInvoices.filter(p => p.supplier_id === s.id && p.type === 'RETURN').reduce((sum, p) => sum + p.total_amount, 0);
          const payments = this.cashTransactions.filter(t => (t.reference_id === s.id || this.purchaseInvoices.some(p => p.id === t.reference_id && p.supplier_id === s.id)) && t.category === 'SUPPLIER_PAYMENT');
          const paid = payments.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
          const refunded = payments.filter(t => t.type === 'RECEIPT').reduce((sum, t) => sum + t.amount, 0);
          s.current_balance = (s.opening_balance || 0) + purchases - returns - paid + refunded;
      });
      this.saveToLocalCache();
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
}

export const db = new Database();
