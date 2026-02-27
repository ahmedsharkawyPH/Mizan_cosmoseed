
-- ==========================================
-- MIZAN ONLINE PRO - SCHEMA V4.2 (CITADEL)
-- ==========================================

-- 1. تمكين الإضافات المطلوبة
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. دالة تحديث التاريخ ورقم الإصدار تلقائياً
CREATE OR REPLACE FUNCTION update_version_and_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. جداول التعريفات الأساسية
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    package_type TEXT,
    items_per_package NUMERIC DEFAULT 1,
    purchase_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    product_id TEXT REFERENCES products(id),
    warehouse_id TEXT REFERENCES warehouses(id),
    batch_number TEXT,
    quantity NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    expiry_date TEXT,
    batch_status TEXT DEFAULT 'ACTIVE',
    UNIQUE(product_id, warehouse_id, batch_number)
);

-- 4. دالة RPC الذكية لجلب أحدث الأسعار (Selective Update Patch)
-- ملاحظة: تم استخدام TEXT ليتوافق مع نظام المعرفات في التطبيق
CREATE OR REPLACE FUNCTION public.get_latest_batch_prices()
RETURNS TABLE (
    product_id TEXT,
    latest_selling_price NUMERIC,
    latest_purchase_price NUMERIC
)
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_batches AS (
        SELECT
            b.product_id,
            b.selling_price,
            b.purchase_price,
            ROW_NUMBER() OVER(PARTITION BY b.product_id ORDER BY b.created_at DESC) as rn
        FROM
            public.batches b
        WHERE b.selling_price IS NOT NULL AND b.status = 'ACTIVE'
    )
    SELECT
        rb.product_id,
        rb.selling_price as latest_selling_price,
        rb.purchase_price as latest_purchase_price
    FROM
        ranked_batches rb
    WHERE
        rn = 1;
END;
$$ LANGUAGE plpgsql;

-- باقي الجداول (Customers, Suppliers, Invoices, etc.)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    area TEXT,
    address TEXT,
    distribution_line TEXT,
    representative_code TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0,
    default_discount_percent NUMERIC DEFAULT 0,
    price_segment TEXT DEFAULT 'retail'
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    contact_person TEXT,
    address TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    invoice_number TEXT UNIQUE,
    customer_id TEXT REFERENCES customers(id),
    created_by TEXT,
    created_by_name TEXT,
    date TIMESTAMP WITH TIME ZONE,
    total_before_discount NUMERIC DEFAULT 0,
    total_discount NUMERIC DEFAULT 0,
    additional_discount NUMERIC DEFAULT 0,
    commission_value NUMERIC DEFAULT 0,
    net_total NUMERIC DEFAULT 0,
    previous_balance NUMERIC DEFAULT 0,
    final_balance NUMERIC DEFAULT 0,
    payment_status TEXT,
    items JSONB,
    type TEXT
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    invoice_number TEXT UNIQUE,
    document_number TEXT,
    supplier_id TEXT REFERENCES suppliers(id),
    date TIMESTAMP WITH TIME ZONE,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    items JSONB,
    type TEXT
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    ref_number TEXT,
    type TEXT,
    category TEXT,
    reference_id TEXT,
    related_name TEXT,
    amount NUMERIC DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    company_name TEXT,
    company_address TEXT,
    company_phone TEXT,
    company_logo TEXT,
    currency TEXT DEFAULT 'LE',
    low_stock_threshold INTEGER DEFAULT 10,
    expense_categories JSONB DEFAULT '[]',
    distribution_lines JSONB DEFAULT '[]',
    printer_paper_size TEXT DEFAULT 'A4',
    invoice_template TEXT DEFAULT '1'
);
