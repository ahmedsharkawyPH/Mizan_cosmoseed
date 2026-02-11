
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

CREATE TABLE IF NOT EXISTS representatives (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    commission_rate NUMERIC DEFAULT 0,
    commission_target NUMERIC DEFAULT 0
);

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
    distribution_line TEXT, -- مضاف في V4.2
    representative_code TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0,
    default_discount_percent NUMERIC DEFAULT 0
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

-- 4. جداول العمليات المالية
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
    items JSONB, -- يحتوي على مصفوفة الأصناف
    type TEXT -- 'SALE' or 'RETURN'
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
    type TEXT -- 'PURCHASE' or 'RETURN'
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    order_number TEXT UNIQUE,
    supplier_id TEXT REFERENCES suppliers(id),
    date TIMESTAMP WITH TIME ZONE,
    order_status TEXT DEFAULT 'PENDING',
    notes TEXT,
    items JSONB
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    ref_number TEXT,
    type TEXT, -- 'RECEIPT' or 'EXPENSE'
    category TEXT,
    reference_id TEXT,
    related_name TEXT,
    amount NUMERIC DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- 5. جداول الإدارة والتقارير
CREATE TABLE IF NOT EXISTS pending_adjustments (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    product_id TEXT,
    warehouse_id TEXT,
    system_qty NUMERIC,
    actual_qty NUMERIC,
    diff NUMERIC,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    adj_status TEXT DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS daily_closings (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    date TEXT UNIQUE,
    total_sales NUMERIC,
    total_expenses NUMERIC,
    cash_balance NUMERIC,
    bank_balance NUMERIC,
    inventory_value NUMERIC,
    notes TEXT,
    closed_by TEXT
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

-- 6. تفعيل الـ Triggers لكافة الجداول لزيادة رقم الـ Version تلقائياً
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name NOT IN ('settings') -- جداول الضبط عادة لها معالجة خاصة
    LOOP
        EXECUTE format('CREATE TRIGGER trigger_update_version_%I 
                        BEFORE UPDATE ON %I 
                        FOR EACH ROW EXECUTE FUNCTION update_version_and_timestamp();', t, t);
    END LOOP;
END $$;

-- 7. دوال الـ RPC المتقدمة (اختياري للسرعة القصوى)

-- دالة معالجة المشتريات المحدثة لـ V4.2
CREATE OR REPLACE FUNCTION process_purchase_invoice_v2(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_item RECORD;
    v_total_qty NUMERIC;
BEGIN
    -- إدراج الفاتورة
    INSERT INTO purchase_invoices (id, invoice_number, document_number, supplier_id, date, total_amount, paid_amount, type, items)
    VALUES (p_invoice->>'id', p_invoice->>'invoice_number', p_invoice->>'document_number', p_invoice->>'supplier_id', (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE, (p_invoice->>'total_amount')::NUMERIC, (p_invoice->>'paid_amount')::NUMERIC, p_invoice->>'type', p_items);

    -- تحديث المخزون والأسعار
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, warehouse_id TEXT, batch_number TEXT, quantity NUMERIC, cost_price NUMERIC, selling_price NUMERIC) LOOP
        v_total_qty := v_item.quantity;
        
        INSERT INTO batches (id, product_id, warehouse_id, batch_number, quantity, purchase_price, selling_price, batch_status)
        VALUES ('B-' || gen_random_uuid(), v_item.product_id, v_item.warehouse_id, v_item.batch_number, v_total_qty, v_item.cost_price, v_item.selling_price, 'ACTIVE')
        ON CONFLICT (product_id, warehouse_id, batch_number) 
        DO UPDATE SET quantity = batches.quantity + EXCLUDED.quantity, purchase_price = EXCLUDED.purchase_price, selling_price = EXCLUDED.selling_price;

        UPDATE products SET purchase_price = v_item.cost_price, selling_price = v_item.selling_price WHERE id = v_item.product_id;
    END LOOP;

    -- الحركة المالية
    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (id, type, category, reference_id, amount, date, notes, ref_number)
        VALUES (p_cash_tx->>'id', p_cash_tx->>'type', p_cash_tx->>'category', p_cash_tx->>'reference_id', (p_cash_tx->>'amount')::NUMERIC, (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE, p_cash_tx->>'notes', p_cash_tx->>'ref_number');
    END IF;

    -- رصيد المورد
    UPDATE suppliers SET current_balance = current_balance + ((p_invoice->>'total_amount')::NUMERIC - (p_invoice->>'paid_amount')::NUMERIC) WHERE id = p_invoice->>'supplier_id';

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
