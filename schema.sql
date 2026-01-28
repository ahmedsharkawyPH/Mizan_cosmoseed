
-- 1. مسح الجداول القديمة تماماً لضمان إعادة البناء بأنواع صحيحة
DROP TABLE IF EXISTS cash_transactions CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS purchase_invoices CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS representatives CASCADE;
DROP TABLE IF EXISTS daily_closings CASCADE;
DROP TABLE IF EXISTS pending_adjustments CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;

-- 2. إنشاء الجداول بنوع المعرف TEXT ليتوافق مع كود التطبيق

CREATE TABLE warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false
);

CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    contact_person TEXT,
    address TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0
);

CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    area TEXT,
    address TEXT,
    distribution_line TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0,
    representative_code TEXT,
    default_discount_percent NUMERIC DEFAULT 0
);

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    package_type TEXT,
    items_per_package INTEGER,
    selling_price NUMERIC,
    purchase_price NUMERIC
);

CREATE TABLE batches (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
    batch_number TEXT,
    selling_price NUMERIC,
    purchase_price NUMERIC,
    quantity NUMERIC,
    expiry_date TEXT,
    status TEXT,
    UNIQUE(product_id, warehouse_id, batch_number)
);

CREATE TABLE purchase_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE,
    document_number TEXT,
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    type TEXT
);

CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    created_by TEXT,
    created_by_name TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_before_discount NUMERIC,
    total_discount NUMERIC,
    additional_discount NUMERIC,
    net_total NUMERIC,
    previous_balance NUMERIC,
    final_balance NUMERIC,
    payment_status TEXT,
    items JSONB,
    type TEXT
);

CREATE TABLE cash_transactions (
    id TEXT PRIMARY KEY,
    ref_number TEXT,
    type TEXT,
    category TEXT,
    reference_id TEXT,
    related_name TEXT,
    amount NUMERIC NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- الجداول المساعدة الإضافية
CREATE TABLE daily_closings (
    id TEXT PRIMARY KEY,
    date TEXT,
    total_sales NUMERIC,
    total_expenses NUMERIC,
    cash_balance NUMERIC,
    bank_balance NUMERIC,
    inventory_value NUMERIC,
    closed_by TEXT,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE pending_adjustments (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),
    warehouse_id TEXT REFERENCES warehouses(id),
    system_qty NUMERIC,
    actual_qty NUMERIC,
    diff NUMERIC,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT,
    submitted_by TEXT
);

CREATE TABLE purchase_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    supplier_id TEXT REFERENCES suppliers(id),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT,
    items JSONB
);

CREATE TABLE representatives (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    commission_rate NUMERIC,
    commission_target NUMERIC
);

-- 3. الدوال البرمجية (RPC) المحدثة

-- دالة معالجة المشتريات
CREATE OR REPLACE FUNCTION process_purchase_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_item RECORD;
BEGIN
    INSERT INTO purchase_invoices (
        id, invoice_number, document_number, supplier_id, date, total_amount, paid_amount, type
    ) VALUES (
        p_invoice->>'id', p_invoice->>'invoice_number', p_invoice->>'document_number',
        p_invoice->>'supplier_id', (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE,
        (p_invoice->>'total_amount')::NUMERIC, (p_invoice->>'paid_amount')::NUMERIC, p_invoice->>'type'
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id TEXT, warehouse_id TEXT, batch_number TEXT, 
        quantity NUMERIC, cost_price NUMERIC, selling_price NUMERIC, expiry_date TEXT
    ) LOOP
        INSERT INTO batches (
            id, product_id, warehouse_id, batch_number, quantity, purchase_price, selling_price, expiry_date, status
        ) VALUES (
            'B-' || gen_random_uuid(), v_item.product_id, v_item.warehouse_id,
            v_item.batch_number, v_item.quantity, v_item.cost_price,
            v_item.selling_price, v_item.expiry_date, 'ACTIVE'
        )
        ON CONFLICT (product_id, warehouse_id, batch_number) 
        DO UPDATE SET 
            quantity = batches.quantity + EXCLUDED.quantity,
            purchase_price = EXCLUDED.purchase_price,
            selling_price = EXCLUDED.selling_price;
    END LOOP;

    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (
            id, type, category, reference_id, amount, date, notes, ref_number
        ) VALUES (
            p_cash_tx->>'id', p_cash_tx->>'type', p_cash_tx->>'category',
            p_cash_tx->>'reference_id', (p_cash_tx->>'amount')::NUMERIC,
            (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE, p_cash_tx->>'notes', p_cash_tx->>'ref_number'
        );
    END IF;

    UPDATE suppliers 
    SET current_balance = current_balance + ((p_invoice->>'total_amount')::NUMERIC - (p_invoice->>'paid_amount')::NUMERIC)
    WHERE id = p_invoice->>'supplier_id';

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;

-- دالة معالجة المبيعات
CREATE OR REPLACE FUNCTION process_sales_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_item RECORD;
BEGIN
    INSERT INTO invoices (
        id, invoice_number, customer_id, created_by, created_by_name, date,
        total_before_discount, total_discount, additional_discount, net_total,
        previous_balance, final_balance, payment_status, items, type
    ) VALUES (
        p_invoice->>'id', p_invoice->>'invoice_number', p_invoice->>'customer_id',
        p_invoice->>'created_by', p_invoice->>'created_by_name',
        (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE,
        (p_invoice->>'total_before_discount')::NUMERIC, (p_invoice->>'total_discount')::NUMERIC,
        (p_invoice->>'additional_discount')::NUMERIC, (p_invoice->>'net_total')::NUMERIC,
        (p_invoice->>'previous_balance')::NUMERIC, (p_invoice->>'final_balance')::NUMERIC,
        p_invoice->>'payment_status', p_items, p_invoice->>'type'
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product JSONB, batch JSONB, quantity NUMERIC
    ) LOOP
        UPDATE batches 
        SET quantity = quantity - v_item.quantity
        WHERE id = (v_item.batch->>'id');
    END LOOP;

    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (
            id, type, category, reference_id, related_name, amount, date, notes, ref_number
        ) VALUES (
            p_cash_tx->>'id', p_cash_tx->>'type', p_cash_tx->>'category',
            p_cash_tx->>'reference_id', p_cash_tx->>'related_name',
            (p_cash_tx->>'amount')::NUMERIC, (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE,
            p_cash_tx->>'notes', p_cash_tx->>'ref_number'
        );
    END IF;

    UPDATE customers 
    SET current_balance = (p_invoice->>'final_balance')::NUMERIC
    WHERE id = p_invoice->>'customer_id';

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
