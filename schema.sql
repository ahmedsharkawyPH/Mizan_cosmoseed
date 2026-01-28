
-- 1. إضافة حقل رقم المستند لجدول فواتير المشتريات إذا لم يكن موجوداً
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_invoices' AND column_name='document_number') THEN
        ALTER TABLE purchase_invoices ADD COLUMN document_number TEXT;
    END IF;
END $$;

-- 2. تحديث دالة RPC لمعالجة فواتير المشتريات لتشمل الحقل الجديد
CREATE OR REPLACE FUNCTION process_purchase_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_invoice_id TEXT;
    v_item RECORD;
BEGIN
    -- أ. إدراج رأس الفاتورة مع رقم المستند
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

    -- ب. إدراج الأصناف وتحديث المخزون
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id TEXT, warehouse_id TEXT, batch_number TEXT, 
        quantity NUMERIC, cost_price NUMERIC, selling_price NUMERIC, expiry_date TEXT
    ) LOOP
        -- إدراج الباتش أو تحديثه (استخدام UUID لضمان الفرادة في المعرفات الفرعية)
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

    -- ج. إدراج حركة الخزينة إذا وجدت
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

    RETURN 'SUCCESS';
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to process purchase invoice: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
