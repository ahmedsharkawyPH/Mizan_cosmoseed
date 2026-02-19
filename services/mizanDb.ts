import Dexie, { Table } from 'dexie';
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing 
} from '../types';

export interface OutboxItem {
  id?: number;
  entityType: string;
  operation: 'insert' | 'update' | 'delete';
  payload: any;
  createdAt: string;
}

export class MizanDb extends Dexie {
  products!: Table<Product, string>;
  batches!: Table<Batch, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  invoices!: Table<Invoice, string>;
  purchaseInvoices!: Table<PurchaseInvoice, string>;
  cashTransactions!: Table<CashTransaction, string>;
  warehouses!: Table<Warehouse, string>;
  representatives!: Table<Representative, string>;
  dailyClosings!: Table<DailyClosing, string>;
  pendingAdjustments!: Table<PendingAdjustment, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  settings!: Table<{ id: string; value: any }, string>;
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super('mizan_db_dexie');
    this.version(1).stores({
      products: 'id, code, name, status',
      batches: 'id, product_id, warehouse_id, batch_number, batch_status',
      customers: 'id, code, name, phone, representative_code, status',
      suppliers: 'id, code, name, phone, status',
      invoices: 'id, invoice_number, customer_id, date, payment_status, type',
      purchaseInvoices: 'id, invoice_number, supplier_id, date, type',
      cashTransactions: 'id, date, type, category, reference_id',
      warehouses: 'id, name, is_default',
      representatives: 'id, code, name, phone',
      dailyClosings: 'id, date',
      pendingAdjustments: 'id, product_id, warehouse_id, adj_status, date',
      purchaseOrders: 'id, supplier_id, date, order_status',
      settings: 'id',
      outbox: '++id, createdAt, entityType'
    });
  }
}

export const mizanDb = new MizanDb();
