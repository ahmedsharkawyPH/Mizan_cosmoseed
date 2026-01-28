
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

-- دالة معالجة المشتريات (تتضمن منطق تحديث السعر التلقائي)
CREATE OR REPLACE FUNCTION process_purchase_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_item RECORD;
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
        quantity NUMERIC, cost_price NUMERIC, selling_price NUMERIC, expiry_date TEXT
    ) LOOP
        -- أ. تحديث أو إضافة التشغيلة (Batch) لضبط أرصدة المخازن
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

        -- ب. المنطق المطلوب: تحديث السعر الافتراضي في جدول المنتجات الأساسي
        -- يتم ذلك فقط في حالة الشراء (وليس المرتجع) ليصبح السعر الجديد هو المعتمد في المبيعات
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
    -- إدراج الفاتورة
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

    -- خصم الكمية من المخزن (التشغيلة المحددة)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product JSONB, batch JSONB, quantity NUMERIC
    ) LOOP
        UPDATE batches 
        SET quantity = quantity - v_item.quantity
        WHERE id = (v_item.batch->>'id');
    END LOOP;

    -- تسجيل النقدية
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

    -- تحديث رصيد العميل
    UPDATE customers 
    SET current_balance = (p_invoice->>'final_balance')::NUMERIC
    WHERE id = p_invoice->>'customer_id';

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
