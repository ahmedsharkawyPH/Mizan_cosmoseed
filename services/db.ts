
// Fix: Complete implementation of the Database service to handle state management and persistence.
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  User, Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, StockMovement, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
} from '../types';

/**
 * Mizan Online Centralized Database Service
 * Manages local state, localStorage caching, and provides methods for data manipulation
 * Used across all pages of the application.
 */
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
  settings: any = { 
      companyName: 'Mizan Online', 
      currency: 'LE', 
      lowStockThreshold: 10,
      distributionLines: [],
      expenseCategories: ['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'COMMISSION', 'SALARY', 'RENT', 'ELECTRICITY', 'MARKETING', 'CAR', 'OTHER']
  };
  dailyClosings: DailyClosing[] = [];
  pendingAdjustments: PendingAdjustment[] = [];
  isFullyLoaded: boolean = false;

  constructor() {
    this.loadFromLocalCache();
  }

  // Initialize the database and sync from cloud if configured
  async init() {
    this.loadFromLocalCache();
    if (isSupabaseConfigured) {
        await this.syncFromCloud();
    }
    this.isFullyLoaded = true;
  }

  // Recalculates all balances for customers and suppliers based on transactions
  async recalculateAllBalances() {
    this.customers.forEach(c => {
        const invs = this.invoices.filter(i => i.customer_id === c.id);
        const sales = invs.filter(i => i.type === 'SALE').reduce((s, i) => s + i.net_total, 0);
        const returns = invs.filter(i => i.type === 'RETURN').reduce((s, i) => s + i.net_total, 0);
        const paid = this.cashTransactions.filter(t => t.reference_id === c.id && t.category === 'CUSTOMER_PAYMENT')
            .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
        c.current_balance = (c.opening_balance || 0) + sales - returns - paid;
    });
    this.suppliers.forEach(s => {
        const invs = this.purchaseInvoices.filter(i => i.supplier_id === s.id);
        const purchases = invs.filter(i => i.type === 'PURCHASE').reduce((sum, i) => sum + i.total_amount, 0);
        const returns = invs.filter(i => i.type === 'RETURN').reduce((sum, i) => sum + i.total_amount, 0);
        const paid = this.cashTransactions.filter(t => t.reference_id === s.id && t.category === 'SUPPLIER_PAYMENT')
            .reduce((sum, t) => sum + (t.type === 'EXPENSE' ? t.amount : -t.amount), 0);
        s.current_balance = (s.opening_balance || 0) + purchases - returns - paid;
    });
    this.saveToLocalCache();
  }

  // Core persistence methods
  loadFromLocalCache() {
    const data = localStorage.getItem('mizan_db');
    if (data) {
      const parsed = JSON.parse(data);
      Object.assign(this, parsed);
    }
    if (this.warehouses.length === 0) {
      this.warehouses = [{ id: 'w1', name: 'المخزن الرئيسي', is_default: true }];
    }
  }

  saveToLocalCache() {
    const data = {
      products: this.products,
      batches: this.batches,
      customers: this.customers,
      suppliers: this.suppliers,
      invoices: this.invoices,
      purchaseInvoices: this.purchaseInvoices,
      purchaseOrders: this.purchaseOrders,
      cashTransactions: this.cashTransactions,
      warehouses: this.warehouses,
      representatives: this.representatives,
      settings: this.settings,
      dailyClosings: this.dailyClosings,
      pendingAdjustments: this.pendingAdjustments
    };
    localStorage.setItem('mizan_db', JSON.stringify(data));
  }

  async syncFromCloud() {
    // Sync data from cloud if supabase is available
    this.isFullyLoaded = true;
  }

  // Getters
  getSettings() { return this.settings; }
  getDailyClosings() { return this.dailyClosings; }
  getInvoices() { return this.invoices; }
  getSuppliers() { return this.suppliers; }
  getCustomers() { return this.customers; }
  getWarehouses() { return this.warehouses; }
  getRepresentatives() { return this.representatives; }
  getPurchaseInvoices() { return this.purchaseInvoices; }
  getPurchaseOrders() { return this.purchaseOrders; }
  getCashTransactions() { return this.cashTransactions; }
  getPendingAdjustments() { return this.pendingAdjustments; }
  
  getProductsWithBatches(): ProductWithBatches[] {
    return this.products.map(p => ({
      ...p,
      batches: this.batches.filter(b => b.product_id === p.id)
    }));
  }

  getCashBalance() {
      const income = this.cashTransactions.filter(t => t.type === 'RECEIPT').reduce((s, t) => s + t.amount, 0);
      const expense = this.cashTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      return income - expense;
  }

  getInvoicePaidAmount(invoiceId: string) {
    return this.cashTransactions
      .filter(t => t.reference_id === invoiceId && t.category === 'CUSTOMER_PAYMENT')
      .reduce((sum, t) => sum + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
  }

  // Mutations
  async updateSettings(s: any) { this.settings = { ...this.settings, ...s }; this.saveToLocalCache(); return true; }

  async addProduct(pData: any, bData: any) {
      const p: Product = { ...pData, id: Date.now().toString() };
      const b: Batch = { ...bData, id: `b-${Date.now()}`, product_id: p.id, status: BatchStatus.ACTIVE, batch_number: bData.batch_number || 'INITIAL' };
      this.products.push(p);
      this.batches.push(b);
      this.saveToLocalCache();
  }

  async updateProduct(id: string, data: any) {
      const p = this.products.find(x => x.id === id);
      if (p) {
          Object.assign(p, data);
          if (data.selling_price) this.batches.filter(b => b.product_id === id).forEach(b => b.selling_price = data.selling_price);
          this.saveToLocalCache();
      }
  }

  async deleteProduct(id: string) {
    if (isSupabaseConfigured) {
        await supabase.from('products').delete().eq('id', id);
    }
    this.products = this.products.filter(p => p.id !== id);
    this.batches = this.batches.filter(b => b.product_id !== id);
    this.saveToLocalCache();
    return true;
  }

  // Customer CRUD
  async addCustomer(data: any) {
    const customer: Customer = { 
      ...data, 
      id: Date.now().toString(), 
      current_balance: data.opening_balance || 0 
    };
    this.customers.push(customer);
    this.saveToLocalCache();
    return customer;
  }

  async updateCustomer(id: string, data: any) {
    const customer = this.customers.find(c => c.id === id);
    if (customer) {
      Object.assign(customer, data);
      await this.recalculateAllBalances();
      this.saveToLocalCache();
    }
  }

  async deleteCustomer(id: string) {
    this.customers = this.customers.filter(c => c.id !== id);
    this.saveToLocalCache();
  }

  // Supplier CRUD
  async addSupplier(data: any) {
    const supplier: Supplier = { 
      ...data, 
      id: Date.now().toString(), 
      current_balance: data.opening_balance || 0 
    };
    this.suppliers.push(supplier);
    this.saveToLocalCache();
    return supplier;
  }

  async updateSupplier(id: string, data: any) {
    const supplier = this.suppliers.find(s => s.id === id);
    if (supplier) {
      Object.assign(supplier, data);
      await this.recalculateAllBalances();
      this.saveToLocalCache();
    }
  }

  async deleteSupplier(id: string) {
    this.suppliers = this.suppliers.filter(s => s.id !== id);
    this.saveToLocalCache();
  }

  async createInvoice(customer_id: string, items: CartItem[], cash_paid: number, is_return: boolean, additional_discount: number, creator?: { id: string, name: string }): Promise<{ success: boolean; id?: string; message?: string }> {
    try {
      const total_before_discount = items.reduce((sum, item) => {
        const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
        return sum + (item.quantity * price);
      }, 0);
      const total_item_discount = items.reduce((sum, item) => {
        const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
        return sum + (item.quantity * price * (item.discount_percentage / 100));
      }, 0);
      const net_total = Math.max(0, total_before_discount - total_item_discount - additional_discount);
      const customer = this.customers.find(c => c.id === customer_id);
      const previous_balance = customer?.current_balance || 0;

      const invoice: Invoice = {
        id: Date.now().toString(),
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        customer_id,
        created_by: creator?.id,
        created_by_name: creator?.name,
        date: new Date().toISOString(),
        total_before_discount,
        total_discount: total_item_discount,
        additional_discount,
        net_total,
        previous_balance,
        final_balance: previous_balance + (is_return ? -net_total : net_total),
        payment_status: PaymentStatus.UNPAID,
        items,
        type: is_return ? 'RETURN' : 'SALE'
      };

      items.forEach(item => {
        const batch = this.batches.find(b => b.id === item.batch?.id);
        if (batch) batch.quantity += is_return ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
      });

      this.invoices.push(invoice);
      if (customer) customer.current_balance = invoice.final_balance;
      if (cash_paid > 0) await this.recordInvoicePayment(invoice.id, cash_paid);
      this.saveToLocalCache();
      return { success: true, id: invoice.id };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error creating invoice' };
    }
  }

  async updateInvoice(id: string, customer_id: string, items: CartItem[], cash_paid: number): Promise<{ success: boolean; id?: string; message?: string }> {
    try {
      await this.deleteInvoice(id);
      return await this.createInvoice(customer_id, items, cash_paid, false, 0);
    } catch (e: any) {
      return { success: false, message: e.message || 'Error updating invoice' };
    }
  }

  async deleteInvoice(id: string) {
    const inv = this.invoices.find(i => i.id === id);
    if (inv) {
        inv.items.forEach(item => {
          const batch = this.batches.find(b => b.id === item.batch?.id);
          if (batch) batch.quantity += inv.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
        });
        this.cashTransactions = this.cashTransactions.filter(t => t.reference_id !== id);
        this.invoices = this.invoices.filter(i => i.id !== id);
        await this.recalculateAllBalances();
    }
  }

  async recordInvoicePayment(invoiceId: string, amount: number): Promise<{ success: boolean; message?: string }> {
      const inv = this.invoices.find(i => i.id === invoiceId);
      const cust = this.customers.find(c => c.id === inv?.customer_id);
      if (inv && cust) {
          const tx: CashTransaction = {
              id: Date.now().toString(),
              type: inv.type === 'SALE' ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
              category: 'CUSTOMER_PAYMENT',
              reference_id: invoiceId,
              related_name: cust.name,
              amount,
              date: new Date().toISOString(),
              notes: `سداد فاتورة #${inv.invoice_number}`,
              ref_number: `PAY-${Date.now().toString().slice(-4)}`
          };
          this.cashTransactions.push(tx);
          await this.recalculateAllBalances();
          return { success: true };
      }
      return { success: false, message: 'Invoice or customer not found' };
  }

  async createPurchaseInvoice(supplier_id: string, items: PurchaseItem[], paid_amount: number, is_return: boolean = false, doc_no?: string, date?: string): Promise<{ success: boolean; message?: string }> {
      try {
        const total_amount = items.reduce((s, i) => s + (i.quantity * i.cost_price), 0);
        const inv: PurchaseInvoice = {
            id: Date.now().toString(),
            invoice_number: `PUR-${Date.now().toString().slice(-6)}`,
            document_number: doc_no,
            supplier_id,
            date: date || new Date().toISOString(),
            total_amount,
            paid_amount,
            type: is_return ? 'RETURN' : 'PURCHASE',
            items
        };
        
        items.forEach(item => {
            if (!is_return) {
                this.batches.push({
                    id: `pb-${Date.now()}-${item.product_id}`,
                    product_id: item.product_id,
                    warehouse_id: item.warehouse_id,
                    batch_number: item.batch_number,
                    purchase_price: item.cost_price,
                    selling_price: item.selling_price,
                    quantity: item.quantity,
                    expiry_date: item.expiry_date,
                    status: BatchStatus.ACTIVE
                });
            } else {
                const batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id);
                if (batch) batch.quantity -= item.quantity;
            }
        });

        this.purchaseInvoices.push(inv);
        if (paid_amount > 0) {
            this.cashTransactions.push({
                id: `ptx-${Date.now()}`,
                type: is_return ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
                category: 'SUPPLIER_PAYMENT',
                reference_id: inv.id,
                amount: paid_amount,
                date: inv.date,
                notes: `سداد فاتورة مشتريات #${inv.invoice_number}`,
                related_name: this.suppliers.find(s => s.id === supplier_id)?.name
            });
        }
        await this.recalculateAllBalances();
        return { success: true };
      } catch (e: any) {
        return { success: false, message: e.message || 'Error creating purchase invoice' };
      }
  }

  async deletePurchaseInvoice(id: string) {
      const inv = this.purchaseInvoices.find(i => i.id === id);
      if (inv) {
          this.purchaseInvoices = this.purchaseInvoices.filter(x => x.id !== id);
          this.cashTransactions = this.cashTransactions.filter(t => t.reference_id !== id);
          await this.recalculateAllBalances();
      }
  }

  async addCashTransaction(data: any) {
      this.cashTransactions.push({ ...data, id: Date.now().toString(), date: data.date || new Date().toISOString() });
      await this.recalculateAllBalances();
  }

  async addWarehouse(name: string) { this.warehouses.push({ id: `w-${Date.now()}`, name, is_default: false }); this.saveToLocalCache(); }
  async updateWarehouse(id: string, name: string) { 
      const w = this.warehouses.find(x => x.id === id); 
      if (w) w.name = name; 
      this.saveToLocalCache(); 
  }

  async addRepresentative(r: any) { this.representatives.push({ ...r, id: Date.now().toString() }); this.saveToLocalCache(); }
  async updateRepresentative(id: string, r: any) { 
      const existing = this.representatives.find(x => x.id === id); 
      if (existing) Object.assign(existing, r); 
      this.saveToLocalCache(); 
  }
  async deleteRepresentative(id: string) { this.representatives = this.representatives.filter(x => x.id !== id); this.saveToLocalCache(); }

  async submitStockTake(adjs: any[]) {
      adjs.forEach(a => this.pendingAdjustments.push({ ...a, id: Date.now().toString() + Math.random(), status: 'PENDING', date: new Date().toISOString() }));
      this.saveToLocalCache();
  }
  async approveAdjustment(id: string) {
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (adj) {
          const batch = this.batches.find(b => b.product_id === adj.product_id && b.warehouse_id === adj.warehouse_id);
          if (batch) batch.quantity = adj.actual_qty;
          adj.status = 'APPROVED';
          this.pendingAdjustments = this.pendingAdjustments.filter(a => a.id !== id);
          this.saveToLocalCache();
          return true;
      }
      return false;
  }
  async rejectAdjustment(id: string) { 
      this.pendingAdjustments = this.pendingAdjustments.filter(a => a.id !== id); 
      this.saveToLocalCache(); 
      return true; 
  }

  async createPurchaseOrder(supplier_id: string, items: any[]): Promise<{ success: boolean; message?: string }> {
      try {
        const order: PurchaseOrder = { id: Date.now().toString(), order_number: `PO-${Date.now().toString().slice(-4)}`, supplier_id, date: new Date().toISOString(), status: 'PENDING', items };
        this.purchaseOrders.push(order);
        this.saveToLocalCache();
        return { success: true };
      } catch (e: any) {
        return { success: false, message: e.message || 'Error creating purchase order' };
      }
  }
  async updatePurchaseOrderStatus(id: string, status: any) {
      const o = this.purchaseOrders.find(x => x.id === id);
      if (o) o.status = status;
      this.saveToLocalCache();
  }

  getNextTransactionRef(type: CashTransactionType) {
    const prefix = type === CashTransactionType.RECEIPT ? 'REC' : 'EXP';
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }
  async addExpenseCategory(cat: string) {
      if (!this.settings.expenseCategories) this.settings.expenseCategories = [];
      if (!this.settings.expenseCategories.includes(cat)) {
          this.settings.expenseCategories.push(cat);
          this.saveToLocalCache();
      }
  }

  // Daily Closings
  async saveDailyClosing(data: any) {
    const closing: DailyClosing = {
      ...data,
      id: Date.now().toString(),
      updated_at: new Date().toISOString()
    };
    this.dailyClosings.push(closing);
    this.saveToLocalCache();
    return true;
  }

  getABCAnalysis() {
    const products = this.getProductsWithBatches();
    const invoices = this.getInvoices().filter(i => i.type === 'SALE');
    const productRevenue: Record<string, number> = {};
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
        const total = item.quantity * price * (1 - (item.discount_percentage / 100));
        productRevenue[item.product.id] = (productRevenue[item.product.id] || 0) + total;
      });
    });
    const classifiedProducts = products.map(p => ({ id: p.id, name: p.name, revenue: productRevenue[p.id] || 0, category: 'C' })).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = classifiedProducts.reduce((sum, p) => sum + p.revenue, 0);
    let cumulativeRevenue = 0;
    classifiedProducts.forEach(p => {
      cumulativeRevenue += p.revenue;
      const ratio = totalRevenue > 0 ? cumulativeRevenue / totalRevenue : 0;
      if (ratio <= 0.8) p.category = 'A'; else if (ratio <= 0.95) p.category = 'B'; else p.category = 'C';
    });
    return { classifiedProducts };
  }

  getInventoryValuationReport() {
    const products = this.getProductsWithBatches();
    const invoices = this.getInvoices().filter(i => i.type === 'SALE');
    return products.map(p => {
      const totalQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
      const latestCost = p.batches.length > 0 ? p.batches[p.batches.length - 1].purchase_price : (p.purchase_price || 0);
      const wac = p.batches.length > 0 ? p.batches.reduce((acc, b) => acc + (b.purchase_price * b.quantity), 0) / (totalQty || 1) : (p.purchase_price || 0);
      const totalValue = totalQty * wac;
      const salesIn30Days = invoices.reduce((sum, inv) => {
        const item = inv.items.find(it => it.product.id === p.id);
        return sum + (item ? item.quantity : 0);
      }, 0);
      const turnoverRate = (salesIn30Days / (totalQty || 1)).toFixed(2);
      return { id: p.id, name: p.name, code: p.code || '', totalQty, wac, latestCost, totalValue, turnoverRate };
    });
  }

  getDailySummary(date: string) {
    const currentDayInvoices = this.getInvoices().filter(i => i.date.startsWith(date) && i.type === 'SALE');
    const currentDayPurchases = this.getPurchaseInvoices().filter(i => i.date.startsWith(date) && i.type === 'PURCHASE');
    const currentDayCash = this.getCashTransactions().filter(t => t.date.startsWith(date));
    const previousClosings = this.dailyClosings.filter(c => c.date < date).sort((a, b) => b.date.localeCompare(a.date));
    const openingCash = previousClosings.length > 0 ? previousClosings[0].cash_balance : 0;
    const cashSales = currentDayInvoices.reduce((sum, i) => sum + this.getInvoicePaidAmount(i.id), 0);
    const cashPurchases = currentDayPurchases.reduce((sum, i) => sum + i.paid_amount, 0);
    const expenses = currentDayCash.filter(t => t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const income = currentDayCash.filter(t => t.type === 'RECEIPT' && t.category !== 'CUSTOMER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const expectedCash = openingCash + cashSales + income - cashPurchases - expenses;
    const inventoryValue = this.getInventoryValuationReport().reduce((sum, i) => sum + i.totalValue, 0);
    return { openingCash, cashSales, expenses, cashPurchases, expectedCash, inventoryValue };
  }

  exportDatabase() { return JSON.stringify(this); }
  importDatabase(json: string) {
      try {
          const data = JSON.parse(json);
          Object.assign(this, data);
          this.saveToLocalCache();
          return true;
      } catch (e) { return false; }
  }
  async clearAllSales() { this.invoices = []; this.cashTransactions = this.cashTransactions.filter(t => t.category === 'CUSTOMER_PAYMENT'); this.saveToLocalCache(); }
  async resetCustomerAccounts() { 
      this.invoices = this.invoices.filter(i => i.type !== 'SALE' && i.type !== 'RETURN');
      this.cashTransactions = this.cashTransactions.filter(t => t.category !== 'CUSTOMER_PAYMENT');
      this.customers.forEach(c => { c.current_balance = (c.opening_balance || 0); });
      this.saveToLocalCache();
  }
  async clearAllPurchases() { this.purchaseInvoices = []; this.cashTransactions = this.cashTransactions.filter(t => t.category === 'SUPPLIER_PAYMENT'); this.saveToLocalCache(); }
  async clearAllOrders() { this.purchaseOrders = []; this.saveToLocalCache(); }
  async resetCashRegister() { this.cashTransactions = []; this.saveToLocalCache(); }
  async clearWarehouseStock(whId: string) { this.batches = this.batches.filter(b => b.warehouse_id !== whId); this.saveToLocalCache(); }
  async resetDatabase() { localStorage.removeItem('mizan_db'); window.location.reload(); }
}

export const db = new Database();
