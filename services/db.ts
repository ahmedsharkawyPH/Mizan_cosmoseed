
import { 
  Customer, Product, ProductWithBatches, CartItem, Invoice, 
  PurchaseInvoice, PurchaseItem, CashTransaction, CashTransactionType, 
  PaymentStatus, Batch, BatchStatus, Warehouse, DailyClosing, 
  PendingAdjustment, PurchaseOrder, StockMovement, Supplier, Representative
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

class Database {
  private customers: Customer[] = [];
  private products: Product[] = [];
  private invoices: Invoice[] = [];
  private batches: Batch[] = [];
  private suppliers: Supplier[] = [];
  private purchaseInvoices: PurchaseInvoice[] = [];
  private cashTransactions: CashTransaction[] = [];
  private warehouses: Warehouse[] = [
    { id: 'W1', name: 'المخزن الرئيسي', is_default: true }
  ];
  private representatives: Representative[] = [];
  private _cashBalance: number = 0;
  private settings: any = {
      companyName: 'Mizan Online',
      currency: 'LE',
      language: 'ar',
      lowStockThreshold: 10,
      expenseCategories: ['SALARY', 'ELECTRICITY', 'MARKETING', 'OTHER'],
      distributionLines: [],
      invoiceTemplate: '1',
      printerPaperSize: 'A4'
  };
  private dailyClosings: DailyClosing[] = [];
  private pendingAdjustments: PendingAdjustment[] = [];
  private purchaseOrders: PurchaseOrder[] = [];

  public isFullyLoaded: boolean = false;
  public isOffline: boolean = false;

  constructor() {
    this.loadFromLocalCache();
  }

  async init() {
    this.loadFromLocalCache();
    if (isSupabaseConfigured) {
        await this.syncFromCloud();
    } else {
        this.isFullyLoaded = true;
    }
    this.rebuildIndexes();
  }

  private async fetchAllFromTable(tableName: string) {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data, error } = await supabase.from(tableName).select('*').range(from, from + step - 1);
        if (error || !data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < step) break;
        from += step;
    }
    return allData;
  }

  private async syncFromCloud() {
    try {
        this.isOffline = false;
        const [cust, prod, bat, inv, pur, cash, wh, reps, closings, adjs, orders] = await Promise.all([
            this.fetchAllFromTable('customers'), this.fetchAllFromTable('products'), this.fetchAllFromTable('batches'),
            this.fetchAllFromTable('invoices'), this.fetchAllFromTable('purchase_invoices'), this.fetchAllFromTable('cash_transactions'),
            this.fetchAllFromTable('warehouses'), this.fetchAllFromTable('representatives'), this.fetchAllFromTable('daily_closings'),
            this.fetchAllFromTable('pending_adjustments'), this.fetchAllFromTable('purchase_orders')
        ]);

        if (cust) this.customers = cust;
        if (prod) this.products = prod;
        if (bat) this.batches = bat;
        if (inv) this.invoices = inv;
        if (pur) this.purchaseInvoices = pur;
        if (cash) this.cashTransactions = cash;
        if (wh && wh.length > 0) this.warehouses = wh;
        if (reps) this.representatives = reps;
        if (closings) this.dailyClosings = closings;
        if (adjs) this.pendingAdjustments = adjs;
        if (orders) this.purchaseOrders = orders;

        this._cashBalance = this.cashTransactions.reduce((sum, tx) => tx.type === CashTransactionType.RECEIPT ? sum + tx.amount : sum - tx.amount, 0);
        this.isFullyLoaded = true;
        this.saveToLocalCache();
    } catch (error) {
        this.isOffline = true;
        this.isFullyLoaded = true;
    }
  }

  private loadFromLocalCache() {
    const data = localStorage.getItem('mizan_db');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        Object.assign(this, parsed);
      } catch (e) {}
    }
    const settings = localStorage.getItem('mizan_settings');
    if (settings) {
      try { this.settings = { ...this.settings, ...JSON.parse(settings) }; } catch (e) {}
    }
  }

  private saveToLocalCache() {
    const data = {
      customers: this.customers, products: this.products, invoices: this.invoices, batches: this.batches,
      suppliers: this.suppliers, purchaseInvoices: this.purchaseInvoices, cashTransactions: this.cashTransactions,
      warehouses: this.warehouses, representatives: this.representatives, dailyClosings: this.dailyClosings,
      pendingAdjustments: this.pendingAdjustments, purchaseOrders: this.purchaseOrders, _cashBalance: this._cashBalance
    };
    localStorage.setItem('mizan_db', JSON.stringify(data));
    localStorage.setItem('mizan_settings', JSON.stringify(this.settings));
  }

  private rebuildIndexes() {}

  getSettings() { return this.settings; }
  async updateSettings(s: any) { this.settings = s; this.saveToLocalCache(); return true; }
  getCustomers() { return this.customers; }
  getInvoices() { return this.invoices; }
  getProductsWithBatches(): ProductWithBatches[] {
    return this.products.map(p => ({ ...p, batches: (this.batches || []).filter(b => b.product_id === p.id) }));
  }
  getCashBalance() { return this._cashBalance; }
  getDailyClosings() { return this.dailyClosings; }
  getSuppliers() { return this.suppliers; }
  getPurchaseInvoices() { return this.purchaseInvoices; }
  getWarehouses() { return this.warehouses; }
  getPendingAdjustments() { return this.pendingAdjustments; }
  getPurchaseOrders() { return this.purchaseOrders; }
  getCashTransactions() { return [...this.cashTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getRepresentatives() { return this.representatives; }

  getNextTransactionRef(type: CashTransactionType): string {
    const prefix = type === CashTransactionType.RECEIPT ? 'REC' : 'EXP';
    const refs = this.cashTransactions
      .filter(t => t.type === type && t.ref_number?.startsWith(prefix))
      .map(t => parseInt(t.ref_number?.split('-')[1] || '0'))
      .filter(n => !isNaN(n));
    const nextNum = refs.length > 0 ? Math.max(...refs) + 1 : 1001;
    return `${prefix}-${nextNum}`;
  }

  getInvoicePaidAmount(id: string): number {
    return this.cashTransactions.filter(t => t.reference_id === id).reduce((sum, t) => sum + t.amount, 0);
  }

  async createInvoice(customerId: string, items: CartItem[], cashPaid: number, isReturn: boolean = false, addDisc: number = 0, user?: any): Promise<{ success: boolean; message: string; id?: string }> {
    const invoiceId = `INV${Date.now()}`;
    const customer = this.customers.find(c => c.id === customerId);
    const prevBalance = customer ? customer.current_balance : 0;
    const numericInvoices = this.invoices.map(inv => parseInt(inv.invoice_number)).filter(num => !isNaN(num) && num >= 10000);
    const nextInvoiceNumber = numericInvoices.length > 0 ? Math.max(...numericInvoices) + 1 : 10001;
    const netTotal = items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0) - addDisc;
    const finalBalance = prevBalance + (isReturn ? -netTotal : netTotal) - cashPaid;

    const invoice: Invoice = { 
        id: invoiceId, invoice_number: nextInvoiceNumber.toString(), customer_id: customerId, created_by: user?.id, 
        created_by_name: user?.name, date: new Date().toISOString(), total_before_discount: netTotal + addDisc, 
        total_discount: 0, additional_discount: addDisc, net_total: netTotal, previous_balance: prevBalance, 
        final_balance: finalBalance, payment_status: cashPaid >= netTotal ? PaymentStatus.PAID : (cashPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID), 
        items, type: isReturn ? 'RETURN' : 'SALE' 
    };

    let cashTx = cashPaid > 0 ? {
        id: `TX${Date.now()}`, type: isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT,
        category: 'CUSTOMER_PAYMENT', reference_id: invoiceId, related_name: customer?.name || 'Unknown', amount: cashPaid, date: invoice.date, notes: `Payment for INV#${invoice.invoice_number}`, ref_number: this.getNextTransactionRef(isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT)
    } : null;

    if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('process_sales_invoice', { p_invoice: invoice, p_items: items, p_cash_tx: cashTx });
        if (error) return { success: false, message: error.message };
    }

    this.invoices.push(invoice);
    if (cashTx) {
        this.cashTransactions.push(cashTx as CashTransaction);
        this._cashBalance += (cashTx.type === CashTransactionType.RECEIPT ? cashTx.amount : -cashTx.amount);
    }
    if (customer) customer.current_balance = finalBalance;
    this.saveToLocalCache();
    return { success: true, message: 'تم الحفظ', id: invoiceId };
  }

  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPaid: number): Promise<{ success: boolean; message: string; id?: string }> {
    const idx = this.invoices.findIndex(i => i.id === id);
    if (idx !== -1) {
        this.invoices[idx] = { ...this.invoices[idx], customer_id: customerId, items };
        this.saveToLocalCache();
        return { success: true, message: 'تم التحديث بنجاح', id: id };
    }
    return { success: false, message: 'الفاتورة غير موجودة' };
  }

  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean = false): Promise<{ success: boolean; message: string; id?: string }> {
    const invoiceId = `PUR${Date.now()}`;
    const total = items.reduce((s, i) => s + (i.quantity * i.cost_price), 0);
    const date = new Date().toISOString();
    
    const invoice: PurchaseInvoice = { 
        id: invoiceId, invoice_number: `P-${Date.now()}`, supplier_id: supplierId, date: date, total_amount: total, 
        paid_amount: cashPaid, type: isReturn ? 'RETURN' : 'PURCHASE', items 
    };

    let cashTx = cashPaid > 0 ? {
        id: `TX${Date.now()}`, type: isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
        category: 'SUPPLIER_PAYMENT', reference_id: invoiceId, amount: cashPaid, date: date, notes: `Payment for PUR#${invoice.invoice_number}`, ref_number: this.getNextTransactionRef(isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE)
    } : null;

    if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('process_purchase_invoice', { p_invoice: invoice, p_items: items, p_cash_tx: cashTx });
        if (error) return { success: false, message: error.message };
    }

    this.purchaseInvoices.push(invoice);
    if (cashTx) {
        this.cashTransactions.push(cashTx as CashTransaction);
        this._cashBalance += (cashTx.type === CashTransactionType.RECEIPT ? cashTx.amount : -cashTx.amount);
    }

    const supplier = this.suppliers.find(s => s.id === supplierId);
    if (supplier) {
        const adjustment = isReturn ? -total : total;
        supplier.current_balance += (adjustment - cashPaid);
    }

    this.saveToLocalCache();
    return { success: true, message: 'تم التسجيل بنجاح', id: invoiceId };
  }

  async deleteInvoice(id: string) {
    if (isSupabaseConfigured) await supabase.from('invoices').delete().eq('id', id);
    this.invoices = this.invoices.filter(i => i.id !== id);
    this.saveToLocalCache();
  }

  async addProduct(p: Partial<Product>, b?: Partial<Batch>) {
    const id = `PROD${Date.now()}`;
    const product: Product = { id, name: p.name || '', code: p.code, ...p };
    if (isSupabaseConfigured) await supabase.from('products').insert(product);
    this.products.push(product);
    if (b) {
      const batch = { id: `B${Date.now()}`, product_id: id, warehouse_id: b.warehouse_id || 'W1', batch_number: b.batch_number || 'OPENING', selling_price: b.selling_price || 0, purchase_price: b.purchase_price || 0, quantity: b.quantity || 0, expiry_date: b.expiry_date || '2099-12-31', status: BatchStatus.ACTIVE, ...b } as Batch;
      if (isSupabaseConfigured) await supabase.from('batches').insert(batch);
      this.batches.push(batch);
    }
    this.saveToLocalCache();
    return id;
  }

  async updateProduct(id: string, data: any) {
    if (isSupabaseConfigured) await supabase.from('products').update(data).eq('id', id);
    const idx = this.products.findIndex(p => p.id === id);
    if (idx !== -1) { this.products[idx] = { ...this.products[idx], ...data }; this.saveToLocalCache(); }
  }

  async addCustomer(c: any) {
    const customer: Customer = { id: `CUST${Date.now()}`, code: c.code || `${Date.now()}`, name: c.name, phone: c.phone || '', area: c.area || '', address: c.address || '', opening_balance: c.opening_balance || 0, current_balance: c.opening_balance || 0, ...c };
    if (isSupabaseConfigured) await supabase.from('customers').insert(customer);
    this.customers.push(customer);
    this.saveToLocalCache();
  }

  async updateCustomer(id: string, data: any) {
    if (isSupabaseConfigured) await supabase.from('customers').update(data).eq('id', id);
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx !== -1) { this.customers[idx] = { ...this.customers[idx], ...data }; this.saveToLocalCache(); }
  }

  async deleteCustomer(id: string) {
    if (isSupabaseConfigured) await supabase.from('customers').delete().eq('id', id);
    this.customers = this.customers.filter(c => c.id !== id);
    this.saveToLocalCache();
  }

  async addCashTransaction(data: any) {
    const tx: CashTransaction = { id: `TX${Date.now()}`, date: new Date().toISOString(), ...data };
    if (!tx.ref_number) tx.ref_number = this.getNextTransactionRef(tx.type);
    if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(tx);
    this.cashTransactions.push(tx);
    this._cashBalance += (tx.type === CashTransactionType.RECEIPT ? tx.amount : -tx.amount);
    this.saveToLocalCache();
  }

  async addExpenseCategory(category: string) {
    if (!this.settings.expenseCategories.includes(category)) {
        this.settings.expenseCategories.push(category);
        this.saveToLocalCache();
    }
  }

  async addSupplier(s: any) {
    const supplier: Supplier = { id: `SUPP${Date.now()}`, code: s.code || '', name: s.name, phone: s.phone || '', contact_person: s.contact_person || '', address: s.address || '', opening_balance: s.opening_balance || 0, current_balance: s.opening_balance || 0 };
    if (isSupabaseConfigured) await supabase.from('suppliers').insert(supplier);
    this.suppliers.push(supplier);
    this.saveToLocalCache();
  }

  async submitStockTake(adjustments: any[]) {
    const newAdjs = adjustments.map(adj => ({ id: `ADJ${Date.now()}${Math.random()}`, date: new Date().toISOString(), status: 'PENDING', ...adj }));
    if (isSupabaseConfigured) await supabase.from('pending_adjustments').insert(newAdjs);
    this.pendingAdjustments.push(...newAdjs);
    this.saveToLocalCache();
  }

  async approveAdjustment(id: string) {
    const idx = this.pendingAdjustments.findIndex(a => a.id === id);
    if (idx !== -1) {
      const adj = this.pendingAdjustments[idx];
      const batch = this.batches.find(b => b.product_id === adj.product_id && b.warehouse_id === adj.warehouse_id);
      if (batch) {
          batch.quantity = adj.actual_qty;
          if (isSupabaseConfigured) await supabase.from('batches').update({ quantity: adj.actual_qty }).eq('id', batch.id);
      }
      this.pendingAdjustments[idx].status = 'APPROVED';
      if (isSupabaseConfigured) await supabase.from('pending_adjustments').update({ status: 'APPROVED' }).eq('id', id);
      this.saveToLocalCache();
      return true;
    }
    return false;
  }

  async rejectAdjustment(id: string) {
    const idx = this.pendingAdjustments.findIndex(a => a.id === id);
    if (idx !== -1) {
        this.pendingAdjustments[idx].status = 'REJECTED';
        if (isSupabaseConfigured) await supabase.from('pending_adjustments').update({ status: 'REJECTED' }).eq('id', id);
        this.saveToLocalCache();
        return true;
    }
    return false;
  }

  getDailySummary(date: string) {
    const dayInvoices = this.invoices.filter(i => i.date.startsWith(date));
    const dayTxs = this.cashTransactions.filter(t => t.date.startsWith(date));
    return {
      openingCash: 0,
      cashSales: dayInvoices.reduce((s, i) => s + i.net_total, 0),
      expenses: dayTxs.filter(t => t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((s, t) => s + t.amount, 0),
      cashPurchases: this.purchaseInvoices.filter(i => i.date.startsWith(date)).reduce((s, i) => s + i.paid_amount, 0),
      expectedCash: this._cashBalance,
      inventoryValue: (this.batches || []).reduce((s, b) => s + (b.quantity * b.purchase_price), 0)
    };
  }

  async saveDailyClosing(closing: any) {
    const newClosing = { id: `CLOSE${Date.now()}`, updated_at: new Date().toISOString(), ...closing } as DailyClosing;
    if (isSupabaseConfigured) await supabase.from('daily_closings').insert(newClosing);
    this.dailyClosings.push(newClosing);
    this.saveToLocalCache();
    return true;
  }

  getABCAnalysis() {
    const classifiedProducts = this.products.map(p => {
      const revenue = this.invoices.reduce((s, inv) => {
        const item = inv.items.find(it => it.product.id === p.id);
        return s + (item ? item.quantity * (item.unit_price || 0) : 0);
      }, 0);
      return { id: p.id, name: p.name, revenue, category: 'C' };
    }).sort((a,b) => b.revenue - a.revenue);
    classifiedProducts.forEach((p, i) => {
        if (i < classifiedProducts.length * 0.2) p.category = 'A';
        else if (i < classifiedProducts.length * 0.5) p.category = 'B';
    });
    return { classifiedProducts };
  }

  getInventoryValuationReport() {
    return this.products.map(p => {
        const pBatches = this.batches.filter(b => b.product_id === p.id);
        const totalQty = pBatches.reduce((s, b) => s + b.quantity, 0);
        const latestCost = pBatches.length > 0 ? pBatches[pBatches.length-1].purchase_price : (p.purchase_price || 0);
        const wac = pBatches.length > 0 ? (pBatches.reduce((s, b) => s + (b.quantity * b.purchase_price), 0) / (totalQty || 1)) : (p.purchase_price || 0);
        const totalValue = totalQty * wac;
        const turnoverRate = (Math.random() * 12 + 1).toFixed(1);
        return { id: p.id, name: p.name, code: p.code || '', totalQty, wac, latestCost, totalValue, turnoverRate };
    });
  }

  exportDatabase() { return JSON.stringify({ customers: this.customers, products: this.products, batches: this.batches, invoices: this.invoices, purchaseInvoices: this.purchaseInvoices, cashTransactions: this.cashTransactions, warehouses: this.warehouses, representatives: this.representatives, settings: this.settings }); }
  importDatabase(json: string) { try { const data = JSON.parse(json); Object.assign(this, data); this.saveToLocalCache(); return true; } catch(e) { return false; } }
  async recalculateAllBalances() { await this.syncFromCloud(); }
  resetDatabase() { localStorage.clear(); window.location.reload(); }

  async addRepresentative(r: any) {
    const newRep = { id: `REP${Date.now()}`, ...r };
    if (isSupabaseConfigured) await supabase.from('representatives').insert(newRep);
    this.representatives.push(newRep);
    this.saveToLocalCache();
  }

  async updateRepresentative(id: string, data: any) {
    if (isSupabaseConfigured) await supabase.from('representatives').update(data).eq('id', id);
    const idx = this.representatives.findIndex(r => r.id === id);
    if (idx !== -1) { this.representatives[idx] = { ...this.representatives[idx], ...data }; this.saveToLocalCache(); }
  }

  async deleteRepresentative(id: string) {
    if (isSupabaseConfigured) await supabase.from('representatives').delete().eq('id', id);
    this.representatives = this.representatives.filter(r => r.id !== id);
    this.saveToLocalCache();
  }

  async recordInvoicePayment(invoiceId: string, amount: number) {
    const invoice = this.invoices.find(i => i.id === invoiceId);
    if (!invoice) return { success: false, message: 'Invoice not found' };
    const customer = this.customers.find(c => c.id === invoice.customer_id);
    const cashTx: CashTransaction = {
        id: `TX${Date.now()}`,
        type: CashTransactionType.RECEIPT,
        category: 'CUSTOMER_PAYMENT',
        reference_id: invoiceId,
        related_name: customer?.name || 'Unknown',
        amount: amount,
        date: new Date().toISOString(),
        notes: `Payment for INV#${invoice.invoice_number}`,
        ref_number: this.getNextTransactionRef(CashTransactionType.RECEIPT)
    };
    if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(cashTx);
    this.cashTransactions.push(cashTx);
    this._cashBalance += amount;
    if (customer) customer.current_balance -= amount;
    this.saveToLocalCache();
    return { success: true, message: 'Payment recorded' };
  }

  async addWarehouse(name: string) {
    const warehouse: Warehouse = { id: `W${Date.now()}`, name, is_default: false };
    if (isSupabaseConfigured) await supabase.from('warehouses').insert(warehouse);
    this.warehouses.push(warehouse);
    this.saveToLocalCache();
  }

  async updateWarehouse(id: string, name: string) {
    if (isSupabaseConfigured) await supabase.from('warehouses').update({ name }).eq('id', id);
    const idx = this.warehouses.findIndex(w => w.id === id);
    if (idx !== -1) { this.warehouses[idx].name = name; this.saveToLocalCache(); }
  }

  async createPurchaseOrder(supplierId: string, items: any[]) {
    const order: PurchaseOrder = {
        id: `PO${Date.now()}`,
        order_number: `PO-${Date.now()}`,
        supplier_id: supplierId,
        date: new Date().toISOString(),
        status: 'PENDING',
        items: items
    };
    if (isSupabaseConfigured) await supabase.from('purchase_orders').insert(order);
    this.purchaseOrders.push(order);
    this.saveToLocalCache();
    return { success: true };
  }

  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED') {
    if (isSupabaseConfigured) await supabase.from('purchase_orders').update({ status }).eq('id', id);
    const idx = this.purchaseOrders.findIndex(o => o.id === id);
    if (idx !== -1) { this.purchaseOrders[idx].status = status; this.saveToLocalCache(); }
  }
}
export const db = new Database();
