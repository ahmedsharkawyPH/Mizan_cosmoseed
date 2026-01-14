
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
  permissions?: string[]; // List of enabled permission IDs
}

export interface Warehouse {
  id: string;
  name: string;
  is_default: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  package_type?: string; // NEW: e.g., "Carton", "Bale", "Box"
  items_per_package?: number; // NEW: e.g., 12, 20, 6
}

export interface Batch {
  id: string;
  product_id: string;
  warehouse_id: string; // Link to Warehouse
  batch_number: string;
  selling_price: number;
  purchase_price: number;
  quantity: number;
  expiry_date: string; // ISO Date string
  status: BatchStatus;
}

export interface Representative {
  id: string;
  code: string; // Primary Link
  name: string;
  phone: string;
  supervisor_id?: string; // Link to User (Supervisor) - DEPRECATED in new structure but kept for type safety
  distribution_line?: string; // NEW: The specific route/line
  commission_rate?: number; // Commission Percentage (e.g., 1 for 1%)
  commission_target?: number; // Target Sales Amount to trigger commission
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  area: string;
  address: string;
  distribution_line?: string; // NEW: Distribution Line / Route
  opening_balance: number;
  current_balance: number;
  credit_limit?: number; // Added: Max debt allowed
  representative_code?: string; // Link to Representative Code
  default_discount_percent?: number; // NEW: Customer specific discount %
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
  created_by?: string; // NEW: User ID of who created the invoice
  created_by_name?: string; // NEW: Name of the creator for easier display
  date: string;
  total_before_discount: number;
  total_discount: number; // Item discounts sum
  additional_discount?: number; // NEW: Global extra discount
  net_total: number;
  previous_balance: number;
  final_balance: number;
  payment_status: PaymentStatus;
  items: CartItem[]; // Added to persist items
  type: 'SALE' | 'RETURN'; // Added Invoice Type
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
  warehouse_id: string; // Target Warehouse
  batch_number: string; // For new batches or identifying returned batches
  quantity: number;
  cost_price: number;
  selling_price: number;
  expiry_date: string;
}

// NEW: Purchase Order (Planning)
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
      cost_price: number; // NEW: Agreed/Estimated Cost
      last_cost?: number; // Snapshot of last cost
      current_stock?: number;
      monthly_avg?: number;
  }[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  bonus_quantity: number;
  unit_price: number;
  discount_percentage: number;
  line_total: number;
}

export enum CashTransactionType {
  RECEIPT = 'RECEIPT',
  EXPENSE = 'EXPENSE',
}

// Changed from union type to string to allow dynamic categories
export type CashCategory = string;

export interface CashTransaction {
  id: string;
  ref_number?: string; // NEW: Manual or Auto Tracking Number (Doc No)
  type: CashTransactionType;
  category: CashCategory;
  reference_id?: string; // ID of the Invoice, Customer, or Supplier
  related_name?: string; // Name of the person/entity for display
  amount: number;
  date: string;
  notes: string;
}

// NEW: Audit Trail for Inventory (Card Item)
export type StockMovementType = 'SALE' | 'PURCHASE' | 'RETURN_IN' | 'RETURN_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'SPOILAGE' | 'INITIAL';

export interface StockMovement {
    id: string;
    date: string;
    type: StockMovementType;
    product_id: string;
    batch_number: string;
    warehouse_id: string;
    quantity: number; // Positive for IN, Negative for OUT
    reference_id?: string; // Invoice ID, Transfer ID, etc.
    notes?: string;
}

// Helper types for UI
export interface ProductWithBatches extends Product {
  batches: Batch[];
}

export interface CartItem {
  product: Product;
  batch: Batch;
  quantity: number;
  bonus_quantity: number;
  discount_percentage: number;
  unit_price?: number; // Added: The actual selling price used
}
