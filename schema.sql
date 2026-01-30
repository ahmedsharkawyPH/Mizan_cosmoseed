
-- 1. جداول النظام الأساسية (في حال لم تكن موجودة)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    package_type TEXT,
    items_per_package NUMERIC DEFAULT 1,
    purchase_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id),
    warehouse_id TEXT,
    batch_number TEXT,
    quantity NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    expiry_date TEXT,
    status TEXT DEFAULT 'ACTIVE',
    UNIQUE(product_id, warehouse_id, batch_number)
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT,
    document_number TEXT,
    supplier_id TEXT,
    date TIMESTAMP WITH TIME ZONE,
    total_amount NUMERIC,
    paid_amount NUMERIC,
    type TEXT -- 'PURCHASE' or 'RETURN'
);

-- 2. الدوال البرمجية المحدثة (RPC)

-- دالة معالجة المشتريات (تتضمن منطق تحديث السعر التلقائي والبونص)
CREATE OR REPLACE FUNCTION process_purchase_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_item RECORD;
    v_total_qty NUMERIC;
BEGIN
    -- 1. إدراج رأس الفاتورة
    INSERT INTO purchase_invoices (
        id, invoice_number, document_number, supplier_id, date, total_amount, paid_amount, type
    ) VALUES (
        p_invoice->>'id', p_invoice->>'invoice_number', p_invoice->>'document_number',
        p_invoice->>'supplier_id', (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE,
        (p_invoice->>'total_amount')::NUMERIC, (p_invoice->>'paid_amount')::NUMERIC, p_invoice->>'type'
    );

    -- 2. معالجة الأصناف (التحديث اللحظي للمخزون والأسعار)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id TEXT, warehouse_id TEXT, batch_number TEXT, 
        quantity NUMERIC, bonus_quantity NUMERIC, cost_price NUMERIC, selling_price NUMERIC, expiry_date TEXT
    ) LOOP
        -- حساب إجمالي الكمية المضافة للمخزن (الأساسية + البونص)
        v_total_qty := COALESCE(v_item.quantity, 0) + COALESCE(v_item.bonus_quantity, 0);

        -- أ. تحديث أو إضافة التشغيلة (Batch) لضبط أرصدة المخازن
        INSERT INTO batches (
            id, product_id, warehouse_id, batch_number, quantity, purchase_price, selling_price, expiry_date, status
        ) VALUES (
            'B-' || gen_random_uuid(), v_item.product_id, v_item.warehouse_id,
            v_item.batch_number, v_total_qty, v_item.cost_price,
            v_item.selling_price, v_item.expiry_date, 'ACTIVE'
        )
        ON CONFLICT (product_id, warehouse_id, batch_number) 
        DO UPDATE SET 
            quantity = batches.quantity + EXCLUDED.quantity,
            purchase_price = EXCLUDED.purchase_price,
            selling_price = EXCLUDED.selling_price;

        -- ب. المنطق المطلوب: تحديث السعر الافتراضي في جدول المنتجات الأساسي
        IF (p_invoice->>'type' = 'PURCHASE') THEN
            UPDATE products 
            SET purchase_price = v_item.cost_price, 
                selling_price = v_item.selling_price 
            WHERE id = v_item.product_id;
        END IF;
    END LOOP;

    -- 3. معالجة حركة الخزينة (إذا وجدت)
    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (
            id, type, category, reference_id, amount, date, notes, ref_number
        ) VALUES (
            p_cash_tx->>'id', p_cash_tx->>'type', p_cash_tx->>'category',
            p_cash_tx->>'reference_id', (p_cash_tx->>'amount')::NUMERIC,
            (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE, p_cash_tx->>'notes', p_cash_tx->>'ref_number'
        );
    END IF;

    -- 4. تحديث رصيد المورد
    UPDATE suppliers 
    SET current_balance = current_balance + ((p_invoice->>'total_amount')::NUMERIC - (p_invoice->>'paid_amount')::NUMERIC)
    WHERE id = p_invoice->>'supplier_id';

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
