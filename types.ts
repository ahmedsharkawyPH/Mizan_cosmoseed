
// Domain Model (STRICT - ENTERPRISE READY)

export enum BatchStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DEPLETED = 'DEPLETED',
}

export type Role = 'ADMIN' | 'TELESALES' | 'REP';

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  version: number; // For Optimistic Locking
}

export interface User extends BaseEntity {
  username: string;
  name: string;
  role: Role;
  avatar?: string;
  permissions?: string[]; 
}

export interface Warehouse extends BaseEntity {
  name: string;
  is_default: boolean;
}

export interface Product extends BaseEntity {
  code?: string; 
  name: string;
  package_type?: string; 
  items_per_package?: number;
  selling_price?: number; 
  purchase_price?: number; 
}

export interface Batch extends BaseEntity {
  product_id: string;
  warehouse_id: string; 
  batch_number: string;
  selling_price: number;
  purchase_price: number;
  quantity: number;
  expiry_date: string; 
  status: BatchStatus;
}

export interface Representative extends BaseEntity {
  code: string; 
  name: string;
  phone: string;
  supervisor_id?: string; 
  distribution_line?: string; 
  commission_rate?: number; 
  commission_target?: number; 
}

export interface Customer extends BaseEntity {
  code: string;
  name: string;
  phone: string;
  area: string;
  address: string;
  distribution_line?: string; 
  opening_balance: number;
  current_balance: number;
  credit_limit?: number; 
  representative_code?: string; 
  default_discount_percent?: number; 
}

export interface Supplier extends BaseEntity {
  code: string;
  name: string;
  phone: string;
  contact_person: string;
  address: string;
  opening_balance: number;
  current_balance: number;
}

export enum PaymentStatus {
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  UNPAID = 'UNPAID',
}

export interface Invoice extends BaseEntity {
  invoice_number: string;
  customer_id: string;
  created_by?: string; 
  created_by_name?: string; 
  date: string;
  total_before_discount: number;
  total_discount: number; 
  additional_discount?: number; 
  commission_value?: number;
  net_total: number;
  previous_balance: number;
  final_balance: number;
  payment_status: PaymentStatus;
  items: CartItem[]; 
  type: 'SALE' | 'RETURN'; 
  status: 'ACTIVE' | 'CANCELLED'; 
}

export interface PurchaseInvoice extends BaseEntity {
  invoice_number: string;
  document_number?: string; 
  supplier_id: string;
  date: string;
  total_amount: number;
  paid_amount: number;
  type: 'PURCHASE' | 'RETURN';
  items: PurchaseItem[];
  status: 'ACTIVE' | 'CANCELLED'; // Added in V4
}

export interface PurchaseItem {
  serial_number?: number; 
  product_id: string;
  warehouse_id: string; 
  batch_number: string; 
  quantity: number;
  bonus_quantity: number; 
  cost_price: number;
  selling_price: number;
  expiry_date: string;
}

export interface PurchaseOrder extends BaseEntity {
  order_number: string;
  supplier_id: string;
  date: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  items: {
      product_id: string;
      quantity: number;
      cost_price: number; 
      selling_price?: number;
      last_cost?: number; 
      current_stock?: number;
      monthly_avg?: number;
  }[];
}

export enum CashTransactionType {
  RECEIPT = 'RECEIPT',
  EXPENSE = 'EXPENSE',
}

export interface CashTransaction extends BaseEntity {
  ref_number?: string; 
  type: CashTransactionType;
  category: string;
  reference_id?: string; 
  related_name?: string; 
  amount: number;
  date: string;
  notes: string;
  status?: 'ACTIVE' | 'CANCELLED';
}

export interface PendingAdjustment extends BaseEntity {
  product_id: string;
  warehouse_id: string;
  system_qty: number;
  actual_qty: number;
  diff: number;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_by?: string;
}

export interface DailyClosing extends BaseEntity {
  date: string;
  total_sales: number;
  total_expenses: number;
  cash_balance: number;
  bank_balance: number;
  inventory_value: number;
  notes?: string;
  closed_by?: string;
}

export interface ProductWithBatches extends Product {
  batches: Batch[];
}

export interface CartItem {
  product: Product;
  batch?: Batch; 
  quantity: number;
  bonus_quantity: number;
  discount_percentage: number;
  unit_price?: number; 
}
