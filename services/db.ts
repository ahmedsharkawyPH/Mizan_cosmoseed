
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
  private logs: { timestamp: string; action: string; details: any }[] = [];

  public isInitialized = false;

  constructor() {}

  private logAction(action: string, details?: any) {
    const log = {
      timestamp: new Date().toISOString(),
      action,
      details: details || {}
    };
    this.logs.push(log);
    // طباعة السجل في وحدة التحكم للتطوير والمراقبة
    console.log(`[DB] ${action}`, details);
  }

  getRecentLogs(count = 50) {
    return this.logs.slice(-count);
  }

  private async fetchAllFromTable(tableName: string) {
    if (!isSupabaseConfigured) return [];
    
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, to);

      if (error) {
        console.error(`Error fetching table ${tableName}:`, error.message);
        hasMore = false;
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }
    return allData;
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
      // تصحيح الخطأ المطبعي هنا:
      printerPaperSize: dbData.printerpapersize || dbData.printer_paper_size || this.settings.printerPaperSize,
      expenseCategories: dbData.expensecategories || dbData.expense_categories || this.settings.expenseCategories,
      distributionLines: dbData.distributionlines || dbData.distribution_lines || this.settings.distributionLines,
      lowStockThreshold: dbData.lowstockthreshold || dbData.low_stock_threshold || this.settings.lowStockThreshold
    };
  }

  private mapToDb(s: SystemSettings): any {
    return {
      id: 1,
      companyname: s.companyName,
      companyaddress: s.companyAddress,
      companyphone: s.companyPhone,
      companytaxnumber: s.companyTaxNumber,
      companycommercialregister: s.companyCommercialRegister,
      companylogo: s.companyLogo,
      currency: s.currency,
      language: s.language,
      invoicetemplate: s.invoiceTemplate,
      printerpapersize: s.printerPaperSize,
      expensecategories: s.expenseCategories,
      distributionlines: s.distributionLines,
      lowstockthreshold: s.lowStockThreshold
    };
  }

  async init() {
    if(this.isInitialized) return;
    try {
        const { data: set } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
        if (set) this.settings = this.mapFromDb(set);

        const [p, b, c, s, w, inv, pur, po, cash, rep, sm] = await Promise.all([
            this.fetchAllFromTable('products'),
            this.fetchAllFromTable('batches'),
            this.fetchAllFromTable('customers'),
            this.fetchAllFromTable('suppliers'),
            this.fetchAllFromTable('warehouses'),
            this.fetchAllFromTable('invoices'),
            this.fetchAllFromTable('purchase_invoices'),
            this.fetchAllFromTable('purchase_orders'),
            this.fetchAllFromTable('cash_transactions'),
            this.fetchAllFromTable('representatives'),
            this.fetchAllFromTable('stock_movements'),
        ]);

        if (p) this.products = p;
        if (b) this.batches = b;
        if (c) this.customers = c;
        if (s) this.suppliers = s;
        if (w) this.warehouses = w;
        if (inv) this.invoices = inv.map(i => ({ ...i, date: new Date(i.date).toISOString() }));
        if (pur) this.purchaseInvoices = pur.map(i => ({ ...i, date: new Date(i.date).toISOString() }));
        if (po) this.purchaseOrders = po.map(i => ({ ...i, date: new Date(i.date).toISOString() }));
        if (cash) this.cashTransactions = cash.map(i => ({ ...i, date: new Date(i.date).toISOString() }));
        if (rep) this.representatives = rep;
        if (sm) this.stockMovements = sm.map(i => ({ ...i, date: new Date(i.date).toISOString() }));

        if (this.warehouses.length === 0) {
            this.warehouses.push({ id: 'W1', name: 'المخزن الرئيسي', is_default: true });
        }
        
        this.logAction('INIT_SUCCESS', { count: this.products.length });
    } catch (error) {
        this.logAction('INIT_ERROR', { error });
        console.error("Database initialization failed:", error);
    } finally {
        this.isInitialized = true;
    }
  }

  getProductsWithBatches(): ProductWithBatches[] {
    return this.products.map(p => ({
      ...p,
      batches: this.batches.filter(b => b.product_id === p.id)
    }));
  }

  getProductById(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  getCustomers(): Customer[] { return [...this.customers]; }
  getSuppliers(): Supplier[] { return [...this.suppliers]; }
  getRepresentatives(): Representative[] { return [...this.representatives]; }
  getWarehouses(): Warehouse[] { return [...this.warehouses]; }
  getInvoices(): Invoice[] { return [...this.invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getPurchaseInvoices(): PurchaseInvoice[] { return [...this.purchaseInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getPurchaseOrders(): PurchaseOrder[] { return [...this.purchaseOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getCashTransactions(): CashTransaction[] { return [...this.cashTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getSettings(): SystemSettings { return { ...this.settings }; }
  
  getCashBalance(): number {
    return this.cashTransactions.reduce((acc, t) => {
      return t.type === CashTransactionType.RECEIPT ? acc + t.amount : acc - t.amount;
    }, 0);
  }

  getSystemSnapshot(): string {
    const totalSales = this.invoices.reduce((s, i) => s + i.net_total, 0);
    const cash = this.getCashBalance();
    const inventoryValue = this.batches.reduce((sum, b) => sum + (b.quantity * b.purchase_price), 0);
    return `Company: ${this.settings.companyName}\nSales: ${this.settings.currency}${totalSales}\nCash: ${this.settings.currency}${cash}\nStock Value: ${this.settings.currency}${inventoryValue}`;
  }

  async updateSettings(s: SystemSettings): Promise<boolean> {
    try {
        this.settings = { ...s };
        this.logAction('UPDATE_SETTINGS');
        if (!isSupabaseConfigured) return true;
        const dbPayload = this.mapToDb(s);
        const { error } = await supabase.from('settings').upsert(dbPayload, { onConflict: 'id' });
        if (error) throw error;
        return true;
    } catch (e) {
        this.logAction('UPDATE_SETTINGS_ERROR', { error: e });
        console.error("Update settings failed:", e);
        return true; 
    }
  }

  async resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.logAction('RESET_SETTINGS');
    if (isSupabaseConfigured) {
        try {
            await supabase.from('settings').delete().eq('id', 1);
        } catch (e) {
            console.error("Failed to reset remote settings:", e);
        }
    }
  }

  async addExpenseCategory(category: string) {
    const normalized = category.trim().toUpperCase();
    if (!normalized || this.settings.expenseCategories.includes(normalized)) return;
    const newCategories = [...this.settings.expenseCategories, normalized];
    await this.updateSettings({ ...this.settings, expenseCategories: newCategories });
  }

  async addCustomer(c: any) {
    const name = String(c.name || '').trim();
    if (!name) throw new Error("Customer name is required");
    const cust: Customer = { ...c, name, id: `C${Date.now()}`, current_balance: c.opening_balance || 0, credit_limit: c.credit_limit || 0 };
    this.customers.push(cust);
    this.logAction('ADD_CUSTOMER', { name: cust.name });
    if (isSupabaseConfigured) { try { await supabase.from('customers').insert(cust); } catch (e) { console.error(e); } }
  }

  async updateCustomer(id: string, updates: Partial<Customer>) {
      const index = this.customers.findIndex(c => c.id === id);
      if (index !== -1) {
          this.customers[index] = { ...this.customers[index], ...updates };
          this.logAction('UPDATE_CUSTOMER', { id });
          if (isSupabaseConfigured) { try { await supabase.from('customers').update(updates).eq('id', id); } catch (e) { console.error(e); } }
      }
  }

  async deleteCustomer(id: string) {
      this.customers = this.customers.filter(c => c.id !== id);
      this.logAction('DELETE_CUSTOMER', { id });
      if (isSupabaseConfigured) { try { await supabase.from('customers').delete().eq('id', id); } catch (e) { console.error(e); } }
  }

  async addSupplier(s: any) {
    const name = String(s.name || '').trim();
    if (!name) throw new Error("Supplier name is required");
    const supp: Supplier = { ...s, name, id: `S${Date.now()}`, current_balance: s.opening_balance || 0 };
    this.suppliers.push(supp);
    this.logAction('ADD_SUPPLIER', { name: supp.name });
    if (isSupabaseConfigured) { try { await supabase.from('suppliers').insert(supp); } catch (e) { console.error(e); } }
  }

  async addRepresentative(r: any) {
      const rep: Representative = { ...r, id: `R${Date.now()}` };
      this.representatives.push(rep);
      this.logAction('ADD_REPRESENTATIVE', { name: rep.name });
      if (isSupabaseConfigured) { try { await supabase.from('representatives').insert(rep); } catch (e) { console.error(e); } }
  }

  async updateRepresentative(id: string, updates: Partial<Representative>) {
      const idx = this.representatives.findIndex(r => r.id === id);
      if (idx !== -1) {
          this.representatives[idx] = { ...this.representatives[idx], ...updates };
          this.logAction('UPDATE_REPRESENTATIVE', { id });
          if (isSupabaseConfigured) { try { await supabase.from('representatives').update(updates).eq('id', id); } catch (e) { console.error(e); } }
      }
  }

  async deleteRepresentative(id: string) {
    this.representatives = this.representatives.filter(r => r.id !== id);
    this.logAction('DELETE_REPRESENTATIVE', { id });
    if (isSupabaseConfigured) { try { await supabase.from('representatives').delete().eq('id', id); } catch (e) { console.error(e); } }
  }

  async addWarehouse(name: string) {
      const sanitizedName = String(name || '').trim();
      if (!sanitizedName) return;
      const id = `W-${Date.now()}`;
      const w = { id, name: sanitizedName, is_default: false };
      this.warehouses.push(w);
      this.logAction('ADD_WAREHOUSE', { name: sanitizedName });
      if (isSupabaseConfigured) { try { await supabase.from('warehouses').insert(w); } catch (e) { console.error(e); } }
  }

  async updateWarehouse(id: string, name: string) {
    const sanitizedName = String(name || '').trim();
    if (!sanitizedName) return;
    const idx = this.warehouses.findIndex(w => w.id === id);
    if (idx !== -1) {
      this.warehouses[idx].name = sanitizedName;
      this.logAction('UPDATE_WAREHOUSE', { id, name: sanitizedName });
      if (isSupabaseConfigured) { try { await supabase.from('warehouses').update({ name: sanitizedName }).eq('id', id); } catch (e) { console.error(e); } }
    }
  }

  async addProduct(p: any, b?: any): Promise<string> {
    const productName = String(p.name || '').trim();
    if (!productName) throw new Error("Product name is required");
    
    let codeStr = (p.code && String(p.code).trim()) ? String(p.code).trim() : `AUTO-${Date.now().toString().slice(-6)}`;
    let existingIdx = this.products.findIndex(x => (p.code && x.code === codeStr) || x.name === productName);
    let pid = existingIdx !== -1 ? this.products[existingIdx].id : null;

    const s_price = isNaN(Number(b?.selling_price)) ? (Number(p.selling_price) || 0) : Number(b.selling_price);
    const p_price = isNaN(Number(b?.purchase_price)) ? (Number(p.purchase_price) || 0) : Number(b.purchase_price);

    if (existingIdx === -1) {
        pid = `P${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const product: Product = { id: pid, code: codeStr, name: productName, selling_price: s_price, purchase_price: p_price };
        this.products.push(product);
        this.logAction('ADD_PRODUCT', { name: productName });
        if (isSupabaseConfigured) { try { await supabase.from('products').insert(product); } catch (e) { console.error(e); } }
    } else {
        const updates: Partial<Product> = {
            selling_price: s_price > 0 ? s_price : this.products[existingIdx].selling_price,
            purchase_price: p_price > 0 ? p_price : this.products[existingIdx].purchase_price,
            name: productName
        };
        this.products[existingIdx] = { ...this.products[existingIdx], ...updates };
        this.logAction('UPDATE_PRODUCT', { id: pid });
        if (isSupabaseConfigured) { try { await supabase.from('products').update(updates).eq('id', pid); } catch (e) { console.error(e); } }
    }
    
    if (b && pid && !isNaN(Number(b.quantity)) && Number(b.quantity) > 0) {
        const defaultWarehouseId = this.warehouses.find(w => w.is_default)?.id || 'W1';
        const bNo = String(b.batch_number || 'AUTO');
        const existingBatchIdx = this.batches.findIndex(x => x.product_id === pid && x.batch_number === bNo);
        const qty = Number(b.quantity);

        if (existingBatchIdx !== -1) {
            const updatedBatch = { ...this.batches[existingBatchIdx], quantity: qty, purchase_price: p_price, selling_price: s_price, expiry_date: b.expiry_date || this.batches[existingBatchIdx].expiry_date };
            this.batches[existingBatchIdx] = updatedBatch;
            if (isSupabaseConfigured) { try { await supabase.from('batches').update(updatedBatch).eq('id', updatedBatch.id); } catch (e) { console.error(e); } }
        } else {
            const batchId = `B${Date.now()}-${Math.floor(Math.random()*1000)}`;
            const batch = { id: batchId, product_id: pid, warehouse_id: defaultWarehouseId, batch_number: bNo, quantity: qty, purchase_price: p_price, selling_price: s_price, expiry_date: b.expiry_date || '2099-12-31', status: BatchStatus.ACTIVE };
            this.batches.push(batch);
            if (isSupabaseConfigured) { try { await supabase.from('batches').insert(batch); } catch (e) { console.error(e); } }
        }
    }
    return pid || '';
  }

  async updateBatchPrices(batchId: string, purchase_price: number, selling_price: number, quantity: number) {
      const idx = this.batches.findIndex(b => b.id === batchId);
      if (idx !== -1) {
          const pid = this.batches[idx].product_id;
          this.batches[idx].purchase_price = purchase_price;
          this.batches[idx].selling_price = selling_price;
          this.batches[idx].quantity = quantity;
          
          this.logAction('UPDATE_BATCH', { id: batchId });

          const pIdx = this.products.findIndex(p => p.id === pid);
          if (pIdx !== -1) {
              this.products[pIdx].selling_price = selling_price;
              this.products[pIdx].purchase_price = purchase_price;
              if (isSupabaseConfigured) { try { await supabase.from('products').update({ selling_price, purchase_price }).eq('id', pid); } catch (e) {} }
          }
          if (isSupabaseConfigured) { try { await supabase.from('batches').update({ purchase_price, selling_price, quantity }).eq('id', batchId); } catch (e) {} }
      }
  }

  async updateProductPrices(productId: string, purchase_price: number, selling_price: number) {
      const idx = this.products.findIndex(p => p.id === productId);
      if (idx !== -1) {
          this.products[idx].selling_price = selling_price;
          this.products[idx].purchase_price = purchase_price;
          this.logAction('UPDATE_PRODUCT_PRICES', { id: productId });
          if (isSupabaseConfigured) { try { await supabase.from('products').update({ selling_price, purchase_price }).eq('id', productId); } catch (e) {} }
      }
  }

  async adjustStock(batchId: string, newQuantity: number): Promise<{ success: boolean; message: string }> {
      const idx = this.batches.findIndex(b => b.id === batchId);
      if (idx !== -1) {
          this.batches[idx].quantity = newQuantity;
          this.logAction('ADJUST_STOCK', { batchId, newQuantity });
          if (isSupabaseConfigured) { try { await supabase.from('batches').update({ quantity: newQuantity }).eq('id', batchId); } catch (e) {} }
          return { success: true, message: 'Stock Updated' };
      }
      return { success: false, message: 'Batch not found' };
  }

  async reportSpoilage(batchId: string, quantityToRemove: number, reason: string): Promise<{ success: boolean; message: string }> {
      const idx = this.batches.findIndex(b => b.id === batchId);
      if (idx === -1) return { success: false, message: 'Batch not found' };
      if (this.batches[idx].quantity < quantityToRemove) return { success: false, message: 'Insufficient quantity' };
      const newQty = this.batches[idx].quantity - quantityToRemove;
      this.batches[idx].quantity = newQty;
      this.logAction('REPORT_SPOILAGE', { batchId, qty: quantityToRemove, reason });
      if (isSupabaseConfigured) { try { await supabase.from('batches').update({ quantity: newQty }).eq('id', batchId); } catch (e) {} }
      return { success: true, message: `Spoilage recorded` };
  }

  async transferStock(batchId: string, targetWarehouseId: string, quantity: number): Promise<{ success: boolean; message: string }> {
    try {
        const targetWarehouse = this.warehouses.find(w => w.id === targetWarehouseId);
        if (!targetWarehouse) throw new Error("Target warehouse not found");

        const sourceBatchIdx = this.batches.findIndex(b => b.id === batchId);
        if (sourceBatchIdx === -1) throw new Error("Source Batch Not Found");
        const sourceBatch = this.batches[sourceBatchIdx];
        if (sourceBatch.quantity < quantity) throw new Error("Insufficient Quantity");
        
        const newSourceQty = sourceBatch.quantity - quantity;
        sourceBatch.quantity = newSourceQty;
        if (isSupabaseConfigured) { try { await supabase.from('batches').update({ quantity: newSourceQty }).eq('id', batchId); } catch (e) {} }
        
        const newBatchId = `B${Date.now()}-T`;
        const newBatch = { ...sourceBatch, id: newBatchId, warehouse_id: targetWarehouseId, quantity: quantity };
        this.batches.push(newBatch);
        this.logAction('TRANSFER_STOCK', { from: batchId, to: targetWarehouseId, qty: quantity });
        if (isSupabaseConfigured) { try { await supabase.from('batches').insert(newBatch); } catch (e) {} }
        return { success: true, message: 'Transfer successful' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPaid: number): Promise<{ success: boolean; message: string; id?: string }> {
    try {
        const index = this.invoices.findIndex(i => i.id === id);
        if (index === -1) throw new Error("Invoice not found");
        this.invoices[index] = { ...this.invoices[index], customer_id: customerId, items: items };
        this.logAction('UPDATE_INVOICE', { id });
        if (isSupabaseConfigured) { try { await supabase.from('invoices').update({ customer_id: customerId, items: items }).eq('id', id); } catch (e) {} }
        return { success: true, message: 'Invoice updated', id };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  async createInvoice(customerId: string, items: CartItem[], cashPaid: number, isReturn: boolean = false, additionalDiscount: number = 0, createdBy?: { id: string; name: string }): Promise<{ success: boolean; message: string; id?: string }> {
    try {
        const customerIdx = this.customers.findIndex(c => c.id === customerId);
        if (customerIdx === -1) throw new Error("Customer not found");
        let totalGross = 0;
        let totalItemDiscount = 0;
        for(const item of items) {
             const price = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || item.product.selling_price || 0);
             totalGross += (item.quantity * price);
             totalItemDiscount += (item.quantity * price * (item.discount_percentage / 100));
        }
        const netTotal = totalGross - totalItemDiscount - additionalDiscount;
        
        for(const item of items) {
            if (item.batch) {
                const batchIdx = this.batches.findIndex(b => b.id === item.batch?.id);
                if(batchIdx === -1) continue;
                const totalQtyChange = item.quantity + (item.bonus_quantity || 0);
                const newQty = isReturn ? this.batches[batchIdx].quantity + totalQtyChange : this.batches[batchIdx].quantity - totalQtyChange;
                this.batches[batchIdx].quantity = newQty;
                if (isSupabaseConfigured) { try { await supabase.from('batches').update({ quantity: newQty }).eq('id', item.batch.id); } catch (e) {} }
            }
        }

        const newBalance = isReturn ? this.customers[customerIdx].current_balance - netTotal : this.customers[customerIdx].current_balance + netTotal;
        this.customers[customerIdx].current_balance = newBalance;
        if (isSupabaseConfigured) { try { await supabase.from('customers').update({ current_balance: newBalance }).eq('id', customerId); } catch (e) {} }
        
        const invoiceId = `INV-${Date.now()}`;
        const invoice: Invoice = {
            id: invoiceId, invoice_number: `${Date.now()}`, customer_id: customerId, created_by: createdBy?.id, created_by_name: createdBy?.name,
            date: new Date().toISOString(), total_before_discount: totalGross, total_discount: totalItemDiscount, additional_discount: additionalDiscount,
            net_total: netTotal, previous_balance: this.customers[customerIdx].current_balance - (isReturn ? -netTotal : netTotal), final_balance: newBalance,
            payment_status: cashPaid >= netTotal ? PaymentStatus.PAID : cashPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID,
            items: items, type: isReturn ? 'RETURN' : 'SALE'
        };
        this.invoices.push(invoice);
        this.logAction('CREATE_INVOICE', { id: invoiceId, customer: customerId, total: netTotal });
        
        if(cashPaid > 0) {
             await this.addCashTransaction({
                 type: isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT, 
                 category: 'CUSTOMER_PAYMENT',
                 reference_id: customerId, 
                 related_name: this.customers[customerIdx].name, amount: cashPaid,
                 date: new Date().toISOString(), notes: `${isReturn ? 'Refund' : 'Payment'} for INV#${invoice.invoice_number}`,
                 ref_number: this.getNextTransactionRef(isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT)
             });
        }
        
        if (isSupabaseConfigured) { try { await supabase.from('invoices').insert(invoice); } catch (e) {} }
        return { success: true, message: isReturn ? 'Return Created' : 'Invoice Created', id: invoiceId };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  async recordInvoicePayment(invoiceId: string, amount: number): Promise<{ success: boolean; message: string }> {
      const invIdx = this.invoices.findIndex(i => i.id === invoiceId);
      if (invIdx === -1) return { success: false, message: "Invoice not found" };
      const invoice = this.invoices[invIdx];
      const customerIdx = this.customers.findIndex(c => c.id === invoice.customer_id);
      if (customerIdx !== -1) {
          const newBal = this.customers[customerIdx].current_balance - amount;
          this.customers[customerIdx].current_balance = newBal;
          if (isSupabaseConfigured) { try { await supabase.from('customers').update({ current_balance: newBal }).eq('id', invoice.customer_id); } catch (e) {} }
      }
      await this.addCashTransaction({
          type: CashTransactionType.RECEIPT, category: 'CUSTOMER_PAYMENT', reference_id: invoice.customer_id,
          related_name: this.customers[customerIdx]?.name, amount: amount, date: new Date().toISOString(),
          notes: `Payment for INV#${invoice.invoice_number}`,
          ref_number: this.getNextTransactionRef(CashTransactionType.RECEIPT)
      });
      return { success: true, message: "Payment recorded" };
    }

  getInvoicePaidAmount(invoiceId: string): number {
      return this.cashTransactions
        .filter(t => t.notes?.includes(invoiceId) && t.category === 'CUSTOMER_PAYMENT' && t.type === 'RECEIPT')
        .reduce((sum, t) => sum + t.amount, 0);
  }

  async addCashTransaction(tx: Omit<CashTransaction, 'id'>) {
      const id = `TX${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const newTx: CashTransaction = { 
          ...tx, 
          id,
          created_at: now,
          updated_at: now
      };
      this.cashTransactions.push(newTx);
      this.logAction('ADD_CASH_TX', { type: tx.type, amount: tx.amount });
      if (isSupabaseConfigured) { try { await supabase.from('cash_transactions').insert(newTx); } catch (e) {} }
  }

  getNextTransactionRef(type: CashTransactionType): string {
    const prefix = type === CashTransactionType.RECEIPT ? 'REC' : 'PAY';
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const count = this.cashTransactions
        .filter(t => t.type === type && t.ref_number?.startsWith(`${prefix}-${date}`))
        .length + 1;
    return `${prefix}-${date}-${count.toString().padStart(3, '0')}`;
  }

  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean): Promise<{ success: boolean; message: string }> {
    try {
        const id = `PUR-${Date.now()}`;
        const total = items.reduce((a,b)=>a+(b.quantity*b.cost_price),0);
        const supplierIdx = this.suppliers.findIndex(s => s.id === supplierId);
        if (supplierIdx !== -1) {
            const balanceChange = isReturn ? -total : total;
            const newBal = this.suppliers[supplierIdx].current_balance + balanceChange;
            this.suppliers[supplierIdx].current_balance = newBal;
            if (isSupabaseConfigured) { try { await supabase.from('suppliers').update({ current_balance: newBal }).eq('id', supplierId); } catch (e) {} }
        }
        for (const item of items) {
            const bNo = item.batch_number || 'AUTO';
            const existingBatch = this.batches.find(b => b.product_id === item.product_id && b.batch_number === bNo);
            if (existingBatch) {
                const newQty = isReturn ? existingBatch.quantity - item.quantity : existingBatch.quantity + item.quantity;
                existingBatch.quantity = newQty;
                if (isSupabaseConfigured) { try { await supabase.from('batches').update({ quantity: newQty }).eq('id', existingBatch.id); } catch (e) {} }
            } else if (!isReturn) {
                const newB = {
                    id: `B-${Date.now()}-${Math.floor(Math.random()*100)}`, product_id: item.product_id, warehouse_id: item.warehouse_id,
                    batch_number: bNo, quantity: item.quantity, purchase_price: item.cost_price, selling_price: item.selling_price,
                    expiry_date: item.expiry_date || '2099-12-31', status: BatchStatus.ACTIVE
                };
                this.batches.push(newB);
                if (isSupabaseConfigured) { try { await supabase.from('batches').insert(newB); } catch (e) {} }
            }
            await this.updateProductPrices(item.product_id, item.cost_price, item.selling_price);
        }
        const inv: PurchaseInvoice = { id, invoice_number: id, supplier_id: supplierId, date: new Date().toISOString(), total_amount: total, paid_amount: cashPaid, type: isReturn ? 'RETURN' : 'PURCHASE', items };
        this.purchaseInvoices.push(inv);
        this.logAction('CREATE_PURCHASE', { id, total });
        if (isSupabaseConfigured) { try { await supabase.from('purchase_invoices').insert(inv); } catch (e) {} }
        return { success: true, message: 'Purchase saved' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  async createPurchaseOrder(supplierId: string, items: any[]): Promise<{ success: boolean; message: string }> {
      const id = `PO-${Date.now()}`;
      const order: PurchaseOrder = { id, order_number: id, supplier_id: supplierId, date: new Date().toISOString(), status: 'PENDING', items };
      this.purchaseOrders.push(order);
      this.logAction('CREATE_PURCHASE_ORDER', { id });
      if (isSupabaseConfigured) { try { await supabase.from('purchase_orders').insert(order); } catch (e) {} }
      return { success: true, message: 'Order saved' };
  }

  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED') {
    const idx = this.purchaseOrders.findIndex(po => po.id === id);
    if (idx !== -1) {
      this.purchaseOrders[idx].status = status;
      this.logAction('UPDATE_PO_STATUS', { id, status });
      if (isSupabaseConfigured) { try { await supabase.from('purchase_orders').update({ status }).eq('id', id); } catch (e) {} }
    }
  }

  getInvoiceProfit(invoice: Invoice): number {
      if (!invoice.items) return 0;
      let totalCost = 0;
      invoice.items.forEach(item => {
          const totalQty = item.quantity + (item.bonus_quantity || 0);
          const cost = item.batch ? item.batch.purchase_price : (item.product.purchase_price || 0);
          totalCost += (totalQty * cost);
      });
      const profit = invoice.net_total - totalCost;
      return invoice.type === 'RETURN' ? -profit : profit;
  }

  getABCAnalysis() {
      const productRevenue: Record<string, number> = {};
      let totalRevenue = 0;
      this.invoices.filter(i => i.type === 'SALE').forEach(inv => {
          inv.items.forEach(item => {
              const price = item.unit_price || (item.batch?.selling_price || item.product.selling_price || 0);
              const revenue = item.quantity * price * (1 - (item.discount_percentage / 100));
              productRevenue[item.product.id] = (productRevenue[item.product.id] || 0) + revenue;
              totalRevenue += revenue;
          });
      });
      const sortedProducts = Object.entries(productRevenue)
          .map(([id, revenue]) => {
              const product = this.products.find(p => p.id === id);
              return { id, name: product?.name || 'Unknown', revenue };
          })
          .sort((a, b) => b.revenue - a.revenue);
      let cumulativeRevenue = 0;
      return { 
          classifiedProducts: sortedProducts.map(p => {
              cumulativeRevenue += p.revenue;
              const percentage = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 0;
              let category = 'C';
              if (percentage <= 80) category = 'A';
              else if (percentage <= 95) category = 'B';
              return { ...p, category, percentage };
          }), 
          totalRevenue 
      };
  }

  getInventoryValuationReport() {
      return this.products.map(p => {
          const batches = this.batches.filter(b => b.product_id === p.id);
          const totalQty = batches.reduce((sum, b) => sum + b.quantity, 0);
          const totalValue = batches.reduce((sum, b) => sum + (b.quantity * b.purchase_price), 0);
          return {
              id: p.id, name: p.name, code: p.code,
              totalQty, totalValue, wac: totalQty > 0 ? totalValue / totalQty : (p.purchase_price || 0),
              latestCost: batches.length > 0 ? batches[batches.length-1].purchase_price : (p.purchase_price || 0),
              turnoverRate: '0'
          };
      });
  }

  async clearTransactions() {
      this.invoices = [];
      this.purchaseInvoices = [];
      this.cashTransactions = [];
      this.purchaseOrders = [];
      this.stockMovements = [];
      this.customers.forEach(c => c.current_balance = c.opening_balance);
      this.suppliers.forEach(s => s.current_balance = s.opening_balance);
      this.logAction('CLEAR_TRANSACTIONS');
      if (isSupabaseConfigured) {
        try {
          await Promise.all([
            supabase.from('invoices').delete().neq('id', '0'),
            supabase.from('purchase_invoices').delete().neq('id', '0'),
            supabase.from('cash_transactions').delete().neq('id', '0'),
            supabase.from('purchase_orders').delete().neq('id', '0'),
            supabase.from('stock_movements').delete().neq('id', '0')
          ]);
        } catch (e) {
          console.error("Failed to clear remote transactions:", e);
        }
      }
  }
  
  async clearCustomers() { 
      this.customers = [];
      this.logAction('CLEAR_CUSTOMERS');
      if (isSupabaseConfigured) { try { await supabase.from('customers').delete().neq('id', '0'); } catch (e) { console.error(e); } }
  }
  async clearProducts() { 
      this.products = [];
      this.batches = [];
      this.logAction('CLEAR_PRODUCTS');
      if (isSupabaseConfigured) { try { await supabase.from('products').delete().neq('id', '0'); } catch (e) { console.error(e); } }
  }
  
  async resetDatabase() {
      await this.clearTransactions();
      await this.clearCustomers();
      await this.clearProducts();
      await this.resetSettings();
      this.logAction('FACTORY_RESET');
      window.location.reload();
  }

  exportDatabase(): string { 
    const data = {
        meta: {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            recordCounts: {
                products: this.products.length,
                batches: this.batches.length,
                customers: this.customers.length,
                suppliers: this.suppliers.length,
                invoices: this.invoices.length,
                cashTransactions: this.cashTransactions.length
            }
        },
        data: {
            products: this.products, 
            batches: this.batches,
            customers: this.customers, 
            suppliers: this.suppliers, 
            representatives: this.representatives,
            warehouses: this.warehouses,
            invoices: this.invoices, 
            purchaseInvoices: this.purchaseInvoices,
            purchaseOrders: this.purchaseOrders,
            cashTransactions: this.cashTransactions,
            stockMovements: this.stockMovements,
            settings: this.settings 
        }
    };
    this.logAction('EXPORT_DATABASE');
    return JSON.stringify(data, null, 2); 
  }

  async importDatabase(json: string): Promise<{success: boolean; message: string; importedCounts?: any}> { 
      try {
          const data = JSON.parse(json);
          
          if (!data.data) {
              throw new Error("Invalid backup format: Missing data field.");
          }
          
          const d = data.data;
          this.products = d.products || [];
          this.batches = d.batches || [];
          this.customers = d.customers || [];
          this.suppliers = d.suppliers || [];
          this.representatives = d.representatives || [];
          this.warehouses = d.warehouses || [];
          this.invoices = d.invoices || [];
          this.purchaseInvoices = d.purchaseInvoices || [];
          this.purchaseOrders = d.purchaseOrders || [];
          this.cashTransactions = d.cashTransactions || [];
          this.stockMovements = d.stockMovements || [];
          this.settings = d.settings || this.settings;
          
          this.logAction('IMPORT_DATABASE', { meta: data.meta });

          if (isSupabaseConfigured) {
              console.warn("Manual import only updates memory. Refresh recommended.");
          }
          
          return { 
              success: true, 
              message: 'Database imported successfully in local memory.',
              importedCounts: data.meta?.recordCounts
          };
      } catch(e: any) { 
          this.logAction('IMPORT_DATABASE_ERROR', { error: e.message });
          return { success: false, message: e.message || 'Import failed' }; 
      }
  }
  
  getStockMovements(productId?: string) { 
      return productId ? this.stockMovements.filter(sm => sm.product_id === productId) : this.stockMovements; 
  }

  getGeneralLedger(): JournalEntry[] {
    const entries: JournalEntry[] = [];
    this.invoices.forEach(inv => {
        entries.push({ id: `JE-S-${inv.id}`, date: inv.date, description: `Sales Invoice #${inv.invoice_number}`, reference: inv.id, debit: inv.net_total, credit: 0, account: 'Accounts Receivable' });
        entries.push({ id: `JE-SR-${inv.id}`, date: inv.date, description: `Revenue for Invoice #${inv.invoice_number}`, reference: inv.id, debit: 0, credit: inv.net_total, account: 'Sales Revenue' });
    });
    this.cashTransactions.forEach(tx => {
        const isReceipt = tx.type === CashTransactionType.RECEIPT;
        entries.push({ id: `JE-C-${tx.id}`, date: tx.date, description: tx.notes || `${tx.type} - ${tx.category}`, reference: tx.id, debit: isReceipt ? tx.amount : 0, credit: isReceipt ? 0 : tx.amount, account: 'Cash Account' });
        entries.push({ id: `JE-CO-${tx.id}`, date: tx.date, description: tx.notes || `${tx.type} - ${tx.category}`, reference: tx.id, debit: isReceipt ? 0 : tx.amount, credit: isReceipt ? tx.amount : 0, account: tx.category === 'CUSTOMER_PAYMENT' ? 'Accounts Receivable' : tx.category });
    });
    return entries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const db = new DatabaseService();
