
import { 
  Warehouse, Product, Batch, Representative, Customer, Supplier, 
  Invoice, PurchaseInvoice, PurchaseOrder, CashTransaction, 
  PendingAdjustment, DailyClosing 
} from '../types';

export type OutboxStatus = 'pending' | 'in_progress' | 'failed' | 'permanently_failed' | 'sent';
export type OutboxOperation = 'insert' | 'update' | 'delete';

export interface OutboxItem {
  id?: number;
  entityType: string;
  entityId: string;
  operation: OutboxOperation;
  payload: any;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string | null;
  status: OutboxStatus;
  idempotencyKey?: string;
  payloadHash?: string;
}

export interface SyncError {
  id?: number;
  entityType: string;
  operation: string;
  payloadId: string;
  error: string;
  stack?: string;
  timestamp: string;
  metadata?: any;
}

export interface LocalSnapshot {
  products: Product[];
  batches: Batch[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  purchaseInvoices: PurchaseInvoice[];
  cashTransactions: CashTransaction[];
  warehouses: Warehouse[];
  representatives: Representative[];
  dailyClosings: DailyClosing[];
  pendingAdjustments: PendingAdjustment[];
  purchaseOrders: PurchaseOrder[];
  settings: any;
  outbox: OutboxItem[];
}

export const TABLES_TO_SYNC = [
  'products', 'batches', 'customers', 'suppliers', 'invoices',
  'purchaseInvoices', 'cashTransactions', 'warehouses', 'representatives',
  'dailyClosings', 'pendingAdjustments', 'purchaseOrders'
] as const;

export type SyncTableName = typeof TABLES_TO_SYNC[number];
