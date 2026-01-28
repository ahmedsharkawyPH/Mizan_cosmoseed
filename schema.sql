
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
        -- تحديث كمية المخزون وأسعار التشغيلات
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

        -- تحديث السعر الافتراضي في جدول المنتجات ليكون سعر آخر شراء
        IF (p_invoice->>'type' = 'PURCHASE') THEN
            UPDATE products 
            SET purchase_price = v_item.cost_price, 
                selling_price = v_item.selling_price 
            WHERE id = v_item.product_id;
        END IF;
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
            p_p_cash_tx->>'notes', p_cash_tx->>'ref_number'
        );
    END IF;

    UPDATE customers 
    SET current_balance = (p_invoice->>'final_balance')::NUMERIC
    WHERE id = p_invoice->>'customer_id';

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
