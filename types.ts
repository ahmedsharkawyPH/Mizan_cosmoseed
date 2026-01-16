
// Domain Model (STRICT)

export enum BatchStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DEPLETED = 'DEPLETED',
}

export type Role = 'ADMIN' | 'TELESALES' | 'REP';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  avatar?: string;
  permissions?: string[]; 
}

export interface Warehouse {
  id: string;
  name: string;
  is_default: boolean;
}

export interface Product {
  id: string;
  code?: string; // التعديل: جعل الكود اختيارياً
  name: string;
  package_type?: string; 
  items_per_package?: number;
  selling_price?: number; 
  purchase_price?: number; 
}

export interface Batch {
  id: string;
  product_id: string;
  warehouse_id: string; 
  batch_number: string;
  selling_price: number;
  purchase_price: number;
  quantity: number;
  expiry_date: string; 
  status: BatchStatus;
}

export interface Representative {
  id: string;
  code: string; 
  name: string;
  phone: string;
  supervisor_id?: string; 
  distribution_line?: string; 
  commission_rate?: number; 
  commission_target?: number; 
}

export interface Customer {
  id: string;
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

export interface Supplier {
  id: string;
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

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  created_by?: string; 
  created_by_name?: string; 
  date: string;
  total_before_discount: number;
  total_discount: number; 
  additional_discount?: number; 
  net_total: number;
  previous_balance: number;
  final_balance: number;
  payment_status: PaymentStatus;
  items: CartItem[]; 
  type: 'SALE' | 'RETURN'; 
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  date: string;
  total_amount: number;
  paid_amount: number;
  type: 'PURCHASE' | 'RETURN';
  items: PurchaseItem[];
}

export interface PurchaseItem {
  product_id: string;
  warehouse_id: string; 
  batch_number: string; 
  quantity: number;
  cost_price: number;
  selling_price: number;
  expiry_date: string;
}

export interface PurchaseOrder {
  id: string;
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

export type CashCategory = string;

export interface CashTransaction {
  id: string;
  ref_number?: string; 
  type: CashTransactionType;
  category: CashCategory;
  reference_id?: string; 
  related_name?: string; 
  amount: number;
  date: string;
  notes: string;
}

export type StockMovementType = 'SALE' | 'PURCHASE' | 'RETURN_IN' | 'RETURN_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'SPOILAGE' | 'INITIAL';

export interface StockMovement {
    id: string;
    date: string;
    type: StockMovementType;
    product_id: string;
    batch_number: string;
    warehouse_id: string;
    quantity: number; 
    reference_id?: string; 
    notes?: string;
}

// Accounting Types
export interface JournalEntry {
    id: string;
    date: string;
    description: string;
    reference: string;
    debit: number;
    credit: number;
    account: string;
}

// Helper types for UI
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
