
-- 1. إنشاء الجداول الأساسية (إذا لم تكن موجودة)

CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    contact_person TEXT,
    address TEXT,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
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

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    package_type TEXT,
    items_per_package INTEGER,
    selling_price NUMERIC,
    purchase_price NUMERIC
);

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),
    warehouse_id TEXT REFERENCES warehouses(id),
    batch_number TEXT,
    selling_price NUMERIC,
    purchase_price NUMERIC,
    quantity NUMERIC,
    expiry_date TEXT,
    status TEXT,
    UNIQUE(product_id, warehouse_id, batch_number)
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE,
    document_number TEXT, -- رقم فاتورة المورد الورقية
    supplier_id TEXT REFERENCES suppliers(id),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    type TEXT -- 'PURCHASE' or 'RETURN'
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE,
    customer_id TEXT REFERENCES customers(id),
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
    type TEXT -- 'SALE' or 'RETURN'
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    ref_number TEXT,
    type TEXT, -- 'RECEIPT' or 'EXPENSE'
    category TEXT,
    reference_id TEXT, -- ID of the invoice or entity
    related_name TEXT,
    amount NUMERIC NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. دالة معالجة فاتورة المشتريات (RPC)
CREATE OR REPLACE FUNCTION process_purchase_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- أ. إدراج رأس الفاتورة
    INSERT INTO purchase_invoices (
        id, invoice_number, document_number, supplier_id, date, total_amount, paid_amount, type
    ) VALUES (
        p_invoice->>'id',
        p_invoice->>'invoice_number',
        p_invoice->>'document_number',
        p_invoice->>'supplier_id',
        (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE,
        (p_invoice->>'total_amount')::NUMERIC,
        (p_invoice->>'paid_amount')::NUMERIC,
        p_invoice->>'type'
    );

    -- ب. تحديث المخزون (الباتشات)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id TEXT, warehouse_id TEXT, batch_number TEXT, 
        quantity NUMERIC, cost_price NUMERIC, selling_price NUMERIC, expiry_date TEXT
    ) LOOP
        INSERT INTO batches (
            id, product_id, warehouse_id, batch_number, quantity, purchase_price, selling_price, expiry_date, status
        ) VALUES (
            'B-' || gen_random_uuid(),
            v_item.product_id,
            v_item.warehouse_id,
            v_item.batch_number,
            v_item.quantity,
            v_item.cost_price,
            v_item.selling_price,
            v_item.expiry_date,
            'ACTIVE'
        )
        ON CONFLICT (product_id, warehouse_id, batch_number) 
        DO UPDATE SET 
            quantity = batches.quantity + EXCLUDED.quantity,
            purchase_price = EXCLUDED.purchase_price,
            selling_price = EXCLUDED.selling_price;
    END LOOP;

    -- ج. إدراج حركة الخزينة (إذا وجدت)
    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (
            id, type, category, reference_id, amount, date, notes, ref_number
        ) VALUES (
            p_cash_tx->>'id',
            p_cash_tx->>'type',
            p_cash_tx->>'category',
            p_cash_tx->>'reference_id',
            (p_cash_tx->>'amount')::NUMERIC,
            (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE,
            p_cash_tx->>'notes',
            p_cash_tx->>'ref_number'
        );
    END IF;

    -- د. تحديث رصيد المورد
    UPDATE suppliers 
    SET current_balance = current_balance + ((p_invoice->>'total_amount')::NUMERIC - (p_invoice->>'paid_amount')::NUMERIC)
    WHERE id = p_invoice->>'supplier_id';

    RETURN 'SUCCESS';
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Database Error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 3. دالة معالجة فاتورة المبيعات (RPC)
CREATE OR REPLACE FUNCTION process_sales_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- أ. إدراج رأس الفاتورة
    INSERT INTO invoices (
        id, invoice_number, customer_id, created_by, created_by_name, date,
        total_before_discount, total_discount, additional_discount, net_total,
        previous_balance, final_balance, payment_status, items, type
    ) VALUES (
        p_invoice->>'id',
        p_invoice->>'invoice_number',
        p_invoice->>'customer_id',
        p_invoice->>'created_by',
        p_invoice->>'created_by_name',
        (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE,
        (p_invoice->>'total_before_discount')::NUMERIC,
        (p_invoice->>'total_discount')::NUMERIC,
        (p_invoice->>'additional_discount')::NUMERIC,
        (p_invoice->>'net_total')::NUMERIC,
        (p_invoice->>'previous_balance')::NUMERIC,
        (p_invoice->>'final_balance')::NUMERIC,
        p_invoice->>'payment_status',
        p_items,
        p_invoice->>'type'
    );

    -- ب. تحديث المخزون (خصم الكميات من الباتشات)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product JSONB, batch JSONB, quantity NUMERIC
    ) LOOP
        -- خصم الكمية من الباتش المحدد
        UPDATE batches 
        SET quantity = quantity - v_item.quantity
        WHERE id = (v_item.batch->>'id');
    END LOOP;

    -- ج. إدراج حركة الخزينة (إذا وجدت)
    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (
            id, type, category, reference_id, related_name, amount, date, notes, ref_number
        ) VALUES (
            p_cash_tx->>'id',
            p_cash_tx->>'type',
            p_cash_tx->>'category',
            p_cash_tx->>'reference_id',
            p_cash_tx->>'related_name',
            (p_cash_tx->>'amount')::NUMERIC,
            (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE,
            p_cash_tx->>'notes',
            p_cash_tx->>'ref_number'
        );
    END IF;

    -- د. تحديث رصيد العميل
    UPDATE customers 
    SET current_balance = (p_invoice->>'final_balance')::NUMERIC
    WHERE id = p_invoice->>'customer_id';

    RETURN 'SUCCESS';
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Database Error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
