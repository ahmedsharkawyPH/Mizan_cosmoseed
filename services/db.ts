
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
} from '../types';

const DB_VERSION = 3; // النقلة المعمارية الثالثة (الاستقرار المحاسبي)

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

  // --- Invoice Logic (Corrected Meta Data Handling) ---

  async createInvoice(customer_id: string, items: CartItem[], cash_paid: number, is_return: boolean, disc: number, creator: any, commission: number = 0): Promise<any> {
    this.incrementOp();
    try {
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

  // تصحيح: استعادة كافة البيانات المفقودة عند تحديث الفاتورة
  async updateInvoice(id: string, customer_id: string, items: CartItem[], cash_paid: number): Promise<any> {
      const old = this.invoices.find(i => i.id === id);
      if (!old) return { success: false, message: 'Original invoice not found' };
      
      await this.deleteInvoice(id);
      return this.createInvoice(
          customer_id, 
          items, 
          cash_paid, 
          old.type === 'RETURN', 
          old.additional_discount || 0, 
          { id: old.created_by, name: old.created_by_name },
          old.commission_value || 0
      );
  }

  async deleteInvoice(id: string): Promise<any> {
    const idx = this.invoices.findIndex(i => i.id === id);
    if (idx === -1) return { success: false };
    const inv = this.invoices[idx];
    
    // 1. عكس حركات المخزون
    inv.items.forEach(item => {
        const b = this.batches.find(x => x.id === item.batch?.id);
        if (b) b.quantity += inv.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
    });

    // 2. حذف المعاملات النقدية محلياً وسحابياً لضمان سلامة الأرصدة
    this.cashTransactions = this.cashTransactions.filter(t => t.reference_id !== id);
    if (isSupabaseConfigured) {
        await supabase.from('cash_transactions').delete().eq('reference_id', id);
    }

    this.invoices.splice(idx, 1);
    if (isSupabaseConfigured) await supabase.from('invoices').delete().eq('id', id);
    
    this.recalculateAllBalances();
    this.saveToLocalCache();
    return { success: true };
  }

  // --- Purchase Logic (Corrected Categories) ---

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
            category: 'SUPPLIER_PAYMENT', // تصحيح: إضافة التصنيف المفقود
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

  // تصحيح: إضافة دالة حذف فاتورة المشتريات
  async deletePurchaseInvoice(id: string, updateInventory: boolean = false, updateBalance: boolean = false): Promise<any> {
    const idx = this.purchaseInvoices.findIndex(p => p.id === id);
    if (idx === -1) return { success: false };
    const pinv = this.purchaseInvoices[idx];
    
    if (updateInventory) {
        pinv.items.forEach(item => {
            const b = this.batches.find(x => x.product_id === item.product_id && x.warehouse_id === item.warehouse_id);
            if (b) b.quantity -= (pinv.type === 'PURCHASE' ? item.quantity : -item.quantity);
        });
    }
    
    if (updateBalance) {
        this.cashTransactions = this.cashTransactions.filter(t => t.reference_id !== id);
        if (isSupabaseConfigured) await supabase.from('cash_transactions').delete().eq('reference_id', id);
    }
    
    this.purchaseInvoices.splice(idx, 1);
    if (isSupabaseConfigured) await supabase.from('purchase_invoices').delete().eq('id', id);
    
    this.recalculateAllBalances();
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة إنشاء طلب شراء
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

  // تصحيح: إضافة دالة تحديث حالة طلب الشراء
  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED'): Promise<any> {
      const order = this.purchaseOrders.find(o => o.id === id);
      if (order) {
          order.status = status;
          order.updated_at = new Date().toISOString();
          order.version += 1;
          if (isSupabaseConfigured) await supabase.from('purchase_orders').update({ status }).eq('id', id);
          this.saveToLocalCache();
          return true;
      }
      return false;
  }

  // --- Financial Support Methods (Corrected Logic) ---

  getInvoicePaidAmount(invId: string) {
      return this.cashTransactions
        .filter(t => t.reference_id === invId)
        .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0); // تصحيح: مراعاة نوع المعاملة
  }

  getDailySummary(date: string) {
    const todayStart = new Date(date);
    todayStart.setHours(0,0,0,0);
    
    const txs = this.cashTransactions.filter(t => t.date.startsWith(date));
    const pinvs = this.purchaseInvoices.filter(p => p.date.startsWith(date));
    
    const cashSales = txs.filter(t => t.type === 'RECEIPT' && t.category === 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((s, t) => s + t.amount, 0);
    const cashPurchases = pinvs.reduce((s, p) => s + p.paid_amount, 0);
    
    const openingCash = this.cashTransactions
        .filter(t => new Date(t.date) < todayStart) // تصحيح: مقارنة كائنات التاريخ
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

    return this.products.map(p => {
      const pBatches = this.batches.filter(b => b.product_id === p.id);
      const totalQty = pBatches.reduce((s, b) => s + b.quantity, 0);
      
      const sortedBatches = [...pBatches].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      const latestBatch = sortedBatches[0];
      const latestCost = latestBatch ? latestBatch.purchase_price : (p.purchase_price || 0);
      
      // تصحيح: حساب القيمة الإجمالية مباشرة لتجنب أخطاء التقريب في المتوسط
      const totalActualValue = pBatches.reduce((sum, b) => sum + (b.purchase_price * b.quantity), 0);
      const wac = totalQty > 0 ? totalActualValue / totalQty : latestCost;
      
      const sold = soldQtyMap.get(p.id) || 0;
      const turnoverRate = totalQty > 0 ? (sold / totalQty).toFixed(1) : "0.0";

      return { id: p.id, name: p.name, code: p.code || '', totalQty, wac, latestCost, totalValue: totalActualValue, turnoverRate };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }

  // تصحيح: إضافة دالة تحليل ABC
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

    const productsWithRevenue = this.products.map(p => ({
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

  async addCashTransaction(data: any): Promise<any> {
    const tx: CashTransaction = { ...this.createBase('tx-'), ...data, ref_number: data.ref_number || this.getNextTransactionRef(data.type) };
    if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(tx);
    this.cashTransactions.push(tx);
    this.recalculateAllBalances();
    return { success: true };
  }

  recalculateAllBalances() {
      this.customers.forEach(c => {
          const sales = this.invoices.filter(i => i.customer_id === c.id && i.type === 'SALE' && i.status === 'ACTIVE').reduce((s, i) => s + i.net_total, 0);
          const returns = this.invoices.filter(i => i.customer_id === c.id && i.type === 'RETURN' && i.status === 'ACTIVE').reduce((s, i) => s + i.net_total, 0);
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

  // CRUD for Products, Customers, Suppliers... (remained same but indexed)
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

  // تصحيح: إضافة دالة تحديث صنف
  async updateProduct(id: string, data: Partial<Product>): Promise<any> {
    const product = this.products.find(p => p.id === id);
    if (!product) return { success: false, message: 'Product not found' };
    Object.assign(product, { ...data, updated_at: new Date().toISOString(), version: product.version + 1 });
    if (isSupabaseConfigured) await supabase.from('products').update(product).eq('id', id);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة حذف صنف
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

  async addCustomer(data: any): Promise<any> {
    const customer: Customer = { ...this.createBase('c-'), ...data, current_balance: data.opening_balance || 0 };
    if (isSupabaseConfigured) await supabase.from('customers').insert(customer);
    this.customers.push(customer);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة تحديث عميل
  async updateCustomer(id: string, data: Partial<Customer>): Promise<any> {
    const customer = this.customers.find(c => c.id === id);
    if (!customer) return { success: false, message: 'Customer not found' };
    Object.assign(customer, { ...data, updated_at: new Date().toISOString(), version: customer.version + 1 });
    if (isSupabaseConfigured) await supabase.from('customers').update(customer).eq('id', id);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة حذف عميل
  async deleteCustomer(id: string): Promise<any> {
    this.customers = this.customers.filter(c => c.id !== id);
    if (isSupabaseConfigured) await supabase.from('customers').delete().eq('id', id);
    this.updateMaps();
    this.saveToLocalCache();
    return { success: true };
  }

  async addSupplier(data: any): Promise<any> {
    const supplier: Supplier = { ...this.createBase('s-'), ...data, current_balance: data.opening_balance || 0 };
    if (isSupabaseConfigured) await supabase.from('suppliers').insert(supplier);
    this.suppliers.push(supplier);
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة تحديث مورد
  async updateSupplier(id: string, data: Partial<Supplier>): Promise<any> {
    const supplier = this.suppliers.find(s => s.id === id);
    if (!supplier) return { success: false, message: 'Supplier not found' };
    Object.assign(supplier, { ...data, updated_at: new Date().toISOString(), version: supplier.version + 1 });
    if (isSupabaseConfigured) await supabase.from('suppliers').update(supplier).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة حذف مورد
  async deleteSupplier(id: string): Promise<any> {
    this.suppliers = this.suppliers.filter(s => s.id !== id);
    if (isSupabaseConfigured) await supabase.from('suppliers').delete().eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async addWarehouse(name: string): Promise<any> {
    const wh: Warehouse = { ...this.createBase('wh-'), name, is_default: this.warehouses.length === 0 };
    if (isSupabaseConfigured) await supabase.from('warehouses').insert(wh);
    this.warehouses.push(wh);
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة تحديث مخزن
  async updateWarehouse(id: string, name: string): Promise<any> {
    const wh = this.warehouses.find(w => w.id === id);
    if (!wh) return { success: false };
    wh.name = name;
    wh.updated_at = new Date().toISOString();
    wh.version += 1;
    if (isSupabaseConfigured) await supabase.from('warehouses').update(wh).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة حذف مخزن
  async deleteWarehouse(id: string): Promise<any> {
    const wh = this.warehouses.find(w => w.id === id);
    if (!wh) return { success: false, message: 'Warehouse not found' };
    if (wh.is_default) return { success: false, message: 'Cannot delete default warehouse' };
    const hasStock = this.batches.some(b => b.warehouse_id === id && b.quantity > 0);
    if (hasStock) return { success: false, message: 'Warehouse has active stock' };
    this.warehouses = this.warehouses.filter(w => w.id !== id);
    if (isSupabaseConfigured) await supabase.from('warehouses').delete().eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async addRepresentative(data: any): Promise<any> {
    const rep: Representative = { ...this.createBase('r-'), ...data };
    if (isSupabaseConfigured) await supabase.from('representatives').insert(rep);
    this.representatives.push(rep);
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة تحديث مندوب
  async updateRepresentative(id: string, data: Partial<Representative>): Promise<any> {
    const rep = this.representatives.find(r => r.id === id);
    if (!rep) return { success: false, message: 'Representative not found' };
    Object.assign(rep, { ...data, updated_at: new Date().toISOString(), version: rep.version + 1 });
    if (isSupabaseConfigured) await supabase.from('representatives').update(rep).eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  // تصحيح: إضافة دالة حذف مندوب
  async deleteRepresentative(id: string): Promise<any> {
    this.representatives = this.representatives.filter(r => r.id !== id);
    if (isSupabaseConfigured) await supabase.from('representatives').delete().eq('id', id);
    this.saveToLocalCache();
    return { success: true };
  }

  async updateSettings(newSettings: any): Promise<any> {
    this.settings = { ...this.settings, ...newSettings };
    if (isSupabaseConfigured) await supabase.from('settings').upsert({ id: 1, ...this.settings });
    this.saveToLocalCache();
    return true;
  }

  // تصحيح: إضافة دالة إضافة تصنيف مصروفات
  async addExpenseCategory(cat: string): Promise<any> {
      if (!this.settings.expenseCategories) this.settings.expenseCategories = [];
      if (!this.settings.expenseCategories.includes(cat)) {
          this.settings.expenseCategories.push(cat);
          return this.updateSettings(this.settings);
      }
      return true;
  }

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

  async saveDailyClosing(data: any): Promise<any> {
      const closing: DailyClosing = { ...this.createBase('dc-'), ...data };
      this.dailyClosings.push(closing);
      if (isSupabaseConfigured) await supabase.from('daily_closings').insert(closing);
      this.saveToLocalCache();
      return true;
  }

  async resetDatabase() {
      localStorage.removeItem('mizan_db');
      window.location.reload();
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

  getNextTransactionRef(type: CashTransactionType): string {
      return this.generateSimpleSeq(this.cashTransactions, type === 'RECEIPT' ? 'REC' : 'EXP', 'ref_number');
  }

  async recordInvoiceCollection(invoiceId: string, amount: number) { return this.recordInvoicePayment(invoiceId, amount); }

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
