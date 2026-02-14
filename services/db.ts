
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing, ProductWithBatches, CartItem, BatchStatus,
  PaymentStatus, CashTransactionType, PurchaseItem
} from '../types';

const DB_VERSION = 4.3; 

class Database {
  products: Product[] = [];
  batches: Batch[] = [];
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
  invoices: Invoice[] = [];
  purchaseInvoices: PurchaseInvoice[] = [];
  cashTransactions: CashTransaction[] = [];
  warehouses: Warehouse[] = [];
  representatives: Representative[] = [];
  dailyClosings: DailyClosing[] = [];
  pendingAdjustments: PendingAdjustment[] = [];
  settings: any = { companyName: 'Mizan Online', currency: 'LE', expenseCategories: [], lowStockThreshold: 10 };

  isFullyLoaded: boolean = false;
  public activeOperations: number = 0;
  private syncListeners: ((isBusy: boolean) => void)[] = [];
  private saveTimeout: any = null;

  constructor() {
    this.loadFromLocalCache();
  }

  onSyncStateChange(callback: (isBusy: boolean) => void) {
    this.syncListeners.push(callback);
    return () => { this.syncListeners = this.syncListeners.filter(l => l !== callback); };
  }

  private notifySyncState() {
    this.syncListeners.forEach(l => l(this.activeOperations > 0));
  }

  async init() {
    // سيتم استدعاء منطق التحميل من DataContext
    this.isFullyLoaded = true;
  }

  // --- دوال الجلب الضخمة (Big Data Handlers) ---

  async fetchAllFromTable(table: string) {
    if (!isSupabaseConfigured) return [];
    try {
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .range(from, to)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += 1000;
                to += 1000;
                // توقف إذا كان عدد البيانات أقل من 1000 (آخر صفحة)
                if (data.length < 1000) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        return allData;
    } catch (err) {
        console.error(`Error fetching table ${table}:`, err);
        return [];
    }
  }

  async fetchLatestPricesMap() {
    if (!isSupabaseConfigured) return new Map();
    try {
        const { data, error } = await supabase.rpc('get_latest_batch_prices');
        
        // معالجة خطأ عدم وجود الدالة (PGRST202)
        if (error) {
            if (error.code === 'PGRST202') {
                console.warn("RPC function 'get_latest_batch_prices' missing in Supabase. Falling back to baseline prices.");
                return new Map();
            }
            throw error;
        }

        const priceMap = new Map();
        if (data) {
            data.forEach((item: any) => {
                priceMap.set(item.product_id, {
                    purchase: item.latest_purchase_price,
                    selling: item.latest_selling_price
                });
            });
        }
        return priceMap;
    } catch (err) {
        console.error("Critical error in fetchLatestPricesMap:", err);
        return new Map();
    }
  }

  // --- إدارة الكاش المحلي ---

  loadFromLocalCache() {
    const raw = localStorage.getItem('mizan_db');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.products = data.products || [];
        this.batches = data.batches || [];
        this.customers = data.customers || [];
        this.invoices = data.invoices || [];
        this.suppliers = data.suppliers || [];
        this.cashTransactions = data.cashTransactions || [];
        this.warehouses = data.warehouses || [];
        this.settings = { ...this.settings, ...(data.settings || {}) };
      } catch (e) { console.error("Cache load failed", e); }
    }
  }

  saveToLocalCache(force: boolean = false) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    const perform = () => {
      const pkg = {
        dbVersion: DB_VERSION,
        products: this.products, batches: this.batches, customers: this.customers,
        invoices: this.invoices, suppliers: this.suppliers, cashTransactions: this.cashTransactions,
        warehouses: this.warehouses, settings: this.settings
      };
      localStorage.setItem('mizan_db', JSON.stringify(pkg));
    };
    if (force) perform(); else this.saveTimeout = setTimeout(perform, 300);
  }

  // --- Getters ---

  getSettings() { return this.settings; }
  getInvoices() { return this.invoices.filter(i => i.status !== 'DELETED'); }
  getCustomers() { return this.customers.filter(c => c.status !== 'INACTIVE'); }
  getSuppliers() { return this.suppliers.filter(s => s.status !== 'INACTIVE'); }
  getWarehouses() { return this.warehouses; }
  getPurchaseInvoices() { return this.purchaseInvoices.filter(p => p.status !== 'CANCELLED'); }
  getCashTransactions() { return this.cashTransactions; }
  
  getProductsWithBatches(): ProductWithBatches[] {
      return this.products
          .filter(p => p.status !== 'INACTIVE')
          .map(p => ({
              ...p,
              batches: this.batches.filter(b => b.product_id === p.id)
          }));
  }

  getCashBalance() {
    return this.cashTransactions
      .filter(t => t.status !== 'CANCELLED' && t.status !== 'DELETED')
      .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
  }

  getInvoicePaidAmount(invoiceId: string): number {
    return this.cashTransactions
      .filter(t => t.reference_id === invoiceId && t.status !== 'CANCELLED')
      .reduce((s, t) => s + (t.type === 'RECEIPT' ? t.amount : -t.amount), 0);
  }

  async updateSettings(newSettings: any): Promise<boolean> {
    this.settings = { ...this.settings, ...newSettings };
    if (isSupabaseConfigured) await supabase.from('settings').upsert({ id: 1, ...this.settings });
    this.saveToLocalCache();
    return true;
  }

  async resetDatabase() {
    localStorage.removeItem('mizan_db');
    window.location.reload();
  }

  exportDbData() { return JSON.stringify(this); }
}

export const db = new Database();
