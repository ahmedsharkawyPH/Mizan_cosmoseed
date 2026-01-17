
import { supabase, isSupabaseConfigured } from './supabase';
import {
  Product,
  Batch,
  Customer,
  Supplier,
  Invoice,
  PurchaseInvoice,
  PurchaseItem,
  PurchaseOrder,
  CashTransaction,
  BatchStatus,
  PaymentStatus,
  CashTransactionType,
  ProductWithBatches,
  CartItem,
  Representative,
  Warehouse,
  StockMovement,
  JournalEntry,
  PendingAdjustment,
  DailyClosing
} from '../types';
import { ArabicSmartSearch } from '../utils/search';
// @ts-ignore
import toast from 'react-hot-toast';

export interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyTaxNumber: string;
  companyCommercialRegister?: string;
  companyLogo?: string;
  currency: string;
  language: string;
  invoiceTemplate: '1' | '2' | '3';
  printerPaperSize: 'A4' | 'A5' | 'THERMAL';
  expenseCategories: string[];
  distributionLines: string[];
  lowStockThreshold: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  companyName: 'Mizan Online Pro',
  companyAddress: 'Cairo, Egypt',
  companyPhone: '01559550481',
  companyTaxNumber: '123-456-789',
  companyLogo: 'https://drive.google.com/uc?export=download&id=1Ia9pYTGjFENkMj5TrkNmDJOjSmp5pltL',
  currency: 'ج.م',
  language: 'ar',
  invoiceTemplate: '1',
  printerPaperSize: 'A4',
  expenseCategories: ['SALARY', 'ELECTRICITY', 'MARKETING', 'RENT', 'MAINTENANCE', 'OTHER'],
  distributionLines: [],
  lowStockThreshold: 10
};

class DatabaseService {
  private products: Product[] = [];
  private batches: Batch[] = [];
  private customers: Customer[] = [];
  private suppliers: Supplier[] = [];
  private representatives: Representative[] = [];
  private warehouses: Warehouse[] = [];
  private invoices: Invoice[] = [];
  private purchaseInvoices: PurchaseInvoice[] = [];
  private purchaseOrders: PurchaseOrder[] = [];
  private cashTransactions: CashTransaction[] = [];
  private stockMovements: StockMovement[] = [];
  private pendingAdjustments: PendingAdjustment[] = [];
  private dailyClosings: DailyClosing[] = [];
  private settings: SystemSettings = { ...DEFAULT_SETTINGS };
  
  private batchesByProductId: Map<string, Batch[]> = new Map();
  private productsMap: Map<string, Product> = new Map();
  private _cashBalance: number = 0;

  public isInitialized = false;

  constructor() {}

  private async fetchAllFromTable(tableName: string) {
    if (!isSupabaseConfigured) return [];
    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.from(tableName).select('*').range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('not found')) {
                console.warn(`[DB] Table '${tableName}' does not exist yet.`);
                return [];
            }
            throw error;
        }
        if (!data || data.length === 0) { hasMore = false; break; }
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false; else page++;
      }
      return allData;
    } catch (error: any) {
        console.warn(`[DB] Error fetching table '${tableName}':`, error.message);
        return [];
    }
  }

  async init() {
    if(this.isInitialized) return;
    try {
        const { data: set } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
        if (set) this.settings = this.mapFromDb(set);

        const tables = [
            'products', 'batches', 'customers', 'suppliers', 
            'warehouses', 'invoices', 'purchase_invoices', 
            'purchase_orders', 'cash_transactions', 'representatives', 
            'stock_movements', 'pending_adjustments', 'daily_closings'
        ];

        const results = await Promise.allSettled(tables.map(table => this.fetchAllFromTable(table)));

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const data = result.value || [];
                const tableName = tables[index];
                switch(tableName) {
                    case 'products': this.products = data; break;
                    case 'batches': this.batches = data; break;
                    case 'customers': this.customers = data; break;
                    case 'suppliers': this.suppliers = data; break;
                    case 'warehouses': this.warehouses = data; break;
                    case 'invoices': this.invoices = data; break;
                    case 'purchase_invoices': this.purchaseInvoices = data; break;
                    case 'purchase_orders': this.purchaseOrders = data; break;
                    case 'cash_transactions': this.cashTransactions = data; break;
                    case 'representatives': this.representatives = data; break;
                    case 'stock_movements': this.stockMovements = data; break;
                    case 'pending_adjustments': this.pendingAdjustments = data; break;
                    case 'daily_closings': this.dailyClosings = data; break;
                }
            }
        });

        this.rebuildIndexes();
        
        if (this.warehouses.length === 0) {
            this.warehouses.push({ id: 'W1', name: 'المخزن الرئيسي', is_default: true });
        }
        
        console.log("[DB] System initialized successfully with cloud sync.");
    } catch (error) {
        console.error("[DB] Initialization critical failure:", error);
        toast.error("خطأ في الاتصال بالسحابة، النظام يعمل بالبيانات المحلية.");
    } finally {
        this.isInitialized = true;
    }
  }

  private rebuildIndexes() {
      this.productsMap = new Map(this.products.map(p => [p.id, p]));
      this.batchesByProductId = new Map();
      this.batches.forEach(batch => {
          if (!this.batchesByProductId.has(batch.product_id)) {
              this.batchesByProductId.set(batch.product_id, []);
          }
          this.batchesByProductId.get(batch.product_id)!.push(batch);
      });
      this._cashBalance = this.cashTransactions.reduce((acc, t) => {
        return t.type === CashTransactionType.RECEIPT ? acc + t.amount : acc - t.amount;
      }, 0);
  }

  getProductsWithBatches(): ProductWithBatches[] {
    return this.products.map(p => ({
      ...p,
      batches: this.batchesByProductId.get(p.id) || []
    }));
  }

  getProductsPaginated(options: {
    page: number;
    pageSize: number;
    search?: string;
    filters?: {
      lowStockOnly?: boolean;
      outOfStockOnly?: boolean;
    };
    sortBy?: 'name' | 'code' | 'totalStock';
    sortOrder?: 'asc' | 'desc';
  }) {
    let products = this.getProductsWithBatches();
    
    // Applying smart search if query exists
    if (options.search) {
      products = ArabicSmartSearch.smartSearch(products, options.search);
    }

    if (options.filters?.lowStockOnly) {
      const threshold = this.settings.lowStockThreshold || 10;
      products = products.filter(p => {
        const total = p.batches.reduce((sum, b) => sum + b.quantity, 0);
        return total > 0 && total <= threshold;
      });
    }

    if (options.filters?.outOfStockOnly) {
      products = products.filter(p => p.batches.reduce((sum, b) => sum + b.quantity, 0) === 0);
    }

    if (options.sortBy && !options.search) {
      // Sorting is handled by smartSearch if search query exists
      products.sort((a, b) => {
        let valA, valB;
        if (options.sortBy === 'totalStock') {
          valA = a.batches.reduce((sum, b) => sum + b.quantity, 0);
          valB = b.batches.reduce((sum, b) => sum + b.quantity, 0);
        } else {
          // @ts-ignore
          valA = (a[options.sortBy] || '').toString().toLowerCase();
          // @ts-ignore
          valB = (b[options.sortBy] || '').toString().toLowerCase();
        }
        if (valA < valB) return options.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return options.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const total = products.length;
    const start = (options.page - 1) * options.pageSize;
    const paginatedProducts = products.slice(0, start + options.pageSize);
    return { products: paginatedProducts, total, hasMore: total > paginatedProducts.length };
  }

  async submitStockTake(adjustments: Omit<PendingAdjustment, 'id' | 'status' | 'date'>[]) {
    const newItems = adjustments.map(adj => ({
      ...adj,
      id: `PA${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      status: 'PENDING' as const,
      date: new Date().toISOString()
    }));
    this.pendingAdjustments.push(...newItems);
    if (isSupabaseConfigured) await supabase.from('pending_adjustments').insert(newItems);
    return true;
  }

  getPendingAdjustments(): PendingAdjustment[] {
    return this.pendingAdjustments.filter(a => a.status === 'PENDING');
  }

  async approveAdjustment(id: string) {
    const adjIdx = this.pendingAdjustments.findIndex(a => a.id === id);
    if (adjIdx === -1) return false;
    const adj = this.pendingAdjustments[adjIdx];
    const productBatches = this.batches.filter(b => b.product_id === adj.product_id && b.warehouse_id === adj.warehouse_id);
    if (productBatches.length > 0) {
      const targetBatch = productBatches[productBatches.length - 1];
      targetBatch.quantity = adj.actual_qty;
      if (isSupabaseConfigured) await supabase.from('batches').update({ quantity: targetBatch.quantity }).eq('id', targetBatch.id);
    }
    const movement: StockMovement = {
      id: `SM${Date.now()}`,
      date: new Date().toISOString(),
      type: 'ADJUSTMENT',
      product_id: adj.product_id,
      batch_number: 'ST-ADJ',
      warehouse_id: adj.warehouse_id,
      quantity: adj.diff,
      notes: `تسوية جرد معتمدة: ${id}`
    };
    this.stockMovements.push(movement);
    adj.status = 'APPROVED';
    if (isSupabaseConfigured) {
      await supabase.from('stock_movements').insert(movement);
      await supabase.from('pending_adjustments').update({ status: 'APPROVED' }).eq('id', id);
    }
    this.rebuildIndexes();
    return true;
  }

  async rejectAdjustment(id: string) {
    const adjIdx = this.pendingAdjustments.findIndex(a => a.id === id);
    if (adjIdx === -1) return false;
    this.pendingAdjustments[adjIdx].status = 'REJECTED';
    if (isSupabaseConfigured) await supabase.from('pending_adjustments').update({ status: 'REJECTED' }).eq('id', id);
    return true;
  }

  getDailySummary(date: string) {
    const targetDate = date;
    const collections = this.cashTransactions.filter(t => t.date.startsWith(targetDate) && t.type === CashTransactionType.RECEIPT).reduce((sum, t) => sum + t.amount, 0);
    const expenses = this.cashTransactions.filter(t => t.date.startsWith(targetDate) && t.type === CashTransactionType.EXPENSE && t.category !== 'SUPPLIER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const cashPurchases = this.cashTransactions.filter(t => t.date.startsWith(targetDate) && t.type === CashTransactionType.EXPENSE && t.category === 'SUPPLIER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const openingCash = this.cashTransactions.filter(t => t.date.split('T')[0] < targetDate).reduce((sum, t) => t.type === CashTransactionType.RECEIPT ? sum + t.amount : sum - t.amount, 0);
    const expectedCash = openingCash + collections - expenses - cashPurchases;
    return { openingCash, collections, expenses, cashPurchases, expectedCash, cashSales: 0 };
  }

  async saveDailyClosing(closing: Omit<DailyClosing, 'id' | 'created_at'>) {
    const id = `DC${Date.now()}`;
    const newClosing: DailyClosing = { ...closing, id, created_at: new Date().toISOString() };
    this.dailyClosings.push(newClosing);
    if (isSupabaseConfigured) await supabase.from('daily_closings').insert(newClosing);
    return true;
  }

  getDailyClosings(): DailyClosing[] {
    return [...this.dailyClosings].sort((a, b) => b.date.localeCompare(a.date));
  }

  getProductById(id: string): Product | undefined { return this.productsMap.get(id); }
  getCashBalance(): number { return this._cashBalance; }

  async addCashTransaction(tx: Omit<CashTransaction, 'id'>) {
      const id = `TX${Date.now()}`;
      const newTx: CashTransaction = { ...tx, id, created_at: new Date().toISOString() };
      this.cashTransactions.push(newTx);
      if (tx.type === CashTransactionType.RECEIPT) this._cashBalance += tx.amount;
      else this._cashBalance -= tx.amount;
      if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(newTx);
  }

  getInvoices(): Invoice[] { return [...this.invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getCustomers(): Customer[] { return [...this.customers]; }
  getSuppliers(): Supplier[] { return [...this.suppliers]; }
  getRepresentatives(): Representative[] { return [...this.representatives]; }
  getWarehouses(): Warehouse[] { return [...this.warehouses]; }
  getPurchaseInvoices(): PurchaseInvoice[] { return [...this.purchaseInvoices]; }
  getPurchaseOrders(): PurchaseOrder[] { return [...this.purchaseOrders]; }
  getCashTransactions(): CashTransaction[] { return [...this.cashTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getSettings(): SystemSettings { return { ...this.settings }; }

  async updateSettings(s: SystemSettings): Promise<boolean> {
    this.settings = { ...s };
    if (isSupabaseConfigured) {
        const { error } = await supabase.from('settings').upsert(this.mapToDb(s));
        return !error;
    }
    return true;
  }

  private mapFromDb(dbData: any): SystemSettings {
    return {
      companyName: dbData.companyname || dbData.company_name || this.settings.companyName,
      companyAddress: dbData.companyaddress || dbData.company_address || this.settings.companyAddress,
      companyPhone: dbData.companyphone || dbData.company_phone || this.settings.companyPhone,
      companyTaxNumber: dbData.companytaxnumber || dbData.company_tax_number || this.settings.companyTaxNumber,
      companyCommercialRegister: dbData.companycommercialregister || dbData.company_commercial_register || this.settings.companyCommercialRegister,
      companyLogo: dbData.companylogo || dbData.company_logo || this.settings.companyLogo,
      currency: dbData.currency || this.settings.currency,
      language: dbData.language || this.settings.language,
      invoiceTemplate: dbData.invoicetemplate || dbData.invoice_template || this.settings.invoiceTemplate,
      printerPaperSize: dbData.printerpapersize || dbData.printer_paper_size || this.settings.printerPaperSize,
      expenseCategories: dbData.expensecategories || dbData.expense_categories || this.settings.expenseCategories,
      distributionLines: dbData.distributionlines || dbData.distribution_lines || this.settings.distributionLines,
      lowStockThreshold: dbData.lowstockthreshold || dbData.low_stock_threshold || this.settings.lowStockThreshold
    };
  }

  private mapToDb(s: SystemSettings): any {
    return { id: 1, companyname: s.companyName, companyaddress: s.companyAddress, companyphone: s.companyPhone, companytaxnumber: s.companyTaxNumber, companycommercialregister: s.companyCommercialRegister, companylogo: s.companyLogo, currency: s.currency, language: s.language, invoicetemplate: s.invoiceTemplate, printerpapersize: s.printerPaperSize, expensecategories: s.expenseCategories, distributionlines: s.distributionLines, lowstockthreshold: s.lowStockThreshold };
  }

  async createInvoice(customerId: string, items: CartItem[], cashPaid: number, isReturn: boolean = false, addDisc: number = 0, user?: any): Promise<{ success: boolean; message: string; id?: string }> {
    const invoiceId = `INV${Date.now()}`;
    const netTotal = items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0) - addDisc;
    const invoice: Invoice = { id: invoiceId, invoice_number: `${Date.now()}`, customer_id: customerId, date: new Date().toISOString(), total_before_discount: netTotal + addDisc, total_discount: 0, additional_discount: addDisc, net_total: netTotal, previous_balance: 0, final_balance: 0, payment_status: PaymentStatus.PAID, items, type: isReturn ? 'RETURN' : 'SALE' };
    this.invoices.push(invoice);
    if (cashPaid > 0) {
        await this.addCashTransaction({ type: isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT, category: 'CUSTOMER_PAYMENT', reference_id: customerId, amount: cashPaid, date: new Date().toISOString(), notes: `Payment for INV#${invoice.invoice_number}` });
    }
    if (isSupabaseConfigured) await supabase.from('invoices').insert(invoice);
    return { success: true, message: 'Done', id: invoiceId };
  }

  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPaid: number) {
    const idx = this.invoices.findIndex(i => i.id === id);
    if (idx === -1) return { success: false, message: 'Not found' };
    this.invoices[idx] = { ...this.invoices[idx], customer_id: customerId, items };
    if (isSupabaseConfigured) await supabase.from('invoices').update(this.invoices[idx]).eq('id', id);
    return { success: true, message: 'Updated', id };
  }

  async addProduct(p: any, b?: any): Promise<string> {
    const pid = `P${Date.now()}`;
    const product: Product = { id: pid, code: p.code || `C-${Date.now()}`, name: p.name, selling_price: p.selling_price || 0, purchase_price: p.purchase_price || 0 };
    this.products.push(product);
    this.productsMap.set(pid, product);
    if (b && Number(b.quantity) > 0) {
        const bid = `B${Date.now()}`;
        const batch: Batch = { id: bid, product_id: pid, warehouse_id: b.warehouse_id || 'W1', batch_number: b.batch_number || 'AUTO', quantity: b.quantity, purchase_price: b.purchase_price || 0, selling_price: b.selling_price || 0, expiry_date: b.expiry_date || '2099-12-31', status: BatchStatus.ACTIVE };
        this.batches.push(batch);
        if (!this.batchesByProductId.has(pid)) this.batchesByProductId.set(pid, []);
        this.batchesByProductId.get(pid)!.push(batch);
        if (isSupabaseConfigured) await supabase.from('batches').insert(batch);
    }
    if (isSupabaseConfigured) await supabase.from('products').insert(product);
    return pid;
  }

  async addCustomer(c: any) {
      const cust = { ...c, id: `C${Date.now()}`, current_balance: c.opening_balance || 0 };
      this.customers.push(cust);
      if (isSupabaseConfigured) await supabase.from('customers').insert(cust);
  }
  async updateCustomer(id: string, data: any) {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.customers[idx] = { ...this.customers[idx], ...data };
      if (isSupabaseConfigured) await supabase.from('customers').update(data).eq('id', id);
    }
  }
  async deleteCustomer(id: string) {
    this.customers = this.customers.filter(c => c.id !== id);
    if (isSupabaseConfigured) await supabase.from('customers').delete().eq('id', id);
  }

  async addSupplier(s: any) {
    const supplier: Supplier = { ...s, id: `S${Date.now()}`, current_balance: s.opening_balance || 0 };
    this.suppliers.push(supplier);
    if (isSupabaseConfigured) await supabase.from('suppliers').insert(supplier);
  }

  async addRepresentative(data: any) {
    const rep: Representative = { ...data, id: `R${Date.now()}` };
    this.representatives.push(rep);
    if (isSupabaseConfigured) await supabase.from('representatives').insert(rep);
  }
  async updateRepresentative(id: string, data: any) {
    const idx = this.representatives.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.representatives[idx] = { ...this.representatives[idx], ...data };
      if (isSupabaseConfigured) await supabase.from('representatives').update(data).eq('id', id);
    }
  }
  async deleteRepresentative(id: string) {
    this.representatives = this.representatives.filter(r => r.id !== id);
    if (isSupabaseConfigured) await supabase.from('representatives').delete().eq('id', id);
  }

  async recordInvoicePayment(invoiceId: string, amount: number) {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (!inv) return { success: false, message: 'Invoice not found' };
    await this.addCashTransaction({ type: CashTransactionType.RECEIPT, category: 'CUSTOMER_PAYMENT', reference_id: inv.customer_id, amount: amount, date: new Date().toISOString(), notes: `Collection for INV#${inv.invoice_number}` });
    return { success: true, message: 'Payment recorded' };
  }

  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean = false) {
    const id = `PUR${Date.now()}`;
    const total = items.reduce((s, i) => s + (i.quantity * i.cost_price), 0);
    const inv: PurchaseInvoice = { id, invoice_number: `P-${Date.now()}`, supplier_id: supplierId, date: new Date().toISOString(), total_amount: total, paid_amount: cashPaid, type: isReturn ? 'RETURN' : 'PURCHASE', items };
    this.purchaseInvoices.push(inv);
    if (cashPaid > 0) await this.addCashTransaction({ type: isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE, category: 'SUPPLIER_PAYMENT', reference_id: supplierId, amount: cashPaid, date: new Date().toISOString(), notes: `Payment for PUR#${inv.invoice_number}` });
    if (isSupabaseConfigured) await supabase.from('purchase_invoices').insert(inv);
    return { success: true, message: 'Done', id };
  }

  async createPurchaseOrder(supplierId: string, items: any[]) {
    const order: PurchaseOrder = { id: `PO${Date.now()}`, order_number: `PO-${Date.now()}`, supplier_id: supplierId, date: new Date().toISOString(), status: 'PENDING', items };
    this.purchaseOrders.push(order);
    if (isSupabaseConfigured) await supabase.from('purchase_orders').insert(order);
    return { success: true, message: 'Order created' };
  }
  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED') {
    const idx = this.purchaseOrders.findIndex(o => o.id === id);
    if (idx !== -1) {
      this.purchaseOrders[idx].status = status;
      if (isSupabaseConfigured) await supabase.from('purchase_orders').update({ status }).eq('id', id);
    }
  }

  async addWarehouse(name: string) {
    const w: Warehouse = { id: `W${Date.now()}`, name, is_default: false };
    this.warehouses.push(w);
    if (isSupabaseConfigured) await supabase.from('warehouses').insert(w);
  }
  async updateWarehouse(id: string, name: string) {
    const idx = this.warehouses.findIndex(w => w.id === id);
    if (idx !== -1) {
      this.warehouses[idx].name = name;
      if (isSupabaseConfigured) await supabase.from('warehouses').update({ name }).eq('id', id);
    }
  }

  async addExpenseCategory(cat: string) {
    if (!this.settings.expenseCategories.includes(cat)) {
      this.settings.expenseCategories.push(cat);
      await this.updateSettings(this.settings);
    }
  }

  getABCAnalysis() {
      const productRevenue: Record<string, number> = {};
      this.invoices.filter(i => i.type === 'SALE').forEach(inv => {
          inv.items.forEach(item => {
              const rev = item.quantity * (item.unit_price || 0);
              productRevenue[item.product.id] = (productRevenue[item.product.id] || 0) + rev;
          });
      });
      const sorted = Object.entries(productRevenue).map(([id, revenue]) => ({ id, name: this.productsMap.get(id)?.name || 'Unknown', revenue })).sort((a,b) => b.revenue - a.revenue);
      return { classifiedProducts: sorted.map(p => ({ ...p, category: 'A' })), totalRevenue: sorted.reduce((a,b)=>a+b.revenue,0) };
  }

  getInventoryValuationReport() {
      return this.products.map(p => {
          const productBatches = this.batchesByProductId.get(p.id) || [];
          const totalQty = productBatches.reduce((s, b) => s + b.quantity, 0);
          const totalValue = productBatches.reduce((s, b) => s + (b.quantity * b.purchase_price), 0);
          return { id: p.id, name: p.name, code: p.code, totalQty, totalValue, wac: totalQty > 0 ? totalValue / totalQty : 0, latestCost: 0, turnoverRate: '0' };
      });
  }

  getSystemSnapshot() {
    return JSON.stringify({
      stats: { totalSales: this.invoices.reduce((s, i) => s + i.net_total, 0), cashBalance: this._cashBalance, customerCount: this.customers.length, productCount: this.products.length },
      lowStock: this.products.filter(p => (this.batchesByProductId.get(p.id) || []).reduce((s, b) => s + b.quantity, 0) < this.settings.lowStockThreshold).map(p => p.name)
    });
  }

  async resetDatabase() { if (isSupabaseConfigured) await supabase.rpc('clear_all_data'); window.location.reload(); }
  exportDatabase(): string { return JSON.stringify({ products: this.products, batches: this.batches, customers: this.customers }); }
  importDatabase(json: string) { const d = JSON.parse(json); this.products = d.products || []; this.batches = d.batches || []; this.rebuildIndexes(); return true; }
  getNextTransactionRef(type: CashTransactionType) { return `${type === 'RECEIPT' ? 'REC' : 'PAY'}-${Date.now()}`; }
  getInvoicePaidAmount(id: string) { return this.cashTransactions.filter(t => t.notes?.includes(id)).reduce((s, t) => s + t.amount, 0); }
  getInvoiceProfit(inv: Invoice) { return inv.net_total * 0.2; }
  getGeneralLedger(): JournalEntry[] { return []; }
  async clearTransactions() { if (isSupabaseConfigured) await supabase.rpc('clear_all_data'); }
  async clearCustomers() { if (isSupabaseConfigured) await supabase.from('customers').delete().neq('id', '0'); }
  async clearProducts() { if (isSupabaseConfigured) await supabase.from('products').delete().neq('id', '0'); }
}

export const db = new DatabaseService();
