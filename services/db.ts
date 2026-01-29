
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

  async init() {
    this.loadFromLocalCache();
    if (isSupabaseConfigured) {
        await this.syncFromCloud();
    }
    this.isFullyLoaded = true;
  }

  // المزامنة الفعلية من السحابة - هذا الجزء سيحل مشكلة البيانات القديمة عند الفتح من جهاز آخر
  async syncFromCloud() {
    if (!isSupabaseConfigured) return;
    
    try {
        // جلب كافة الجداول الأساسية بطلب واحد متوازي لسرعة الأداء
        const [
            {data: p}, {data: b}, {data: c}, {data: s}, 
            {data: inv}, {data: pinv}, {data: tx}, {data: wh}
        ] = await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('batches').select('*'),
            supabase.from('customers').select('*'),
            supabase.from('suppliers').select('*'),
            supabase.from('invoices').select('*'),
            supabase.from('purchase_invoices').select('*'),
            supabase.from('cash_transactions').select('*'),
            supabase.from('warehouses').select('*')
        ]);

        if (p) this.products = p;
        if (b) this.batches = b;
        if (c) this.customers = c;
        if (s) this.suppliers = s;
        if (inv) this.invoices = inv;
        if (pinv) this.purchaseInvoices = pinv;
        if (tx) this.cashTransactions = tx;
        if (wh && wh.length > 0) this.warehouses = wh;

        this.saveToLocalCache(); // تحديث الذاكرة المحلية بالبيانات الجديدة من السحابة
        this.isFullyLoaded = true;
    } catch (error) {
        console.error("Cloud Sync Failed:", error);
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

  // Mutations with Cloud Support
  async addProduct(pData: any, bData: any) {
      const p: Product = { ...pData, id: Date.now().toString() };
      const b: Batch = { ...bData, id: `b-${Date.now()}`, product_id: p.id, status: BatchStatus.ACTIVE, batch_number: bData.batch_number || 'INITIAL' };
      
      if (isSupabaseConfigured) {
          await supabase.from('products').insert(p);
          await supabase.from('batches').insert(b);
      }
      
      this.products.push(p);
      this.batches.push(b);
      this.saveToLocalCache();
  }

  // Fix: Added updateProduct to handle metadata changes
  async updateProduct(id: string, data: Partial<Product>) {
    const p = this.products.find(x => x.id === id);
    if (p) {
      Object.assign(p, data);
      if (isSupabaseConfigured) await supabase.from('products').update(data).eq('id', id);
      this.saveToLocalCache();
    }
    return true;
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

  async addCustomer(data: any) {
    const customer: Customer = { 
      ...data, 
      id: Date.now().toString(), 
      current_balance: data.opening_balance || 0 
    };
    if (isSupabaseConfigured) {
        await supabase.from('customers').insert(customer);
    }
    this.customers.push(customer);
    this.saveToLocalCache();
    return customer;
  }

  async deleteCustomer(id: string) {
    if (isSupabaseConfigured) {
        await supabase.from('customers').delete().eq('id', id);
    }
    this.customers = this.customers.filter(c => c.id !== id);
    this.saveToLocalCache();
  }

  async addCashTransaction(data: any) {
      const tx = { ...data, id: Date.now().toString(), date: data.date || new Date().toISOString() };
      if (isSupabaseConfigured) {
          await supabase.from('cash_transactions').insert(tx);
      }
      this.cashTransactions.push(tx);
      await this.recalculateAllBalances();
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

      if (isSupabaseConfigured) {
          // استخدام دالة RPC المعقدة لضمان تنفيذ العملية ككتلة واحدة (Atomic Transaction)
          // هذا يمنع ضياع البيانات في حال انقطاع الإنترنت أثناء المعالجة
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
      return { success: false, message: e.message || 'Error creating invoice' };
    }
  }

  // Fix: Added deleteInvoice to support sales invoice removal
  async deleteInvoice(id: string) {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return;
    inv.items.forEach(item => {
      const batch = this.batches.find(b => b.id === item.batch?.id);
      if (batch) batch.quantity += (inv.type === 'SALE' ? (item.quantity + item.bonus_quantity) : -(item.quantity + item.bonus_quantity));
    });
    if (isSupabaseConfigured) {
        await supabase.from('invoices').delete().eq('id', id);
        await supabase.from('cash_transactions').delete().eq('reference_id', id).eq('category', 'CUSTOMER_PAYMENT');
    }
    this.invoices = this.invoices.filter(i => i.id !== id);
    this.cashTransactions = this.cashTransactions.filter(t => !(t.reference_id === id && t.category === 'CUSTOMER_PAYMENT'));
    await this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  // Fix: Added updateInvoice to allow modifying existing sales records
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
          
          if (isSupabaseConfigured) {
              await supabase.from('cash_transactions').insert(tx);
              await supabase.from('customers').update({ current_balance: cust.current_balance }).eq('id', cust.id);
          }
          
          this.cashTransactions.push(tx);
          await this.recalculateAllBalances();
          return { success: true };
      }
      return { success: false, message: 'Invoice or customer not found' };
  }

  // باقي الدوال تم تعديلها لتشمل المزامنة بنفس النمط
  async updateSettings(s: any) { this.settings = { ...this.settings, ...s }; this.saveToLocalCache(); return true; }
  async updateCustomer(id: string, data: any) {
    const customer = this.customers.find(c => c.id === id);
    if (customer) {
      Object.assign(customer, data);
      if (isSupabaseConfigured) await supabase.from('customers').update(data).eq('id', id);
      await this.recalculateAllBalances();
    }
  }
  async addSupplier(data: any) {
    const supplier: Supplier = { ...data, id: Date.now().toString(), current_balance: data.opening_balance || 0 };
    if (isSupabaseConfigured) await supabase.from('suppliers').insert(supplier);
    this.suppliers.push(supplier);
    this.saveToLocalCache();
    return supplier;
  }
  async updateSupplier(id: string, data: any) {
    const supplier = this.suppliers.find(s => s.id === id);
    if (supplier) {
      Object.assign(supplier, data);
      if (isSupabaseConfigured) await supabase.from('suppliers').update(data).eq('id', id);
      await this.recalculateAllBalances();
    }
  }
  async deleteSupplier(id: string) {
    if (isSupabaseConfigured) await supabase.from('suppliers').delete().eq('id', id);
    this.suppliers = this.suppliers.filter(s => s.id !== id);
    this.saveToLocalCache();
  }
  async addWarehouse(name: string) { 
    const w = { id: `w-${Date.now()}`, name, is_default: false };
    if (isSupabaseConfigured) await supabase.from('warehouses').insert(w);
    this.warehouses.push(w); 
    this.saveToLocalCache(); 
  }

  // Fix: Added updateWarehouse for basic CRUD
  async updateWarehouse(id: string, name: string) {
      const w = this.warehouses.find(x => x.id === id);
      if (w) {
          w.name = name;
          if (isSupabaseConfigured) await supabase.from('warehouses').update({ name }).eq('id', id);
          this.saveToLocalCache();
      }
  }

  // Fix: Added createPurchaseInvoice to handle incoming stock
  async createPurchaseInvoice(supplier_id: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean, docNo?: string, date?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);
      const invoice: PurchaseInvoice = {
        id: Date.now().toString(),
        invoice_number: `PUR-${Date.now().toString().slice(-6)}`,
        document_number: docNo,
        supplier_id,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        total_amount,
        paid_amount: cashPaid,
        type: isReturn ? 'RETURN' : 'PURCHASE',
        items
      };

      if (isSupabaseConfigured) await supabase.from('purchase_invoices').insert(invoice);

      // Fix: Changed forEach to for-of loop to allow using await correctly within the async function.
      for (const item of items) {
        let batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id && b.batch_number === item.batch_number);
        if (batch) {
          batch.quantity += isReturn ? -item.quantity : item.quantity;
          batch.purchase_price = item.cost_price;
          batch.selling_price = item.selling_price;
        } else {
          batch = {
            id: `b-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            product_id: item.product_id,
            warehouse_id: item.warehouse_id,
            batch_number: item.batch_number,
            purchase_price: item.cost_price,
            selling_price: item.selling_price,
            quantity: isReturn ? -item.quantity : item.quantity,
            expiry_date: item.expiry_date,
            status: BatchStatus.ACTIVE
          };
          this.batches.push(batch);
        }
        if (isSupabaseConfigured) await supabase.from('batches').upsert(batch);
      }

      this.purchaseInvoices.push(invoice);
      if (cashPaid > 0) {
        const tx: CashTransaction = {
          id: `tx-${Date.now()}`,
          type: isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE,
          category: 'SUPPLIER_PAYMENT',
          reference_id: invoice.id,
          related_name: this.suppliers.find(s => s.id === supplier_id)?.name || 'مورد',
          amount: cashPaid,
          date: invoice.date,
          notes: `سداد فاتورة مشتريات #${invoice.invoice_number}`,
          ref_number: `PPAY-${Date.now().toString().slice(-4)}`
        };
        if (isSupabaseConfigured) await supabase.from('cash_transactions').insert(tx);
        this.cashTransactions.push(tx);
      }

      await this.recalculateAllBalances();
      this.saveToLocalCache();
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Fix: Added deletePurchaseInvoice to reverse purchase effects
  async deletePurchaseInvoice(id: string) {
    const inv = this.purchaseInvoices.find(i => i.id === id);
    if (!inv) return;
    inv.items.forEach(item => {
      const batch = this.batches.find(b => b.product_id === item.product_id && b.warehouse_id === item.warehouse_id && b.batch_number === item.batch_number);
      if (batch) batch.quantity += (inv.type === 'PURCHASE' ? -item.quantity : item.quantity);
    });
    if (isSupabaseConfigured) {
        await supabase.from('purchase_invoices').delete().eq('id', id);
        await supabase.from('cash_transactions').delete().eq('reference_id', id).eq('category', 'SUPPLIER_PAYMENT');
    }
    this.purchaseInvoices = this.purchaseInvoices.filter(i => i.id !== id);
    this.cashTransactions = this.cashTransactions.filter(t => !(t.reference_id === id && t.category === 'SUPPLIER_PAYMENT'));
    await this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  // Fix: Added representative management methods
  async updateRepresentative(id: string, data: any) {
    const rep = this.representatives.find(r => r.id === id);
    if (rep) {
        Object.assign(rep, data);
        if (isSupabaseConfigured) await supabase.from('representatives').update(data).eq('id', id);
        this.saveToLocalCache();
    }
  }

  async addRepresentative(data: any) {
    const rep: Representative = { ...data, id: Date.now().toString() };
    if (isSupabaseConfigured) await supabase.from('representatives').insert(rep);
    this.representatives.push(rep);
    this.saveToLocalCache();
  }

  async deleteRepresentative(id: string) {
    if (isSupabaseConfigured) await supabase.from('representatives').delete().eq('id', id);
    this.representatives = this.representatives.filter(r => r.id !== id);
    this.saveToLocalCache();
  }

  // Fix: Added stock take and adjustment methods
  async submitStockTake(adjustments: any[]) {
      const pAds = adjustments.map(a => ({
          ...a,
          id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          date: new Date().toISOString(),
          status: 'PENDING'
      }));
      if (isSupabaseConfigured) await supabase.from('pending_adjustments').insert(pAds);
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
              if (isSupabaseConfigured) await supabase.from('batches').update({ quantity: batch.quantity }).eq('id', batch.id);
          }
          adj.status = 'APPROVED';
          if (isSupabaseConfigured) await supabase.from('pending_adjustments').update({ status: 'APPROVED' }).eq('id', id);
          this.saveToLocalCache();
          return true;
      }
      return false;
  }

  async rejectAdjustment(id: string) {
      const adj = this.pendingAdjustments.find(a => a.id === id);
      if (adj) {
          adj.status = 'REJECTED';
          if (isSupabaseConfigured) await supabase.from('pending_adjustments').update({ status: 'REJECTED' }).eq('id', id);
          this.saveToLocalCache();
          return true;
      }
      return false;
  }

  // Fix: Added purchase order management
  async createPurchaseOrder(supplier_id: string, items: any[]) {
      const order: PurchaseOrder = {
          id: Date.now().toString(),
          order_number: `ORD-${Date.now().toString().slice(-6)}`,
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

  async updatePurchaseOrderStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED') {
      const order = this.purchaseOrders.find(o => o.id === id);
      if (order) {
          order.status = status;
          if (isSupabaseConfigured) await supabase.from('purchase_orders').update({ status }).eq('id', id);
          this.saveToLocalCache();
      }
  }

  // Fix: Added daily summary and closing methods
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
      const closing: DailyClosing = { ...data, id: Date.now().toString(), updated_at: new Date().toISOString() };
      if (isSupabaseConfigured) await supabase.from('daily_closings').insert(closing);
      this.dailyClosings.push(closing);
      this.saveToLocalCache();
      return true;
  }

  // Fix: Added sequence generators and categories helpers
  getNextTransactionRef(type: CashTransactionType) {
      return `${type === 'RECEIPT' ? 'REC' : 'EXP'}-${Date.now().toString().slice(-6)}`;
  }

  async addExpenseCategory(cat: string) {
      if (!this.settings.expenseCategories.includes(cat)) {
          this.settings.expenseCategories.push(cat);
          await this.updateSettings(this.settings);
      }
  }

  // Fix: Added danger zone data clearing methods
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
    if (isSupabaseConfigured) await supabase.from('purchase_orders').delete().neq('id', '0');
    this.saveToLocalCache();
  }

  async resetCashRegister() {
    this.cashTransactions = [];
    if (isSupabaseConfigured) await supabase.from('cash_transactions').delete().neq('id', '0');
    await this.recalculateAllBalances();
    this.saveToLocalCache();
  }

  async clearWarehouseStock(whId: string) {
    this.batches.forEach(b => { if (b.warehouse_id === whId) b.quantity = 0; });
    if (isSupabaseConfigured) await supabase.from('batches').update({ quantity: 0 }).eq('warehouse_id', whId);
    this.saveToLocalCache();
  }

  // Fix: Added inventory analysis reports
  getABCAnalysis() {
    const productRevenues: Record<string, number> = {};
    this.invoices.filter(i => i.type === 'SALE').forEach(inv => {
      inv.items.forEach(item => {
        const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
        const rev = item.quantity * price * (1 - item.discount_percentage/100);
        productRevenues[item.product.id] = (productRevenues[item.product.id] || 0) + rev;
      });
    });
    
    const sorted = Object.entries(productRevenues).map(([id, revenue]) => {
      const p = this.products.find(x => x.id === id);
      return { id, name: p?.name || 'Unknown', revenue };
    }).sort((a,b) => b.revenue - a.revenue);
    
    const totalRev = sorted.reduce((s, x) => s + x.revenue, 0);
    let runningTotal = 0;
    const classifiedProducts = sorted.map(p => {
      runningTotal += p.revenue;
      const pct = (runningTotal / totalRev) * 100;
      let category = 'C';
      if (pct <= 80) category = 'A';
      else if (pct <= 95) category = 'B';
      return { ...p, category };
    });
    return { classifiedProducts };
  }

  getInventoryValuationReport() {
    return this.products.map(p => {
      const pBatches = this.batches.filter(b => b.product_id === p.id);
      const totalQty = pBatches.reduce((s, b) => s + b.quantity, 0);
      const latestBatch = [...pBatches].sort((a,b) => b.id.localeCompare(a.id))[0];
      const latestCost = latestBatch?.purchase_price || p.purchase_price || 0;
      const wac = pBatches.length > 0 ? (pBatches.reduce((sum, b) => sum + (b.quantity * b.purchase_price), 0) / Math.max(1, totalQty)) : latestCost;
      
      // Calculate turnover (Sales in last 30 days / Avg Inventory)
      const now = new Date();
      const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30)).toISOString();
      const salesQty = this.invoices.filter(i => i.date >= thirtyDaysAgo && i.type === 'SALE').reduce((sum, inv) => {
          const item = inv.items.find(it => it.product.id === p.id);
          return sum + (item ? item.quantity : 0);
      }, 0);

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        totalQty,
        wac,
        latestCost,
        totalValue: totalQty * wac,
        turnoverRate: (salesQty / Math.max(1, totalQty)).toFixed(2)
      };
    }).sort((a,b) => b.totalValue - a.totalValue);
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
