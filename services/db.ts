
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
  JournalEntry
} from '../types';

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
  companyName: 'Mizan Online',
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
  private settings: SystemSettings = { ...DEFAULT_SETTINGS };
  
  // تحسينات الأداء: الفهارس الذكية
  private batchesByProductId: Map<string, Batch[]> = new Map();
  private productsMap: Map<string, Product> = new Map();
  private _cashBalance: number = 0;

  public isInitialized = false;

  constructor() {}

  private async fetchAllFromTable(tableName: string) {
    if (!isSupabaseConfigured) return [];
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase.from(tableName).select('*').range(page * pageSize, (page + 1) * pageSize - 1);
      if (error || !data || data.length === 0) { hasMore = false; break; }
      allData = [...allData, ...data];
      if (data.length < pageSize) hasMore = false; else page++;
    }
    return allData;
  }

  async init() {
    if(this.isInitialized) return;
    try {
        const { data: set } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
        if (set) this.settings = this.mapFromDb(set);

        const [p, b, c, s, w, inv, pur, po, cash, rep, sm] = await Promise.all([
            this.fetchAllFromTable('products'), this.fetchAllFromTable('batches'),
            this.fetchAllFromTable('customers'), this.fetchAllFromTable('suppliers'),
            this.fetchAllFromTable('warehouses'), this.fetchAllFromTable('invoices'),
            this.fetchAllFromTable('purchase_invoices'), this.fetchAllFromTable('purchase_orders'),
            this.fetchAllFromTable('cash_transactions'), this.fetchAllFromTable('representatives'),
            this.fetchAllFromTable('stock_movements'),
        ]);

        this.products = p || [];
        this.batches = b || [];
        this.customers = c || [];
        this.suppliers = s || [];
        this.warehouses = w || [];
        this.invoices = inv || [];
        this.purchaseInvoices = pur || [];
        this.purchaseOrders = po || [];
        this.cashTransactions = cash || [];
        this.representatives = rep || [];
        this.stockMovements = sm || [];

        this.rebuildIndexes();
        
        if (this.warehouses.length === 0) {
            this.warehouses.push({ id: 'W1', name: 'المخزن الرئيسي', is_default: true });
        }
    } catch (error) {
        console.error("Database initialization failed:", error);
    } finally {
        this.isInitialized = true;
    }
  }

  private rebuildIndexes() {
      // فهرسة الأصناف للوصول السريع O(1)
      this.productsMap = new Map(this.products.map(p => [p.id, p]));
      
      // فهرسة التشغيلات حسب الصنف لتجنب البحث المتكرر O(N) في كل مرة
      this.batchesByProductId = new Map();
      this.batches.forEach(batch => {
          if (!this.batchesByProductId.has(batch.product_id)) {
              this.batchesByProductId.set(batch.product_id, []);
          }
          this.batchesByProductId.get(batch.product_id)!.push(batch);
      });

      // حساب رصيد الخزينة مرة واحدة عند البدء
      this._cashBalance = this.cashTransactions.reduce((acc, t) => {
        return t.type === CashTransactionType.RECEIPT ? acc + t.amount : acc - t.amount;
      }, 0);
  }

  getProductsWithBatches(): ProductWithBatches[] {
    // استخدام Map يجعل العملية O(N) بدلاً من O(N*M)
    return this.products.map(p => ({
      ...p,
      batches: this.batchesByProductId.get(p.id) || []
    }));
  }

  getProductById(id: string): Product | undefined {
    return this.productsMap.get(id);
  }

  getCashBalance(): number {
    return this._cashBalance;
  }

  async addCashTransaction(tx: Omit<CashTransaction, 'id'>) {
      const id = `TX${Date.now()}`;
      const newTx: CashTransaction = { ...tx, id, created_at: new Date().toISOString() };
      this.cashTransactions.push(newTx);
      
      // تحديث الرصيد التراكمي فوراً دون إعادة الحساب O(1)
      if (tx.type === CashTransactionType.RECEIPT) this._cashBalance += tx.amount;
      else this._cashBalance -= tx.amount;

      if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(newTx);
  }

  // --- دوال المساعدة الواجب توفرها للواجهة ---
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
