
// Fix: Complete implementation of the Database service to handle state management and persistence with Cloud Sync.
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  User, Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, StockMovement, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
} from '../types';

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
      companyAddress: '',
      companyPhone: '',
      companyLogo: '',
      companyTaxNumber: '',
      currency: 'LE', 
      language: 'ar',
      invoiceTemplate: '1',
      printerPaperSize: 'A4',
      lowStockThreshold: 10,
      distributionLines: [],
      expenseCategories: ['SALARY', 'ELECTRICITY', 'MARKETING', 'RENT', 'MAINTENANCE', 'OTHER']
  };
  dailyClosings: DailyClosing[] = [];
  pendingAdjustments: PendingAdjustment[] = [];
  isFullyLoaded: boolean = false;
  
  // عداد العمليات الجارية ونظام المستمعين
  public activeOperations: number = 0;
  private syncListeners: ((isBusy: boolean) => void)[] = [];

  constructor() {
    this.loadFromLocalCache();
  }

  // مولد معرفات فريد وقوي لتجنب تعارض 409
  private generateId(prefix: string = ''): string {
    const randomStr = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now().toString(36);
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().split('-')[0] : randomStr;
    return `${prefix}${timestamp}-${uuid}`;
  }

  // تسجيل مستمع للتغيرات في حالة المزامنة
  onSyncStateChange(callback: (isBusy: boolean) => void) {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== callback);
    };
  }

  private notifySyncState() {
    const isBusy = this.activeOperations > 0;
    this.syncListeners.forEach(l => l(isBusy));
  }

  private incrementOp() {
    this.activeOperations++;
    this.notifySyncState();
  }

  private decrementOp() {
    this.activeOperations = Math.max(0, this.activeOperations - 1);
    this.notifySyncState();
  }

  async init() {
    this.loadFromLocalCache();
    if (isSupabaseConfigured) {
        await this.syncFromCloud();
    }
    this.isFullyLoaded = true;
  }

  private async fetchFullTable<T>(tableName: string): Promise<T[]> {
    let allData: T[] = [];
    let from = 0;
    let to = 999;
    let finished = false;

    while (!finished) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .range(from, to);

        if (error) throw error;
        if (data) {
          allData = [...allData, ...data];
          if (data.length < 1000) finished = true;
          else { from += 1000; to += 1000; }
        } else { finished = true; }
      } catch (err) {
        console.error(`Fetch error for ${tableName}:`, err);
        finished = true;
      }
    }
    return allData;
  }

  async syncFromCloud() {
    if (!isSupabaseConfigured) return;
    
    try {
        console.log("Deep sync started...");
        this.incrementOp();
        const [p, b, c, s, inv, pinv, tx, wh, po] = await Promise.all([
            this.fetchFullTable<Product>('products'),
            this.fetchFullTable<Batch>('batches'),
            this.fetchFullTable<Customer>('customers'),
            this.fetchFullTable<Supplier>('suppliers'),
            this.fetchFullTable<Invoice>('invoices'),
            this.fetchFullTable<PurchaseInvoice>('purchase_invoices'),
            this.fetchFullTable<CashTransaction>('cash_transactions'),
            this.fetchFullTable<Warehouse>('warehouses'),
            this.fetchFullTable<PurchaseOrder>('purchase_orders')
        ]);

        if (p && p.length > 0) this.products = p;
        if (b && b.length > 0) this.batches = b;
        if (c && c.length > 0) this.customers = c;
        if (s && s.length > 0) this.suppliers = s;
        if (inv && inv.length > 0) this.invoices = inv;
        if (pinv && pinv.length > 0) this.purchaseInvoices = pinv;
        if (tx && tx.length > 0) this.cashTransactions = tx;
        if (wh && wh.length > 0) this.warehouses = wh;
        if (po && po.length > 0) this.purchaseOrders = po;

        const [ {data: sysSett}, {data: appSett} ] = await Promise.all([
            supabase.from('system_settings').select('*').eq('id', 'global_settings').maybeSingle(),
            supabase.from('settings').select('*').eq('id', 1).maybeSingle()
        ]);

        const cloudSettings: any = {};
        if (sysSett) {
            cloudSettings.companyName = sysSett.company_name;
            cloudSettings.currency = sysSett.currency;
            cloudSettings.companyLogo = sysSett.company_logo;
            cloudSettings.companyAddress = sysSett.company_address;
            cloudSettings.companyPhone = sysSett.company_phone;
            cloudSettings.lowStockThreshold = sysSett.low_stock_threshold;
        }

        if (appSett) {
            cloudSettings.companyName = appSett.companyname || cloudSettings.companyName;
            cloudSettings.currency = appSett.currency || cloudSettings.currency;
            cloudSettings.distributionLines = appSett.distributionlines || [];
        }

        if (Object.keys(cloudSettings).length > 0) {
            this.settings = { ...this.settings, ...cloudSettings };
        }

        this.saveToLocalCache();
        this.isFullyLoaded = true;
        console.log("Deep sync finished.");
    } catch (error) {
        console.error("Deep Cloud Sync Failed:", error);
    } finally {
        this.decrementOp();
    }
  }

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

  private async retryCloudOp(op: () => PromiseLike<any>, retries = 3): Promise<boolean> {
    this.incrementOp();
    try {
        for (let i = 0; i < retries; i++) {
            try {
                const { error } = await op();
                if (!error) return true;
                // If conflict, we might want to stop retrying depending on the app logic, 
                // but usually retry logic is for connection issues.
                if (error.code === '23505') {
                  console.error("Conflict detected in Cloud DB, stopping retries.");
                  return false;
                }
                console.warn(`Retry ${i+1} failed...`);
            } catch (e) {
                console.error(`Attempt ${i+1} exception:`, e);
            }
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
        return false;
    } finally {
        this.decrementOp();
    }
  }

  async addProduct(pData: any, bData: any) {
      // استخدام معرفات قوية لتجنب التعارض
      const p: Product = { ...pData, id: this.generateId('p-') };
      const b: Batch = { ...bData, id: this.generateId('b-'), product_id: p.id, status: BatchStatus.ACTIVE, batch_number: bData.batch_number || 'INITIAL' };
      
      if (isSupabaseConfigured) {
          // استخدام upsert بدلاً من insert لتفادي انهيار البرنامج عند التعارض
          await this.retryCloudOp(async () => await supabase.from('products').upsert(p));
          await this.retryCloudOp(async () => await supabase.from('batches').upsert(b));
      }
      
      this.products.push(p);
      this.batches.push(b);
      this.saveToLocalCache();
  }

  async updateProduct(id: string, data: Partial<Product>) {
    const p = this.products.find(x => x.id === id);
    if (p) {
      Object.assign(p, data);
      if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('products').update(data).eq('id', id));
      this.saveToLocalCache();
    }
    return true;
  }

  async deleteProduct(id: string) {
    if (isSupabaseConfigured) {
        await this.retryCloudOp(async () => await supabase.from('products').delete().eq('id', id));
    }
    this.products = this.products.filter(p => p.id !== id);
    this.batches = this.batches.filter(b => b.product_id !== id);
    this.saveToLocalCache();
    return true;
  }

  async addCustomer(data: any) {
    const customer: Customer = { 
      ...data, 
      id: this.generateId('c-'), 
      current_balance: data.opening_balance || 0 
    };
    if (isSupabaseConfigured) {
        await this.retryCloudOp(async () => await supabase.from('customers').upsert(customer));
    }
    this.customers.push(customer);
    this.saveToLocalCache();
    return customer;
  }

  async deleteCustomer(id: string) {
    if (isSupabaseConfigured) {
        await this.retryCloudOp(async () => await supabase.from('customers').delete().eq('id', id));
    }
    this.customers = this.customers.filter(c => c.id !== id);
    this.saveToLocalCache();
  }

  async addCashTransaction(data: any) {
      const tx = { ...data, id: this.generateId('tx-'), date: data.date || new Date().toISOString() };
      if (isSupabaseConfigured) {
          await this.retryCloudOp(async () => await supabase.from('cash_transactions').upsert(tx));
      }
      this.cashTransactions.push(tx);
      await this.recalculateAllBalances();
      this.saveToLocalCache();
  }

  async createInvoice(customer_id: string, items: CartItem[], cash_paid: number, is_return: boolean, additional_discount: number, creator?: { id: string, name: string }): Promise<{ success: boolean; id?: string; message?: string }> {
    this.incrementOp();
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
        id: this.generateId('inv-'),
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

      if (isSupabaseConfigured) {
          const { error } = await supabase.rpc('process_sales_invoice', {
              p_invoice: invoice,
              p_items: items
          });
          if (error) throw error;
      }

      items.forEach(item => {
        const batch = this.batches.find(b => b.id === item.batch?.id);
        if (batch) batch.quantity += is_return ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity);
      });

      this.invoices.push(invoice);
      if (customer) customer.current_balance = invoice.final_balance;
      
      if (cash_paid > 0) {
          await this.recordInvoicePayment(invoice.id, cash_paid);
      } else {
          this.saveToLocalCache();
      }
      
      return { success: true, id: invoice.id };
    } catch (e: any) {
      console.error("Cloud Save Failed:", e);
      return { success: false, message: 'فشل الحفظ في السحابة. يرجى التحقق من الإنترنت.' };
    } finally {
      this.decrementOp();
    }
  }

  async deleteInvoice(id: string) {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return;
    inv.items.forEach(item => {
      const batch = this.batches.find(b => b.id === item.batch?.id);
      if (batch) batch.quantity += (inv.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity));
    });
    if (isSupabaseConfigured) {
        await this.retryCloudOp(async () => await supabase.from('invoices').delete().eq('id', id));
        await this.retryCloudOp(async () => await supabase.from('cash_transactions').delete().eq('reference_id', id).eq('category', 'CUSTOMER_PAYMENT'));
    }
    this.invoices = this.invoices.filter(i => i.id !== id);
    this.cashTransactions = this.cashTransactions.filter(t => !(t.reference_id === id && t.category === 'CUSTOMER_PAYMENT'));
    await this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  async updateInvoice(id: string, customer_id: string, items: CartItem[], cash_paid: number) {
    const oldInv = this.invoices.find(i => i.id === id);
    const is_return = oldInv?.type === 'RETURN';
    await this.deleteInvoice(id);
    return await this.createInvoice(customer_id, items, cash_paid, is_return || false, 0);
  }

  async recordInvoicePayment(invoiceId: string, amount: number): Promise<{ success: boolean; message?: string }> {
      const inv = this.invoices.find(i => i.id === invoiceId);
      const cust = this.customers.find(c => c.id === inv?.customer_id);
      if (inv && cust) {
          const tx: CashTransaction = {
              id: this.generateId('pay-'),
              type: inv.type === 'SALE' ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
              category: 'CUSTOMER_PAYMENT',
              reference_id: invoiceId,
              related_name: cust.name,
              amount,
              date: new Date().toISOString(),
              notes: `سداد فاتورة #${inv.invoice_number}`,
              ref_number: `PAY-${Date.now().toString().slice(-4)}`
          };
          
          if (isSupabaseConfigured) {
              await this.retryCloudOp(async () => await supabase.from('cash_transactions').upsert(tx));
              await this.retryCloudOp(async () => await supabase.from('customers').update({ current_balance: cust.current_balance }).eq('id', cust.id));
          }
          
          this.cashTransactions.push(tx);
          await this.recalculateAllBalances();
          return { success: true };
      }
      return { success: false, message: 'Invoice or customer not found' };
  }

  async updateSettings(s: any) { 
      this.settings = { ...this.settings, ...s }; 
      
      if (isSupabaseConfigured) {
          try {
              this.incrementOp();
              await supabase.from('system_settings').upsert({ 
                  id: 'global_settings',
                  company_name: this.settings.companyName,
                  currency: this.settings.currency,
                  updated_at: new Date().toISOString()
              });
              await supabase.from('settings').upsert({ id: 1, companyname: this.settings.companyName, currency: this.settings.currency });
          } catch (e) {
              console.error("Failed to sync settings:", e);
          } finally {
              this.decrementOp();
          }
      }
      this.saveToLocalCache(); 
      return true; 
  }
  
  async updateCustomer(id: string, data: any) {
    const customer = this.customers.find(c => c.id === id);
    if (customer) {
      Object.assign(customer, data);
      if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('customers').update(data).eq('id', id));
      await this.recalculateAllBalances();
    }
  }
  async addSupplier(data: any) {
    const supplier: Supplier = { ...data, id: this.generateId('s-'), current_balance: data.opening_balance || 0 };
    if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('suppliers').upsert(supplier));
    this.suppliers.push(supplier);
    this.saveToLocalCache();
    return supplier;
  }
  async updateSupplier(id: string, data: any) {
    const supplier = this.suppliers.find(s => s.id === id);
    if (supplier) {
      Object.assign(supplier, data);
      if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('suppliers').update(data).eq('id', id));
      await this.recalculateAllBalances();
    }
  }
  async deleteSupplier(id: string) {
    if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('suppliers').delete().eq('id', id));
    this.suppliers = this.suppliers.filter(s => s.id !== id);
    this.saveToLocalCache();
  }
  async addWarehouse(name: string) { 
    const w = { id: this.generateId('wh-'), name, is_default: false };
    if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('warehouses').upsert(w));
    this.warehouses.push(w); 
    this.saveToLocalCache(); 
  }

  async updateWarehouse(id: string, name: string) {
      const w = this.warehouses.find(x => x.id === id);
      if (w) {
          w.name = name;
          if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('warehouses').update({ name }).eq('id', id));
          this.saveToLocalCache();
      }
  }

  async deleteWarehouse(id: string): Promise<{ success: boolean; message?: string }> {
    const w = this.warehouses.find(x => x.id === id);
    if (!w || w.is_default) return { success: false, message: 'لا يمكن حذف المستودع الرئيسي' };
    
    if (isSupabaseConfigured) {
        await this.retryCloudOp(async () => await supabase.from('warehouses').delete().eq('id', id));
    }
    
    this.warehouses = this.warehouses.filter(x => x.id !== id);
    this.saveToLocalCache();
    return { success: true };
  }

  async createPurchaseInvoice(supplier_id: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean, docNo?: string, date?: string): Promise<{ success: boolean; message?: string }> {
    this.incrementOp();
    try {
      const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);
      const enrichedItems = items.map((item, idx) => ({ ...item, serial_number: idx + 1 }));

      const invoice: PurchaseInvoice = {
        id: this.generateId('pur-'),
        invoice_number: `PUR-${Date.now().toString().slice(-6)}`,
        document_number: docNo,
        supplier_id,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        total_amount,
        paid_amount: cashPaid,
        type: isReturn ? 'RETURN' : 'PURCHASE',
        items: enrichedItems
      };

      if (isSupabaseConfigured) {
          const { error } = await supabase.from('purchase_invoices').upsert(invoice);
          if (error) throw error;
      }

      for (const item of enrichedItems) {
        let batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id && b.batch_number === item.batch_number);
        const totalQtyToAdd = item.quantity + (item.bonus_quantity || 0);

        if (batch) {
          batch.quantity += isReturn ? -totalQtyToAdd : totalQtyToAdd;
          batch.purchase_price = item.cost_price;
          batch.selling_price = item.selling_price;
        } else {
          batch = {
            id: this.generateId('b-'),
            product_id: item.product_id,
            warehouse_id: item.warehouse_id,
            batch_number: item.batch_number,
            purchase_price: item.cost_price,
            selling_price: item.selling_price,
            quantity: isReturn ? -totalQtyToAdd : totalQtyToAdd,
            expiry_date: item.expiry_date,
            status: BatchStatus.ACTIVE
          };
          this.batches.push(batch);
        }
        if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('batches').upsert(batch));
      }

      this.purchaseInvoices.push(invoice);
      if (cashPaid > 0) {
        const tx: CashTransaction = {
          id: this.generateId('tx-'),
          type: isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
          category: 'SUPPLIER_PAYMENT',
          reference_id: invoice.id,
          related_name: this.suppliers.find(s => s.id === supplier_id)?.name || 'مورد',
          amount: cashPaid,
          date: invoice.date,
          notes: `سداد فاتورة مشتريات #${invoice.invoice_number}`,
          ref_number: `PPAY-${Date.now().toString().slice(-4)}`
        };
        if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('cash_transactions').upsert(tx));
        this.cashTransactions.push(tx);
      }

      await this.recalculateAllBalances();
      this.saveToLocalCache();
      return { success: true };
    } catch (e: any) {
      return { success: false, message: 'فشل المزامنة السحابية. يرجى التحقق من الاتصال.' };
    } finally {
      this.decrementOp();
    }
  }

  async deletePurchaseInvoice(id: string, updateInventory: boolean = true, updateBalance: boolean = true) {
    const inv = this.purchaseInvoices.find(i => i.id === id);
    if (!inv) return;

    if (updateInventory) {
      inv.items.forEach(item => {
        const batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id && b.batch_number === item.batch_number);
        const totalQtyToRemove = item.quantity + (item.bonus_quantity || 0);
        if (batch) batch.quantity += (inv.type === 'PURCHASE' ? -totalQtyToRemove : totalQtyToRemove);
      });
    }

    if (isSupabaseConfigured) {
        await this.retryCloudOp(async () => await supabase.from('purchase_invoices').delete().eq('id', id));
        await this.retryCloudOp(async () => await supabase.from('cash_transactions').delete().eq('reference_id', id).eq('category', 'SUPPLIER_PAYMENT'));
    }

    this.purchaseInvoices = this.purchaseInvoices.filter(i => i.id !== id);
    this.cashTransactions = this.cashTransactions.filter(t => !(t.reference_id === id && t.category === 'SUPPLIER_PAYMENT'));
    
    if (updateBalance) {
      await this.recalculateAllBalances();
    }
    
    this.saveToLocalCache();
  }

  async updateRepresentative(id: string, data: any) {
    const rep = this.representatives.find(r => r.id === id);
    if (rep) {
        Object.assign(rep, data);
        if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('representatives').update(data).eq('id', id));
        this.saveToLocalCache();
    }
  }

  async addRepresentative(data: any) {
    const rep: Representative = { ...data, id: this.generateId('rep-') };
    if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('representatives').upsert(rep));
    this.representatives.push(rep);
    this.saveToLocalCache();
  }

  async deleteRepresentative(id: string) {
    if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('representatives').delete().eq('id', id));
    this.representatives = this.representatives.filter(r => r.id !== id);
    this.saveToLocalCache();
  }

  async submitStockTake(adjustments: any[]) {
      const pAds = adjustments.map(a => ({
          ...a,
          id: this.generateId('adj-'),
          date: new Date().toISOString(),
          status: 'PENDING'
      }));
      if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('pending_adjustments').upsert(pAds));
      this.pendingAdjustments.push(...pAds);
      this.saveToLocalCache();
  }

  async approveAdjustment(id: string) {
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (adj) {
          const product = this.getProductsWithBatches().find(p => p.id === adj.product_id);
          const batch = product?.batches.find(b => b.warehouse_id === adj.warehouse_id);
          if (batch) {
              batch.quantity = adj.actual_qty;
              if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('batches').update({ quantity: batch.quantity }).eq('id', batch.id));
          }
          adj.status = 'APPROVED';
          if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('pending_adjustments').update({ status: 'APPROVED' }).eq('id', id));
          this.saveToLocalCache();
          return true;
      }
      return false;
  }

  async rejectAdjustment(id: string) {
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (adj) {
          adj.status = 'REJECTED';
          if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('pending_adjustments').update({ status: 'REJECTED' }).eq('id', id));
          this.saveToLocalCache();
          return true;
      }
      return false;
  }

  async createPurchaseOrder(supplier_id: string, items: any[]) {
      const order: PurchaseOrder = {
          id: this.generateId('ord-'),
          order_number: `ORD-${Date.now().toString().slice(-6)}`,
          supplier_id,
          date: new Date().toISOString(),
          status: 'PENDING',
          items
      };
      if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('purchase_orders').upsert(order));
      this.purchaseOrders.push(order);
      this.saveToLocalCache();
      return { success: true };
  }

  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED') {
      const order = this.purchaseOrders.find(o => o.id === id);
      if (order) {
          order.status = status;
          if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('purchase_orders').update({ status }).eq('id', id));
          this.saveToLocalCache();
      }
  }

  getDailySummary(date: string) {
      const invoices = this.invoices.filter(i => i.date.startsWith(date) && i.type === 'SALE');
      const pInvoices = this.purchaseInvoices.filter(i => i.date.startsWith(date) && i.type === 'PURCHASE');
      const txs = this.cashTransactions.filter(t => t.date.startsWith(date));
      
      const cashSales = invoices.reduce((s, i) => s + this.getInvoicePaidAmount(i.id), 0);
      const otherReceipts = txs.filter(t => t.type === 'RECEIPT' && t.category !== 'CUSTOMER_PAYMENT').reduce((s, t) => s + t.amount, 0);
      
      const cashPurchases = pInvoices.reduce((s, i) => s + i.paid_amount, 0);
      const expenses = txs.filter(t => t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((s, t) => s + t.amount, 0);
      
      const prevClosing = this.dailyClosings.filter(c => c.date < date).sort((a,b) => b.date.localeCompare(a.date))[0];
      const openingCash = prevClosing ? prevClosing.cash_balance : 0;
      
      const expectedCash = openingCash + cashSales + otherReceipts - cashPurchases - expenses;
      const inventoryValue = this.getProductsWithBatches().reduce((sum, p) => sum + (p.batches.reduce((s, b) => s + b.quantity, 0) * (p.purchase_price || 0)), 0);
      
      return { openingCash, cashSales, expenses, cashPurchases, expectedCash, inventoryValue };
  }

  async saveDailyClosing(data: any) {
      this.incrementOp();
      try {
        const closing: DailyClosing = { ...data, id: this.generateId('dc-'), updated_at: new Date().toISOString() };
        if (isSupabaseConfigured) await this.retryCloudOp(async () => await supabase.from('daily_closings').upsert(closing));
        this.dailyClosings.push(closing);
        this.saveToLocalCache();
        return true;
      } finally {
        this.decrementOp();
      }
  }

  getNextTransactionRef(type: CashTransactionType) {
      return `${type === 'RECEIPT' ? 'REC' : 'EXP'}-${Date.now().toString().slice(-6)}`;
  }

  async addExpenseCategory(cat: string) {
      if (!this.settings.expenseCategories.includes(cat)) {
          this.settings.expenseCategories.push(cat);
          await this.updateSettings(this.settings);
      }
  }

  async clearAllSales() {
    this.invoices = [];
    this.cashTransactions = this.cashTransactions.filter(t => t.category !== 'CUSTOMER_PAYMENT');
    if (isSupabaseConfigured) {
        await supabase.from('invoices').delete().neq('id', '0');
        await supabase.from('cash_transactions').delete().eq('category', 'CUSTOMER_PAYMENT');
    }
    await this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  async resetCustomerAccounts() {
    this.customers.forEach(c => { c.current_balance = c.opening_balance; });
    this.invoices = [];
    this.cashTransactions = this.cashTransactions.filter(t => t.category !== 'CUSTOMER_PAYMENT');
    if (isSupabaseConfigured) {
        await supabase.from('invoices').delete().neq('id', '0');
        await supabase.from('cash_transactions').delete().eq('category', 'CUSTOMER_PAYMENT');
        for (const c of this.customers) {
            await supabase.from('customers').update({ current_balance: c.opening_balance }).eq('id', c.id);
        }
    }
    this.saveToLocalCache();
  }

  async clearAllPurchases() {
    this.purchaseInvoices = [];
    this.cashTransactions = this.cashTransactions.filter(t => t.category !== 'SUPPLIER_PAYMENT');
    if (isSupabaseConfigured) {
        await supabase.from('purchase_invoices').delete().neq('id', '0');
        await supabase.from('cash_transactions').delete().eq('category', 'SUPPLIER_PAYMENT');
    }
    await this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  async clearAllOrders() {
    this.purchaseOrders = [];
    if (isSupabaseConfigured) {
        await supabase.from('purchase_orders').delete().neq('id', '0');
    }
    this.saveToLocalCache();
  }

  async resetCashRegister() {
    this.cashTransactions = [];
    if (isSupabaseConfigured) await supabase.from('cash_transactions').delete().neq('id', '0');
    await this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  async clearWarehouseStock(warehouseId: string) {
    this.batches.forEach(b => {
      if (b.warehouse_id === warehouseId) {
        b.quantity = 0;
      }
    });
    if (isSupabaseConfigured) {
        await this.retryCloudOp(async () => await supabase.from('batches').update({ quantity: 0 }).eq('warehouse_id', warehouseId));
    }
    this.saveToLocalCache();
  }

  getABCAnalysis() {
    const productRevenue: Record<string, { name: string; revenue: number }> = {};
    
    this.invoices.filter(inv => inv.type === 'SALE').forEach(inv => {
      inv.items.forEach(item => {
        const prodId = item.product.id;
        const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
        const total = item.quantity * price * (1 - (item.discount_percentage / 100));
        
        if (!productRevenue[prodId]) {
          productRevenue[prodId] = { name: item.product.name, revenue: 0 };
        }
        productRevenue[prodId].revenue += total;
      });
    });

    const sorted = Object.entries(productRevenue)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);
    let runningRevenue = 0;

    const classifiedProducts = sorted.map(p => {
      runningRevenue += p.revenue;
      const percentage = totalRevenue > 0 ? (runningRevenue / totalRevenue) * 100 : 0;
      let category = 'C';
      if (percentage <= 80) category = 'A';
      else if (percentage <= 95) category = 'B';
      
      return { ...p, category };
    });

    return { classifiedProducts };
  }

  getInventoryValuationReport() {
    return this.products.map(p => {
      const pBatches = this.batches.filter(b => b.product_id === p.id);
      const totalQty = pBatches.reduce((sum, b) => sum + b.quantity, 0);
      
      const totalCostVal = pBatches.reduce((sum, b) => sum + (b.quantity * b.purchase_price), 0);
      const wac = totalQty > 0 ? totalCostVal / totalQty : (p.purchase_price || 0);
      
      const latestBatch = [...pBatches].sort((a, b) => b.id.localeCompare(a.id))[0];
      const latestCost = latestBatch ? latestBatch.purchase_price : (p.purchase_price || 0);
      
      const totalValue = totalQty * wac;
      
      const soldQty = this.invoices
        .filter(inv => inv.type === 'SALE')
        .reduce((sum, inv) => sum + inv.items.filter(it => it.product.id === p.id).reduce((s, it) => s + it.quantity, 0), 0);
      
      const turnoverRate = totalQty > 0 ? (soldQty / totalQty).toFixed(1) : "0.0";

      return {
        id: p.id,
        name: p.name,
        code: p.code || '---',
        totalQty,
        wac,
        latestCost,
        totalValue,
        turnoverRate
      };
    });
  }

  async resetDatabase() { localStorage.removeItem('mizan_db'); window.location.reload(); }

  exportDbData() { return JSON.stringify(this); }
  importDbData(json: string) {
      try {
          const data = JSON.parse(json);
          Object.assign(this, data);
          this.saveToLocalCache();
          return true;
      } catch (e) { return false; }
  }
}

export const db = new Database();
