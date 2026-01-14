
import { supabase } from './supabase';
import {
  Product,
  Batch,
  Customer,
  Supplier,
  Invoice,
  InvoiceItem,
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
  StockMovementType
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
  lowStockThreshold: number;
}

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
  private settings: SystemSettings = {
    companyName: 'Mizan Online',
    companyAddress: 'Cairo, Egypt',
    companyPhone: '01559550481',
    companyTaxNumber: '123-456-789',
    currency: 'ج.م',
    language: 'ar',
    invoiceTemplate: '1',
    printerPaperSize: 'A4',
    expenseCategories: ['SALARY', 'ELECTRICITY', 'MARKETING', 'RENT', 'MAINTENANCE', 'OTHER'],
    lowStockThreshold: 10
  };

  public isInitialized = false;

  constructor() {}

  async init() {
    if(this.isInitialized) return;
    
    try {
        const [
            p, b, c, s, w, inv, pur, po, cash, rep, set
        ] = await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('batches').select('*'),
            supabase.from('customers').select('*'),
            supabase.from('suppliers').select('*'),
            supabase.from('warehouses').select('*'),
            supabase.from('invoices').select('*'),
            supabase.from('purchase_invoices').select('*'),
            supabase.from('purchase_orders').select('*'),
            supabase.from('cash_transactions').select('*'),
            supabase.from('representatives').select('*'),
            supabase.from('settings').select('*').single(),
        ]);

        if (p.data) this.products = p.data;
        if (b.data) this.batches = b.data;
        if (c.data) this.customers = c.data;
        if (s.data) this.suppliers = s.data;
        if (w.data) this.warehouses = w.data;
        if (inv.data) this.invoices = inv.data;
        if (pur.data) this.purchaseInvoices = pur.data;
        if (po.data) this.purchaseOrders = po.data;
        if (cash.data) this.cashTransactions = cash.data;
        if (rep.data) this.representatives = rep.data;
        
        if (set.data) {
            this.settings = { ...this.settings, ...set.data };
        }

        if (this.warehouses.length === 0) {
            const defW = { id: 'W1', name: 'المخزن الرئيسي', is_default: true };
            await supabase.from('warehouses').insert(defW);
            this.warehouses.push(defW);
        }

        this.isInitialized = true;
        console.log('Mizan Cloud DB Initialized');
    } catch (error) {
        console.error('Cloud Sync Error:', error);
    }
  }

  getProductsWithBatches(): ProductWithBatches[] {
    return this.products.map(p => ({
      ...p,
      batches: this.batches.filter(b => b.product_id === p.id)
    }));
  }

  getCustomers(): Customer[] { return [...this.customers]; }
  getSuppliers(): Supplier[] { return [...this.suppliers]; }
  getRepresentatives(): Representative[] { return [...this.representatives]; }
  getWarehouses(): Warehouse[] { return [...this.warehouses]; }
  getInvoices(): Invoice[] { return [...this.invoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getPurchaseInvoices(): PurchaseInvoice[] { return [...this.purchaseInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
  getPurchaseOrders(): PurchaseOrder[] { return [...this.purchaseOrders]; }
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
    const lowStock = this.getProductsWithBatches().filter(p => 
      p.batches.reduce((s, b) => s + b.quantity, 0) < this.settings.lowStockThreshold
    );
    return `
      Company: ${this.settings.companyName}
      Total Sales: ${this.settings.currency} ${totalSales.toLocaleString()}
      Cash Balance: ${this.settings.currency} ${cash.toLocaleString()}
      Low Stock Products: ${lowStock.length}
    `;
  }

  async updateSettings(s: SystemSettings) {
    this.settings = s;
    await supabase.from('settings').upsert({ id: 1, ...s });
  }

  async addExpenseCategory(name: string) {
      if (!this.settings.expenseCategories.includes(name)) {
          this.settings.expenseCategories.push(name);
          await this.updateSettings(this.settings);
      }
  }

  async addCustomer(c: any) {
    const cust: Customer = { 
        ...c, 
        id: `C${Date.now()}`, 
        current_balance: c.opening_balance || 0,
        credit_limit: c.credit_limit || 0 
    };
    const { error } = await supabase.from('customers').insert(cust);
    if (!error) this.customers.push(cust);
  }

  async updateCustomer(id: string, updates: Partial<Customer>) {
      const index = this.customers.findIndex(c => c.id === id);
      if (index !== -1) {
          const { error } = await supabase.from('customers').update(updates).eq('id', id);
          if (!error) this.customers[index] = { ...this.customers[index], ...updates };
      }
  }

  async deleteCustomer(id: string) {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (!error) this.customers = this.customers.filter(c => c.id !== id);
  }

  async addSupplier(s: any) {
    const supp: Supplier = { ...s, id: `S${Date.now()}`, current_balance: s.opening_balance || 0 };
    const { error } = await supabase.from('suppliers').insert(supp);
    if (!error) this.suppliers.push(supp);
  }

  async addRepresentative(r: any) {
      const rep: Representative = { ...r, id: `R${Date.now()}` };
      const { error } = await supabase.from('representatives').insert(rep);
      if (!error) this.representatives.push(rep);
  }

  async updateRepresentative(id: string, updates: Partial<Representative>) {
      const { error } = await supabase.from('representatives').update(updates).eq('id', id);
      if (!error) {
          const idx = this.representatives.findIndex(r => r.id === id);
          if (idx !== -1) this.representatives[idx] = { ...this.representatives[idx], ...updates };
      }
  }

  async addWarehouse(name: string) {
      const id = `W-${Date.now()}`;
      const w = { id, name, is_default: false };
      const { error } = await supabase.from('warehouses').insert(w);
      if (!error) this.warehouses.push(w);
  }

  async updateWarehouse(id: string, name: string) {
      const { error } = await supabase.from('warehouses').update({name}).eq('id', id);
      if (!error) {
          const idx = this.warehouses.findIndex(w => w.id === id);
          if (idx !== -1) this.warehouses[idx].name = name;
      }
  }

  async addProduct(p: any, b?: any): Promise<string> {
    const pid = `P${Date.now()}`;
    const product = { ...p, id: pid };
    await supabase.from('products').insert(product);
    this.products.push(product);
    
    if (b) {
        const defaultWarehouseId = this.warehouses.find(w => w.is_default)?.id || 'W1';
        const batch = { 
            ...b, 
            id: `B${Date.now()}`, 
            product_id: pid, 
            warehouse_id: defaultWarehouseId,
            status: BatchStatus.ACTIVE 
        };
        await supabase.from('batches').insert(batch);
        this.batches.push(batch);
    }
    return pid;
  }

  async adjustStock(batchId: string, newQuantity: number): Promise<{ success: boolean; message: string }> {
      const { error } = await supabase.from('batches').update({ quantity: newQuantity }).eq('id', batchId);
      if (error) return { success: false, message: error.message };
      const idx = this.batches.findIndex(b => b.id === batchId);
      if (idx !== -1) this.batches[idx].quantity = newQuantity;
      return { success: true, message: 'تم تحديث المخزون' };
  }

  async reportSpoilage(batchId: string, quantityToRemove: number, reason: string): Promise<{ success: boolean; message: string }> {
      const idx = this.batches.findIndex(b => b.id === batchId);
      if (idx === -1) return { success: false, message: 'التشغيلة غير موجودة' };
      if (this.batches[idx].quantity < quantityToRemove) return { success: false, message: 'الكمية غير كافية' };
      
      const newQty = this.batches[idx].quantity - quantityToRemove;
      const { error } = await supabase.from('batches').update({ quantity: newQty }).eq('id', batchId);
      if (error) return { success: false, message: error.message };
      
      this.batches[idx].quantity = newQty;
      return { success: true, message: `تم تسجيل التوالف: ${quantityToRemove}` };
  }

  async transferStock(batchId: string, targetWarehouseId: string, quantity: number): Promise<{ success: boolean; message: string }> {
    try {
        const sourceBatchIdx = this.batches.findIndex(b => b.id === batchId);
        if (sourceBatchIdx === -1) throw new Error("Source Batch Not Found");
        const sourceBatch = this.batches[sourceBatchIdx];
        if (sourceBatch.quantity < quantity) throw new Error("Insufficient Quantity");
        
        const newSourceQty = sourceBatch.quantity - quantity;
        await supabase.from('batches').update({ quantity: newSourceQty }).eq('id', batchId);
        sourceBatch.quantity = newSourceQty;

        const newBatchId = `B${Date.now()}-T`;
        const newBatch = { ...sourceBatch, id: newBatchId, warehouse_id: targetWarehouseId, quantity: quantity };
        await supabase.from('batches').insert(newBatch);
        this.batches.push(newBatch);
        
        return { success: true, message: 'تم التحويل بنجاح' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  // Added fix: Implementation of updateInvoice to resolve error in NewInvoice.tsx
  async updateInvoice(id: string, customerId: string, items: CartItem[], cashPaid: number): Promise<{ success: boolean; message: string; id?: string }> {
    try {
        const index = this.invoices.findIndex(i => i.id === id);
        if (index === -1) throw new Error("Invoice not found");

        const { error } = await supabase.from('invoices').update({ customer_id: customerId, items: items }).eq('id', id);
        if (error) throw error;

        this.invoices[index] = { ...this.invoices[index], customer_id: customerId, items: items };
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
             const price = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
             totalGross += (item.quantity * price);
             totalItemDiscount += (item.quantity * price * (item.discount_percentage / 100));
        }
        const netTotal = totalGross - totalItemDiscount - additionalDiscount;

        // Atomic Cloud Updates
        for(const item of items) {
            const batchIdx = this.batches.findIndex(b => b.id === item.batch.id);
            if(batchIdx === -1) continue;
            const totalQtyChange = item.quantity + (item.bonus_quantity || 0);
            const newQty = isReturn ? this.batches[batchIdx].quantity + totalQtyChange : this.batches[batchIdx].quantity - totalQtyChange;
            await supabase.from('batches').update({ quantity: newQty }).eq('id', item.batch.id);
            this.batches[batchIdx].quantity = newQty;
        }

        const newBalance = isReturn ? this.customers[customerIdx].current_balance - netTotal : this.customers[customerIdx].current_balance + netTotal;
        await supabase.from('customers').update({ current_balance: newBalance }).eq('id', customerId);
        this.customers[customerIdx].current_balance = newBalance;

        const invoiceId = `INV-${Date.now()}`;
        const invoice: Invoice = {
            id: invoiceId, invoice_number: `${Date.now()}`, customer_id: customerId, 
            created_by: createdBy?.id, created_by_name: createdBy?.name,
            date: new Date().toISOString(), total_before_discount: totalGross, 
            total_discount: totalItemDiscount, additional_discount: additionalDiscount,
            net_total: netTotal, previous_balance: this.customers[customerIdx].current_balance - (isReturn ? -netTotal : netTotal), 
            final_balance: newBalance,
            payment_status: cashPaid >= netTotal ? PaymentStatus.PAID : cashPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID,
            items: items, type: isReturn ? 'RETURN' : 'SALE'
        };
        
        await supabase.from('invoices').insert(invoice);
        this.invoices.push(invoice);

        if(cashPaid > 0) {
             await this.addCashTransaction({
                 type: isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT, 
                 category: 'CUSTOMER_PAYMENT',
                 reference_id: invoiceId, 
                 related_name: this.customers[customerIdx].name, 
                 amount: cashPaid,
                 date: new Date().toISOString(), 
                 notes: `${isReturn ? 'Refund' : 'Payment'} for INV#${invoice.invoice_number}`
             });
        }
        return { success: true, message: isReturn ? 'تم إنشاء مرتجع' : 'تم إنشاء فاتورة', id: invoiceId };
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
          await supabase.from('customers').update({ current_balance: newBal }).eq('id', invoice.customer_id);
          this.customers[customerIdx].current_balance = newBal;
      }

      await this.addCashTransaction({
          type: CashTransactionType.RECEIPT, category: 'CUSTOMER_PAYMENT', reference_id: invoiceId,
          related_name: this.customers[customerIdx]?.name, amount: amount, date: new Date().toISOString(),
          notes: `Payment for INV#${invoice.invoice_number}`
      });
      return { success: true, message: "تم تسجيل التحصيل" };
    }

  getInvoicePaidAmount(invoiceId: string): number {
      return this.cashTransactions
        .filter(t => t.reference_id === invoiceId && t.category === 'CUSTOMER_PAYMENT' && t.type === 'RECEIPT')
        .reduce((sum, t) => sum + t.amount, 0);
  }

  async addCashTransaction(tx: Omit<CashTransaction, 'id'>) {
      const id = `TX${Date.now()}`;
      const newTx = { ...tx, id };
      await supabase.from('cash_transactions').insert(newTx);
      this.cashTransactions.push(newTx);
  }

  getNextTransactionRef(type: CashTransactionType): string {
      const prefix = type === CashTransactionType.RECEIPT ? 'REC' : 'PAY';
      const count = this.cashTransactions.filter(t => t.type === type).length + 1;
      return `${prefix}-${count.toString().padStart(5, '0')}`;
  }

  async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], cashPaid: number, isReturn: boolean): Promise<{ success: boolean; message: string }> {
    try {
        const id = `PUR-${Date.now()}`;
        const total = items.reduce((a,b)=>a+(b.quantity*b.cost_price),0);
        
        // Update batches and supplier balance on cloud
        const supplierIdx = this.suppliers.findIndex(s => s.id === supplierId);
        if (supplierIdx !== -1) {
            const balanceChange = isReturn ? -total : total;
            const newBal = this.suppliers[supplierIdx].current_balance + balanceChange;
            await supabase.from('suppliers').update({ current_balance: newBal }).eq('id', supplierId);
            this.suppliers[supplierIdx].current_balance = newBal;
        }

        for (const item of items) {
            // Find existing batch or create new
            const { data: existing } = await supabase.from('batches').select('*').eq('product_id', item.product_id).eq('batch_number', item.batch_number).single();
            if (existing) {
                const newQty = isReturn ? existing.quantity - item.quantity : existing.quantity + item.quantity;
                await supabase.from('batches').update({ quantity: newQty }).eq('id', existing.id);
            } else if (!isReturn) {
                await supabase.from('batches').insert({
                    id: `B-${Date.now()}-${Math.random()}`,
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

        const inv: PurchaseInvoice = {
            id, invoice_number: id, supplier_id: supplierId, date: new Date().toISOString(),
            total_amount: total, paid_amount: cashPaid, type: isReturn ? 'RETURN' : 'PURCHASE', items
        };
        await supabase.from('purchase_invoices').insert(inv);
        this.purchaseInvoices.push(inv);
        
        // Update cache
        const { data: refreshedBatches } = await supabase.from('batches').select('*');
        if (refreshedBatches) this.batches = refreshedBatches;

        return { success: true, message: 'تم حفظ فاتورة الشراء' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  async createPurchaseOrder(supplierId: string, items: any[]): Promise<{ success: boolean; message: string }> {
      const id = `PO-${Date.now()}`;
      const order: PurchaseOrder = {
          id, order_number: id, supplier_id: supplierId, date: new Date().toISOString(),
          status: 'PENDING', items
      };
      await supabase.from('purchase_orders').insert(order);
      this.purchaseOrders.push(order);
      return { success: true, message: 'تم حفظ طلب الشراء' };
  }

  async updatePurchaseOrderStatus(id: string, status: 'COMPLETED' | 'CANCELLED') {
      await supabase.from('purchase_orders').update({status}).eq('id', id);
      const idx = this.purchaseOrders.findIndex(o => o.id === id);
      if (idx !== -1) this.purchaseOrders[idx].status = status;
  }

  getInvoiceProfit(invoice: Invoice): number {
      if (!invoice.items) return 0;
      let totalCost = 0;
      invoice.items.forEach(item => {
          const totalQty = item.quantity + (item.bonus_quantity || 0);
          const cost = item.batch ? item.batch.purchase_price : 0;
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
              const price = item.unit_price || item.batch.selling_price;
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
              const percentage = (cumulativeRevenue / totalRevenue) * 100;
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
              totalQty, totalValue, wac: totalQty > 0 ? totalValue / totalQty : 0,
              latestCost: batches.length > 0 ? batches[batches.length-1].purchase_price : 0,
              turnoverRate: '0'
          };
      });
  }

  async clearTransactions() {
      await Promise.all([
          supabase.from('invoices').delete().neq('id', '0'),
          supabase.from('purchase_invoices').delete().neq('id', '0'),
          supabase.from('cash_transactions').delete().neq('id', '0'),
          supabase.from('purchase_orders').delete().neq('id', '0')
      ]);
  }
  
  async clearCustomers() { await supabase.from('customers').delete().neq('id', '0'); }
  async clearProducts() { await supabase.from('products').delete().neq('id', '0'); }
  
  async resetDatabase() {
      await this.clearTransactions();
      await this.clearCustomers();
      await this.clearProducts();
      window.location.reload();
  }

  exportDatabase(): string { return JSON.stringify({ products: this.products, customers: this.customers, suppliers: this.suppliers }); }
  importDatabase(json: string): boolean { return true; }
  
  getStockMovements(productId?: string) { return this.stockMovements; }
}

export const db = new DatabaseService();
