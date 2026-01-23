import { 
  Customer, Product, ProductWithBatches, CartItem, Invoice, 
  PurchaseInvoice, PurchaseItem, CashTransaction, CashTransactionType, 
  PaymentStatus, Batch, BatchStatus, Warehouse, DailyClosing, 
  PendingAdjustment, PurchaseOrder, StockMovement, Supplier, Representative
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

// Class to manage all application data operations with local storage persistence and optional Supabase sync
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
      currency: '$',
      lowStockThreshold: 10,
      expenseCategories: ['SALARY', 'ELECTRICITY', 'MARKETING', 'OTHER'],
      distributionLines: []
  };
  private dailyClosings: DailyClosing[] = [];
  private pendingAdjustments: PendingAdjustment[] = [];
  private purchaseOrders: PurchaseOrder[] = [];

  public isFullyLoaded: boolean = true;
  public isOffline: boolean = false;

  constructor() {
    this.loadFromLocalCache();
  }

  // Initialize the database, checking for local cache and optionally syncing
  async init() {
    this.loadFromLocalCache();
    this.rebuildIndexes();
  }

  private loadFromLocalCache() {
    const data = localStorage.getItem('mizan_db');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.customers) this.customers = parsed.customers;
        if (parsed.products) this.products = parsed.products;
        if (parsed.invoices) this.invoices = parsed.invoices;
        if (parsed.batches) this.batches = parsed.batches;
        if (parsed.suppliers) this.suppliers = parsed.suppliers;
        if (parsed.purchaseInvoices) this.purchaseInvoices = parsed.purchaseInvoices;
        if (parsed.cashTransactions) this.cashTransactions = parsed.cashTransactions;
        if (parsed.warehouses) this.warehouses = parsed.warehouses;
        if (parsed.representatives) this.representatives = parsed.representatives;
        if (parsed.dailyClosings) this.dailyClosings = parsed.dailyClosings;
        if (parsed.pendingAdjustments) this.pendingAdjustments = parsed.pendingAdjustments;
        if (parsed.purchaseOrders) this.purchaseOrders = parsed.purchaseOrders;
        if (parsed._cashBalance !== undefined) this._cashBalance = parsed._cashBalance;
      } catch (e) {
        console.error("Failed to load local cache", e);
      }
    }
    const settings = localStorage.getItem('mizan_settings');
    if (settings) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(settings) };
      } catch (e) {}
    }
  }

  private saveToLocalCache() {
    const data = {
      customers: this.customers,
      products: this.products,
      invoices: this.invoices,
      batches: this.batches,
      suppliers: this.suppliers,
      purchaseInvoices: this.purchaseInvoices,
      cashTransactions: this.cashTransactions,
      warehouses: this.warehouses,
      representatives: this.representatives,
      dailyClosings: this.dailyClosings,
      pendingAdjustments: this.pendingAdjustments,
      purchaseOrders: this.purchaseOrders,
      _cashBalance: this._cashBalance
    };
    localStorage.setItem('mizan_db', JSON.stringify(data));
    localStorage.setItem('mizan_settings', JSON.stringify(this.settings));
  }

  private rebuildIndexes() {
    // Placeholder for future index rebuilding logic if needed for performance
  }

  // Settings management
  getSettings() { return this.settings; }
  async updateSettings(s: any) { 
    this.settings = s; 
    this.saveToLocalCache(); 
    return true; 
  }

  // Basic entity getters
  getCustomers() { return this.customers; }
  getInvoices() { return this.invoices; }
  getProductsWithBatches(): ProductWithBatches[] {
    return this.products.map(p => ({
      ...p,
      batches: this.batches.filter(b => b.product_id === p.id)
    }));
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

  getInvoicePaidAmount(id: string): number {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return 0;
    return this.cashTransactions
      .filter(t => t.ref_number === `PAY-${inv.invoice_number}`)
      .reduce((sum, t) => sum + t.amount, 0);
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
        id: invoiceId, 
        invoice_number: nextInvoiceNumber.toString(), 
        customer_id: customerId, 
        created_by: user?.id, 
        created_by_name: user?.name, 
        date: new Date().toISOString(), 
        total_before_discount: netTotal + addDisc, 
        total_discount: 0, 
        additional_discount: addDisc, 
        net_total: netTotal, 
        previous_balance: prevBalance, 
        final_balance: finalBalance, 
        payment_status: cashPaid >= netTotal ? PaymentStatus.PAID : (cashPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID), 
        items, 
        type: isReturn ? 'RETURN' : 'SALE' 
    };

    let cashTx = null;
    if (cashPaid > 0) {
        cashTx = {
            id: `TX${Date.now()}`,
            ref_number: `PAY-${invoice.invoice_number}`,
            type: isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT,
            category: 'CUSTOMER_PAYMENT',
            reference_id: customerId,
            related_name: customer?.name || 'Unknown',
            amount: cashPaid,
            date: invoice.date,
            notes: `Payment for INV#${invoice.invoice_number}`
        };
    }

    if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('process_sales_invoice', {
            p_invoice: invoice,
            p_items: items,
            p_cash_tx: cashTx
        });
        
        if (error) {
            console.error("Atomic Sales Error:", error.message);
            return { success: false, message: `فشلت العملية في قاعدة البيانات: ${error.message}` };
        }
    }

    this.invoices.push(invoice);
    if (cashTx) {
        this.cashTransactions.push(cashTx as CashTransaction);
        if (cashTx.type === CashTransactionType.RECEIPT) this._cashBalance += cashTx.amount;
        else this._cashBalance -= cashTx.amount;
    }
    
    for (const item of items) {
        if (item.batch) {
            const bIdx = this.batches.findIndex(b => b.id === item.batch?.id);
            if (bIdx !== -1) {
                const deduction = item.quantity + (item.bonus_quantity || 0);
                this.batches[bIdx].quantity -= (isReturn ? -deduction : deduction);
            }
        }
    }

    if (customer) customer.current_balance = finalBalance;
    this.saveToLocalCache();
    this.rebuildIndexes();
    return { success: true, message: 'تم الحفظ بنجاح', id: invoiceId };
  }

  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean = false): Promise<{ success: boolean; message: string; id?: string }> {
    const invoiceId = `PUR${Date.now()}`;
    const total = items.reduce((s, i) => s + (i.quantity * i.cost_price), 0);
    const date = new Date().toISOString();
    
    const invoice: PurchaseInvoice = { 
        id: invoiceId, 
        invoice_number: `P-${Date.now()}`, 
        supplier_id: supplierId, 
        date: date, 
        total_amount: total, 
        paid_amount: cashPaid, 
        type: isReturn ? 'RETURN' : 'PURCHASE', 
        items 
    };

    let cashTx = null;
    if (cashPaid > 0) {
        cashTx = {
            id: `TX${Date.now()}`,
            type: isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
            category: 'SUPPLIER_PAYMENT',
            reference_id: supplierId,
            amount: cashPaid,
            date: date,
            notes: `Payment for PUR#${invoice.invoice_number}`
        };
    }

    if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('process_purchase_invoice', {
            p_invoice: invoice,
            p_items: items,
            p_cash_tx: cashTx
        });
        
        if (error) {
            console.error("Atomic Purchase Error:", error.message);
            return { success: false, message: `فشل تسجيل المشتريات: ${error.message}` };
        }
    }

    this.purchaseInvoices.push(invoice);
    if (cashTx) {
        this.cashTransactions.push(cashTx as CashTransaction);
        if (cashTx.type === CashTransactionType.RECEIPT) this._cashBalance += cashTx.amount;
        else this._cashBalance -= cashTx.amount;
    }

    const supplier = this.suppliers.find(s => s.id === supplierId);
    if (supplier) {
        const adjustment = isReturn ? -total : total;
        supplier.current_balance += (adjustment - cashPaid);
    }

    for (const item of items) {
        let batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id && b.batch_number === item.batch_number);
        if (batch) {
            batch.quantity += (isReturn ? -item.quantity : item.quantity);
        } else if (!isReturn) {
            this.batches.push({ 
                id: `B${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, 
                product_id: item.product_id, 
                warehouse_id: item.warehouse_id, 
                batch_number: item.batch_number, 
                quantity: item.quantity, 
                purchase_price: item.cost_price, 
                selling_price: item.selling_price, 
                expiry_date: item.expiry_date, 
                status: BatchStatus.ACTIVE 
            });
        }
    }

    this.rebuildIndexes();
    this.saveToLocalCache();
    return { success: true, message: 'تم تسجيل المشتريات', id: invoiceId };
  }

  // Updated to include id in the return object to fix build error
  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPaid: number): Promise<{ success: boolean; message?: string; id?: string }> {
      const idx = this.invoices.findIndex(i => i.id === id);
      if (idx !== -1) {
          this.invoices[idx] = { ...this.invoices[idx], customer_id: customerId, items };
          this.saveToLocalCache();
          return { success: true, id };
      }
      return { success: false, message: 'Invoice not found', id };
  }

  async deleteInvoice(id: string) {
    this.invoices = this.invoices.filter(i => i.id !== id);
    this.saveToLocalCache();
  }

  async addProduct(p: Partial<Product>, b?: Partial<Batch>) {
    const id = `PROD${Date.now()}`;
    const product: Product = { id, name: p.name || '', code: p.code, ...p };
    this.products.push(product);
    if (b) {
      this.batches.push({
        id: `B${Date.now()}`,
        product_id: id,
        warehouse_id: b.warehouse_id || 'W1',
        batch_number: b.batch_number || 'OPENING',
        selling_price: b.selling_price || 0,
        purchase_price: b.purchase_price || 0,
        quantity: b.quantity || 0,
        expiry_date: b.expiry_date || '2099-12-31',
        status: BatchStatus.ACTIVE,
        ...b
      } as Batch);
    }
    this.saveToLocalCache();
    return id;
  }

  async updateProduct(id: string, data: any) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.products[idx] = { ...this.products[idx], ...data };
      this.saveToLocalCache();
    }
  }

  async deleteProduct(id: string) {
    this.products = this.products.filter(p => p.id !== id);
    this.batches = this.batches.filter(b => b.product_id !== id);
    this.saveToLocalCache();
  }

  getProductMovements(id: string): StockMovement[] { 
    return []; 
  }

  addCustomer(c: any) {
    const customer: Customer = { 
      id: `CUST${Date.now()}`, code: c.code || `${Date.now()}`, name: c.name, 
      phone: c.phone || '', area: c.area || '', address: c.address || '', 
      opening_balance: c.opening_balance || 0, current_balance: c.opening_balance || 0, ...c 
    };
    this.customers.push(customer);
    this.saveToLocalCache();
  }

  updateCustomer(id: string, data: any) {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.customers[idx] = { ...this.customers[idx], ...data };
      this.saveToLocalCache();
    }
  }

  deleteCustomer(id: string) {
    this.customers = this.customers.filter(c => c.id !== id);
    this.saveToLocalCache();
  }

  getNextTransactionRef(type: CashTransactionType) {
    return `${type === 'RECEIPT' ? 'REC' : 'EXP'}-${Date.now().toString().slice(-6)}`;
  }

  addCashTransaction(data: any) {
    const tx: CashTransaction = { id: `TX${Date.now()}`, date: new Date().toISOString(), ...data };
    this.cashTransactions.push(tx);
    if (tx.type === CashTransactionType.RECEIPT) this._cashBalance += tx.amount;
    else this._cashBalance -= tx.amount;
    this.saveToLocalCache();
  }

  addExpenseCategory(cat: string) {
    if (!this.settings.expenseCategories.includes(cat)) {
      this.settings.expenseCategories.push(cat);
      this.saveToLocalCache();
    }
  }

  addSupplier(s: any) {
    const supplier: Supplier = { 
      id: `SUPP${Date.now()}`, code: s.code || '', name: s.name, phone: s.phone || '', 
      contact_person: s.contact_person || '', address: s.address || '', 
      opening_balance: s.opening_balance || 0, current_balance: s.opening_balance || 0 
    };
    this.suppliers.push(supplier);
    this.saveToLocalCache();
  }

  async recordInvoicePayment(invoiceId: string, amount: number) {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (inv) {
      this.addCashTransaction({
        type: CashTransactionType.RECEIPT,
        category: 'CUSTOMER_PAYMENT',
        reference_id: inv.customer_id,
        related_name: this.customers.find(c => c.id === inv.customer_id)?.name,
        amount,
        notes: `Payment for INV#${inv.invoice_number}`,
        ref_number: `PAY-${inv.invoice_number}`
      });
      return { success: true };
    }
    return { success: false, message: 'Invoice not found' };
  }

  async createPurchaseOrder(supplierId: string, items: any[]) {
    const order: PurchaseOrder = { 
      id: `PO${Date.now()}`, order_number: `PO-${Date.now().toString().slice(-6)}`, 
      supplier_id: supplierId, date: new Date().toISOString(), status: 'PENDING', items 
    };
    this.purchaseOrders.push(order);
    this.saveToLocalCache();
    return { success: true };
  }

  updatePurchaseOrderStatus(id: string, status: any) {
    const idx = this.purchaseOrders.findIndex(o => o.id === id);
    if (idx !== -1) { this.purchaseOrders[idx].status = status; this.saveToLocalCache(); }
  }

  async submitStockTake(adjustments: any[]) {
    adjustments.forEach(adj => {
      this.pendingAdjustments.push({ 
        id: `ADJ${Date.now()}${Math.random()}`, date: new Date().toISOString(), 
        status: 'PENDING', ...adj 
      });
    });
    this.saveToLocalCache();
  }

  async approveAdjustment(id: string) {
    const idx = this.pendingAdjustments.findIndex(a => a.id === id);
    if (idx !== -1) {
      const adj = this.pendingAdjustments[idx];
      const batch = this.batches.find(b => b.product_id === adj.product_id && b.warehouse_id === adj.warehouse_id);
      if (batch) batch.quantity = adj.actual_qty;
      this.pendingAdjustments[idx].status = 'APPROVED';
      this.saveToLocalCache();
      return true;
    }
    return false;
  }

  async rejectAdjustment(id: string) {
    const idx = this.pendingAdjustments.findIndex(a => a.id === id);
    if (idx !== -1) { 
      this.pendingAdjustments[idx].status = 'REJECTED'; 
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
      inventoryValue: this.batches.reduce((s, b) => s + (b.quantity * b.purchase_price), 0)
    };
  }

  async saveDailyClosing(closing: any) {
    this.dailyClosings.push({ 
      id: `CLOSE${Date.now()}`, updated_at: new Date().toISOString(), ...closing 
    } as DailyClosing);
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
      const latestCost = pBatches.length > 0 ? pBatches[pBatches.length - 1].purchase_price : (p.purchase_price || 0);
      return { 
        id: p.id, name: p.name, code: p.code || '', totalQty, wac: latestCost, 
        latestCost, totalValue: totalQty * latestCost, turnoverRate: '5.0' 
      };
    });
  }

  exportDatabase() { return JSON.stringify({ ...this }); }
  importDatabase(json: string) { 
    try { 
      const data = JSON.parse(json); 
      Object.assign(this, data); 
      this.saveToLocalCache(); 
      return true; 
    } catch(e) { return false; } 
  }
  
  recalculateAllBalances() {
  }
  
  resetDatabase() { localStorage.clear(); window.location.reload(); }

  addRepresentative(r: any) {
    this.representatives.push({ id: `REP${Date.now()}`, ...r });
    this.saveToLocalCache();
  }
  updateRepresentative(id: string, data: any) {
    const idx = this.representatives.findIndex(r => r.id === id);
    if (idx !== -1) { 
      this.representatives[idx] = { ...this.representatives[idx], ...data }; 
      this.saveToLocalCache(); 
    }
  }
  deleteRepresentative(id: string) {
    this.representatives = this.representatives.filter(r => r.id !== id);
    this.saveToLocalCache();
  }

  addWarehouse(name: string) {
    this.warehouses.push({ id: `WH${Date.now()}`, name, is_default: false });
    this.saveToLocalCache();
  }
  updateWarehouse(id: string, name: string) {
    const idx = this.warehouses.findIndex(w => w.id === id);
    if (idx !== -1) { this.warehouses[idx].name = name; this.saveToLocalCache(); }
  }
}

export const db = new Database();
