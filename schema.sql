
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table with default prices
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE, -- Nullable now
    name TEXT NOT NULL,
    package_type TEXT,
    items_per_package INTEGER DEFAULT 1,
    selling_price NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Batches table for stock tracking
CREATE TABLE batches (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    selling_price NUMERIC NOT NULL,
    purchase_price NUMERIC NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    expiry_date DATE,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    area TEXT,
    address TEXT,
    distribution_line TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0,
    representative_code TEXT,
    default_discount_percent NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    contact_person TEXT,
    address TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id TEXT REFERENCES customers(id),
    created_by TEXT,
    created_by_name TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_before_discount NUMERIC NOT NULL,
    total_discount NUMERIC DEFAULT 0,
    additional_discount NUMERIC DEFAULT 0,
    net_total NUMERIC NOT NULL,
    previous_balance NUMERIC DEFAULT 0,
    final_balance NUMERIC DEFAULT 0,
    payment_status TEXT,
    items JSONB NOT NULL,
    type TEXT DEFAULT 'SALE'
);

-- Cash Transactions
CREATE TABLE cash_transactions (
    id TEXT PRIMARY KEY,
    ref_number TEXT,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    reference_id TEXT,
    related_name TEXT,
    amount NUMERIC NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Warehouses
CREATE TABLE warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE
);

-- Settings
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    companyname TEXT,
    companyaddress TEXT,
    companyphone TEXT,
    companytaxnumber TEXT,
    companycommercialregister TEXT,
    companylogo TEXT,
    currency TEXT DEFAULT 'ج.م',
    language TEXT DEFAULT 'ar',
    invoicetemplate TEXT DEFAULT '1',
    printerpapersize TEXT DEFAULT 'A4',
    expensecategories JSONB,
    distributionlines JSONB,
    lowstockthreshold INTEGER DEFAULT 10
);

-- Daily Closings
CREATE TABLE daily_closings (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    opening_cash NUMERIC DEFAULT 0,
    cash_sales NUMERIC DEFAULT 0,
    collections NUMERIC DEFAULT 0,
    cash_purchases NUMERIC DEFAULT 0,
    expenses NUMERIC DEFAULT 0,
    expected_cash NUMERIC DEFAULT 0,
    actual_cash NUMERIC DEFAULT 0,
    difference NUMERIC DEFAULT 0,
    closed_by TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
