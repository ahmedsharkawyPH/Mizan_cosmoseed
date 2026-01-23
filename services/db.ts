
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
  printerPaperSize: 'A4' | 'A5' | 'THERMAL' | 'THERMAL_58';
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
  public isFullyLoaded = false;
  public isOffline = !navigator.onLine;

  constructor() {
    window.addEventListener('online', () => { this.isOffline = false; this.loadRemainingData(); });
    window.addEventListener('offline', () => { this.isOffline = true; });
  }

  private saveToLocalCache() {
      const cache = {
          products: this.products.slice(0, 200),
          customers: this.customers.slice(0, 100),
          settings: this.settings,
          warehouses: this.warehouses,
          lastUpdate: new Date().getTime()
      };
      localStorage.setItem('mizan_essential_cache', JSON.stringify(cache));
  }

  private loadFromLocalCache(): boolean {
      const stored = localStorage.getItem('mizan_essential_cache');
      if (!stored) return false;
      try {
          const cache = JSON.parse(stored);
          this.products = cache.products || [];
          this.customers = cache.customers || [];
          this.settings = cache.settings || DEFAULT_SETTINGS;
          this.warehouses = cache.warehouses || [];
          this.rebuildIndexes();
          return true;
      } catch (e) { return false; }
  }

  private async fetchAllFromTable(tableName: string, limit?: number) {
    if (!isSupabaseConfigured) return [];
    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = limit || 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.from(tableName).select('*').range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) { hasMore = false; break; }
        allData = [...allData, ...data];
        if (data.length < pageSize || limit) hasMore = false; else page++;
      }
      return allData;
    } catch (error: any) {
        console.warn(`[DB] Error fetching table '${tableName}':`, error.message);
        return [];
    }
  }

  async init() {
    if(this.isInitialized) return;
    
    const hasCache = this.loadFromLocalCache();
    if (hasCache) {
        this.isInitialized = true;
    }

    try {
        const { data: set } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
        if (set) this.settings = this.mapFromDb(set);

        const [wareData, prodData, custData, invData] = await Promise.all([
            this.fetchAllFromTable('warehouses'),
            this.fetchAllFromTable('products', 200), 
            this.fetchAllFromTable('customers', 100),  
            this.fetchAllFromTable('invoices', 50)    
        ]);

        this.warehouses = wareData;
        this.products = prodData;
        this.customers = custData;
        this.invoices = invData;

        if (this.products.length > 0) {
            const { data: batchData } = await supabase.from('batches').select('*').in('product_id', this.products.map(p => p.id));
            this.batches = batchData || [];
        }

        this.rebuildIndexes();
        this.saveToLocalCache();
        
        if (!this.isInitialized) this.isInitialized = true;
        this.loadRemainingData();

    } catch (error) {
        if (!this.isInitialized) this.isInitialized = true; 
    }
  }

  private async loadRemainingData() {
      if (this.isOffline) return;
      try {
          const tables = [
              'products', 'batches', 'customers', 'suppliers', 
              'invoices', 'purchase_invoices', 'purchase_orders', 
              'cash_transactions', 'representatives', 'stock_movements', 
              'pending_adjustments', 'daily_closings'
          ];

          const results = await Promise.allSettled(tables.map(t => this.fetchAllFromTable(t)));

          results.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                  this.mergeDataSafely(tables[index], result.value || []);
              }
          });

          this.rebuildIndexes();
          this.isFullyLoaded = true;
          this.saveToLocalCache();
      } catch (err) {
          console.error("[DB] Background sync failed", err);
      }
  }

  private mergeDataSafely(tableName: string, newData: any[]) {
      const propertyMap: any = {
          'products': 'products', 'batches': 'batches', 'customers': 'customers',
          'suppliers': 'suppliers', 'invoices': 'invoices', 'purchase_invoices': 'purchaseInvoices',
          'purchase_orders': 'purchaseOrders', 'cash_transactions': 'cashTransactions',
          'representatives': 'representatives', 'stock_movements': 'stockMovements',
          'pending_adjustments': 'pendingAdjustments', 'daily_closings': 'dailyClosings'
      };
      
      const prop = propertyMap[tableName];
      if (!prop) return;

      const existingData = (this as any)[prop] as any[];
      const existingMap = new Map(existingData.map(i => [i.id, i]));
      
      newData.forEach(item => {
          existingMap.set(item.id, { ...existingMap.get(item.id), ...item });
      });
      
      (this as any)[prop] = Array.from(existingMap.values());
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
    const daySales = this.invoices.filter(i => i.date.startsWith(targetDate) && i.type === 'SALE').reduce((sum, i) => sum + i.net_total, 0);
    const collections = this.cashTransactions.filter(t => t.date.startsWith(targetDate) && t.type === CashTransactionType.RECEIPT).reduce((sum, t) => sum + t.amount, 0);
    const dayExpenses = this.cashTransactions.filter(t => t.date.startsWith(targetDate) && t.type === CashTransactionType.EXPENSE && t.category !== 'SUPPLIER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const cashPurchases = this.cashTransactions.filter(t => t.date.startsWith(targetDate) && t.type === CashTransactionType.EXPENSE && t.category === 'SUPPLIER_PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    
    const inventoryValue = this.batches.reduce((sum, b) => sum + (b.quantity * b.purchase_price), 0);
    
    const openingCash = this.cashTransactions.filter(t => t.date.split('T')[0] < targetDate).reduce((sum, t) => t.type === CashTransactionType.RECEIPT ? sum + t.amount : sum - t.amount, 0);
    const expectedCash = openingCash + collections - dayExpenses - cashPurchases;
    
    return { 
        openingCash, 
        collections, 
        expenses: dayExpenses, 
        cashPurchases, 
        expectedCash, 
        cashSales: daySales,
        inventoryValue
    };
  }

  async saveDailyClosing(closing: Omit<DailyClosing, 'id' | 'updated_at'>) {
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `DC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newClosing: DailyClosing = { 
        ...closing, 
        id, 
        updated_at: new Date().toISOString() 
    };
    
    if (isSupabaseConfigured) {
        const { error } = await supabase.from('daily_closings').insert({
            id: newClosing.id,
            date: newClosing.date,
            total_sales: newClosing.total_sales,
            total_expenses: newClosing.total_expenses,
            cash_balance: newClosing.cash_balance,
            bank_balance: newClosing.bank_balance || 0,
            inventory_value: newClosing.inventory_value,
            updated_at: newClosing.updated_at
        });
        
        if (error) {
            console.error("Supabase Closing Error:", error.message);
            toast.error(`فشل الحفظ في السحابة: ${error.message}`);
            return false;
        }
    }
    
    this.dailyClosings.push(newClosing);
    return true;
  }

  getDailyClosings(): DailyClosing[] { return [...this.dailyClosings].sort((a, b) => b.date.localeCompare(a.date)); }
  getProductById(id: string): Product | undefined { return this.productsMap.get(id); }
  getCashBalance(): number { return this._cashBalance; }

  async addCashTransaction(tx: Omit<CashTransaction, 'id'>, updateAccountBalance: boolean = true) {
      const id = `TX${Date.now()}`;
      const newTx: CashTransaction = { ...tx, id, created_at: new Date().toISOString() };
      this.cashTransactions.push(newTx);
      
      if (tx.type === CashTransactionType.RECEIPT) this._cashBalance += tx.amount;
      else this._cashBalance -= tx.amount;
      
      if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(newTx);

      // تحديث رصيد الحساب (عميل أو مورد) في السحابة إذا لزم الأمر
      if (updateAccountBalance && tx.reference_id) {
          if (tx.category === 'CUSTOMER_PAYMENT') {
              const customer = this.customers.find(c => c.id === tx.reference_id);
              if (customer) {
                  // القبض يقلل المديونية، الصرف يزيد المديونية (استرداد)
                  const adjustment = tx.type === CashTransactionType.RECEIPT ? -tx.amount : tx.amount;
                  customer.current_balance += adjustment;
                  if (isSupabaseConfigured) {
                      await supabase.from('customers').update({ current_balance: customer.current_balance }).eq('id', customer.id);
                  }
              }
          } else if (tx.category === 'SUPPLIER_PAYMENT') {
              const supplier = this.suppliers.find(s => s.id === tx.reference_id);
              if (supplier) {
                  // الصرف (سداد مورد) يقلل المديونية، القبض (مرتجع نقدي) يزيد المديونية
                  const adjustment = tx.type === CashTransactionType.EXPENSE ? -tx.amount : tx.amount;
                  supplier.current_balance += adjustment;
                  if (isSupabaseConfigured) {
                      await supabase.from('suppliers').update({ current_balance: supplier.current_balance }).eq('id', supplier.id);
                  }
              }
          }
      }

      this.saveToLocalCache();
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
    this.saveToLocalCache();
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
    
    const customer = this.customers.find(c => c.id === customerId);
    const prevBalance = customer ? customer.current_balance : 0;

    const numericInvoices = this.invoices
        .map(inv => parseInt(inv.invoice_number))
        .filter(num => !isNaN(num) && num >= 10000);
    
    const nextInvoiceNumber = numericInvoices.length > 0 
        ? Math.max(...numericInvoices) + 1 
        : 10001;

    const netTotal = items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0) - addDisc;
    
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
        final_balance: prevBalance + (isReturn ? -netTotal : netTotal) - cashPaid, 
        payment_status: cashPaid >= netTotal ? PaymentStatus.PAID : (cashPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID), 
        items, 
        type: isReturn ? 'RETURN' : 'SALE' 
    };
    
    this.invoices.push(invoice);
    
    // تسجيل النقدية
    if (cashPaid > 0) { 
        await this.addCashTransaction({ 
            type: isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT, 
            category: 'CUSTOMER_PAYMENT', 
            reference_id: customerId, 
            amount: cashPaid, 
            date: new Date().toISOString(), 
            notes: `Payment for INV#${invoice.invoice_number}` 
        }, false); 
    }
    
    // تحديث المخزون في السحابة
    for (const item of items) {
        if (item.batch) {
            const batch = this.batches.find(b => b.id === item.batch?.id);
            if (batch) {
                const deduction = item.quantity + (item.bonus_quantity || 0);
                batch.quantity -= (isReturn ? -deduction : deduction);
                if (isSupabaseConfigured) {
                    await supabase.from('batches').update({ quantity: batch.quantity }).eq('id', batch.id);
                }
            }
        }
    }

    if (isSupabaseConfigured) {
        await supabase.from('invoices').insert(invoice);
        if (customer) {
            await supabase.from('customers').update({ current_balance: invoice.final_balance }).eq('id', customer.id);
        }
    }
    
    if (customer) {
        customer.current_balance = invoice.final_balance;
    }

    this.saveToLocalCache();
    this.rebuildIndexes();
    return { success: true, message: 'Done', id: invoiceId };
  }

  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPaid: number) {
    const idx = this.invoices.findIndex(i => i.id === id);
    if (idx === -1) return { success: false, message: 'Not found' };
    this.invoices[idx] = { ...this.invoices[idx], customer_id: customerId, items };
    if (isSupabaseConfigured) await supabase.from('invoices').update(this.invoices[idx]).eq('id', id);
    return { success: true, message: 'Updated', id };
  }

  async convertInvoiceToReturn(invoiceId: string): Promise<{ success: boolean; message: string }> {
      const idx = this.invoices.findIndex(i => i.id === invoiceId);
      if (idx === -1) return { success: false, message: 'Invoice not found' };
      
      const invoice = this.invoices[idx];
      if (invoice.type === 'RETURN') return { success: false, message: 'Invoice is already a return' };

      const oldType = invoice.type;
      invoice.type = 'RETURN';
      
      // logic: To go from Sale (deducted stock) to Return (added stock), we need to add 2x the qty.
      // Customer: Sale increased debt, Return decreases debt. Diff = -2 * net_total.
      
      const customer = this.customers.find(c => c.id === invoice.customer_id);
      
      // Reverse Stock
      for (const item of invoice.items) {
          if (item.batch) {
              const batch = this.batches.find(b => b.id === item.batch?.id);
              if (batch) {
                  const qtyToFlip = item.quantity + (item.bonus_quantity || 0);
                  // Sale logic was: batch.qty -= qty
                  // Return logic is: batch.qty += qty
                  // Conversion delta = +2 * qty
                  batch.quantity += (2 * qtyToFlip);
                  if (isSupabaseConfigured) {
                      await supabase.from('batches').update({ quantity: batch.quantity }).eq('id', batch.id);
                  }
              }
          }
      }

      // Reverse Customer Balance
      if (customer) {
          // Sale was: Bal += Net. Return is: Bal -= Net.
          // Conversion delta = -2 * Net.
          const adjustment = 2 * invoice.net_total;
          invoice.final_balance -= adjustment;
          customer.current_balance -= adjustment;
          if (isSupabaseConfigured) {
              await supabase.from('customers').update({ current_balance: customer.current_balance }).eq('id', customer.id);
          }
      }

      if (isSupabaseConfigured) {
          await supabase.from('invoices').update({ type: 'RETURN', final_balance: invoice.final_balance }).eq('id', invoiceId);
      }

      this.saveToLocalCache();
      this.rebuildIndexes();
      return { success: true, message: 'Converted to Return' };
  }

  async deleteInvoice(id: string) {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return;
    this.invoices = this.invoices.filter(i => i.id !== id);
    if (isSupabaseConfigured) await supabase.from('invoices').delete().eq('id', id);
    this.saveToLocalCache();
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
    this.saveToLocalCache();
    return pid;
  }

  async addCustomer(c: any) {
      const cust = { ...c, id: `C${Date.now()}`, current_balance: Number(c.opening_balance) || 0, opening_balance: Number(c.opening_balance) || 0 };
      this.customers.push(cust);
      if (isSupabaseConfigured) await supabase.from('customers').insert(cust);
      this.saveToLocalCache();
  }
  async updateCustomer(id: string, data: any) {
    const idx = this.customers.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.customers[idx] = { ...this.customers[idx], ...data };
      if (isSupabaseConfigured) await supabase.from('customers').update(data).eq('id', id);
      this.saveToLocalCache();
    }
  }
  async deleteCustomer(id: string) {
    this.customers = this.customers.filter(c => c.id !== id);
    if (isSupabaseConfigured) await supabase.from('customers').delete().eq('id', id);
    this.saveToLocalCache();
  }
  async addSupplier(s: any) {
    const supplier: Supplier = { ...s, id: `S${Date.now()}`, current_balance: Number(s.opening_balance) || 0, opening_balance: Number(s.opening_balance) || 0 };
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
    
    // تحديث أسعار الصنف والمخزون في السحابة
    for (const item of items) {
        // 1. تحديث سعر المنتج العام (Master Product) ليعكس السعر الجديد في المبيعات
        const product = this.products.find(p => p.id === item.product_id);
        if (product && !isReturn) {
            product.purchase_price = item.cost_price;
            product.selling_price = item.selling_price;
            if (isSupabaseConfigured) {
                await supabase.from('products').update({ 
                    purchase_price: item.cost_price, 
                    selling_price: item.selling_price 
                }).eq('id', product.id);
            }
        }

        // 2. تحديث الرصيد في التشغيلات (Batches)
        let batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id && (item.batch_number !== 'AUTO' ? b.batch_number === item.batch_number : true));
        
        if (batch) {
            batch.quantity += (isReturn ? -item.quantity : item.quantity);
            if (!isReturn) {
                batch.purchase_price = item.cost_price;
                batch.selling_price = item.selling_price;
            }
            if (isSupabaseConfigured) {
                await supabase.from('batches').update({ 
                    quantity: batch.quantity, 
                    purchase_price: batch.purchase_price, 
                    selling_price: batch.selling_price 
                }).eq('id', batch.id);
            }
        } else if (!isReturn) {
            // إنشاء تشغيلة جديدة إذا لم توجد
            const newBatch: Batch = {
                id: `B${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                product_id: item.product_id,
                warehouse_id: item.warehouse_id,
                batch_number: item.batch_number === 'AUTO' ? `BN-${Date.now().toString().slice(-4)}` : item.batch_number,
                quantity: item.quantity,
                purchase_price: item.cost_price,
                selling_price: item.selling_price,
                expiry_date: item.expiry_date,
                status: BatchStatus.ACTIVE
            };
            this.batches.push(newBatch);
            if (isSupabaseConfigured) await supabase.from('batches').insert(newBatch);
        }
    }

    this.purchaseInvoices.push(inv);
    
    if (cashPaid > 0) {
        await this.addCashTransaction({ 
            type: isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE, 
            category: 'SUPPLIER_PAYMENT', 
            reference_id: supplierId, 
            amount: cashPaid, 
            date: new Date().toISOString(), 
            notes: `Payment for PUR#${inv.invoice_number}` 
        }, false);
    }
    
    const supplier = this.suppliers.find(s => s.id === supplierId);
    if (supplier) {
        const adjustment = isReturn ? -total : total;
        supplier.current_balance += (adjustment - cashPaid);
        if (isSupabaseConfigured) {
            await supabase.from('suppliers').update({ current_balance: supplier.current_balance }).eq('id', supplierId);
        }
    }

    if (isSupabaseConfigured) await supabase.from('purchase_invoices').insert(inv);
    
    this.rebuildIndexes();
    this.saveToLocalCache();
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
    this.saveToLocalCache();
  }
  async updateWarehouse(id: string, name: string) {
    const idx = this.warehouses.findIndex(w => w.id === id);
    if (idx !== -1) {
      this.warehouses[idx].name = name;
      if (isSupabaseConfigured) await supabase.from('warehouses').update({ name }).eq('id', id);
      this.saveToLocalCache();
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
  async resetDatabase() { if (isSupabaseConfigured) await supabase.rpc('clear_all_data'); localStorage.removeItem('mizan_essential_cache'); window.location.reload(); }
  exportDatabase(): string { return JSON.stringify({ products: this.products, batches: this.batches, customers: this.customers }); }
  importDatabase(json: string) { const d = JSON.parse(json); this.products = d.products || []; this.batches = d.batches || []; this.rebuildIndexes(); this.saveToLocalCache(); return true; }
  getNextTransactionRef(type: CashTransactionType) { return `${type === 'RECEIPT' ? 'REC' : 'PAY'}-${Date.now()}`; }
  getInvoicePaidAmount(id: string) { return this.cashTransactions.filter(t => t.notes?.includes(id)).reduce((s, t) => s + t.amount, 0); }
  getInvoiceProfit(inv: Invoice) { return inv.net_total * 0.2; }
  getGeneralLedger(): JournalEntry[] { return []; }
  async clearTransactions() { if (isSupabaseConfigured) await supabase.rpc('clear_all_data'); }
  async clearCustomers() { if (isSupabaseConfigured) await supabase.from('customers').delete().neq('id', '0'); }
  async clearProducts() { if (isSupabaseConfigured) await supabase.from('products').delete().neq('id', '0'); }
}

export const db = new DatabaseService();
