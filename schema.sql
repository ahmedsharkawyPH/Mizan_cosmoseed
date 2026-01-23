
-- [Existing tables omitted for brevity, adding the new RPC functions]

-- 1. Function to handle Sales Invoices (Sale & Return) Atomically
CREATE OR REPLACE FUNCTION process_sales_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_invoice_id TEXT;
    v_customer_id TEXT;
    v_item RECORD;
    v_net_total NUMERIC;
    v_type TEXT;
    v_qty_adj NUMERIC;
BEGIN
    v_invoice_id := p_invoice->>'id';
    v_customer_id := p_invoice->>'customer_id';
    v_net_total := (p_invoice->>'net_total')::NUMERIC;
    v_type := p_invoice->>'type'; -- 'SALE' or 'RETURN'

    -- A. Insert Invoice
    INSERT INTO invoices (
        id, invoice_number, customer_id, created_by, created_by_name, 
        date, total_before_discount, total_discount, additional_discount, 
        net_total, previous_balance, final_balance, payment_status, items, type
    ) VALUES (
        v_invoice_id, p_invoice->>'invoice_number', v_customer_id, p_invoice->>'created_by', p_invoice->>'created_by_name',
        (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE, (p_invoice->>'total_before_discount')::NUMERIC,
        (p_invoice->>'total_discount')::NUMERIC, (p_invoice->>'additional_discount')::NUMERIC,
        v_net_total, (p_invoice->>'previous_balance')::NUMERIC, (p_invoice->>'final_balance')::NUMERIC,
        p_invoice->>'payment_status', p_items, v_type
    );

    -- B. Update Customer Balance
    UPDATE customers 
    SET current_balance = (p_invoice->>'final_balance')::NUMERIC 
    WHERE id = v_customer_id;

    -- C. Handle Items (Inventory & Movements)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product JSONB, batch JSONB, quantity NUMERIC, bonus_quantity NUMERIC)
    LOOP
        -- Determine stock adjustment (Sale: -Qty, Return: +Qty)
        v_qty_adj := v_item.quantity + COALESCE(v_item.bonus_quantity, 0);
        IF v_type = 'SALE' THEN
            v_qty_adj := -v_qty_adj;
        END IF;

        -- Update Batch Quantity
        UPDATE batches 
        SET quantity = quantity + v_qty_adj 
        WHERE id = (v_item.batch->>'id');

        -- Log Stock Movement
        INSERT INTO stock_movements (
            id, date, type, product_id, batch_number, warehouse_id, quantity, reference_id
        ) VALUES (
            'SM' || extract(epoch from now())::text || (random()*100)::int::text,
            now(), v_type, (v_item.product->>'id'), (v_item.batch->>'batch_number'),
            (v_item.batch->>'warehouse_id'), v_qty_adj, v_invoice_id
        );
    END LOOP;

    -- D. Handle Cash Transaction (If paid)
    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (
            id, ref_number, type, category, reference_id, related_name, amount, date, notes
        ) VALUES (
            p_cash_tx->>'id', p_cash_tx->>'ref_number', p_cash_tx->>'type', p_cash_tx->>'category',
            p_cash_tx->>'reference_id', p_cash_tx->>'related_name', (p_cash_tx->>'amount')::NUMERIC,
            (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE, p_cash_tx->>'notes'
        );
    END IF;

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;

-- 2. Function to handle Purchase Invoices (Purchase & Return) Atomically
CREATE OR REPLACE FUNCTION process_purchase_invoice(
    p_invoice JSONB,
    p_items JSONB,
    p_cash_tx JSONB DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_inv_id TEXT;
    v_supp_id TEXT;
    v_item RECORD;
    v_total NUMERIC;
    v_type TEXT;
    v_qty_adj NUMERIC;
BEGIN
    v_inv_id := p_invoice->>'id';
    v_supp_id := p_invoice->>'supplier_id';
    v_total := (p_invoice->>'total_amount')::NUMERIC;
    v_type := p_invoice->>'type';

    -- A. Insert Purchase Invoice
    INSERT INTO purchase_invoices (
        id, invoice_number, supplier_id, date, total_amount, paid_amount, type, items
    ) VALUES (
        v_inv_id, p_invoice->>'invoice_number', v_supp_id, (p_invoice->>'date')::TIMESTAMP WITH TIME ZONE,
        v_total, (p_invoice->>'paid_amount')::NUMERIC, v_type, p_items
    );

    -- B. Update Supplier Balance
    -- Balance adjustment logic: Purchase adds to debt (+), Payment (if any) or Return subtracts (-)
    -- Here we assume the calling side calculated the final balance adjustment needed
    UPDATE suppliers 
    SET current_balance = current_balance + (CASE WHEN v_type = 'PURCHASE' THEN v_total ELSE -v_total END) - COALESCE((p_invoice->>'paid_amount')::NUMERIC, 0)
    WHERE id = v_supp_id;

    -- C. Handle Items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, warehouse_id TEXT, batch_number TEXT, quantity NUMERIC, cost_price NUMERIC, selling_price NUMERIC, expiry_date DATE)
    LOOP
        v_qty_adj := v_item.quantity;
        IF v_type = 'RETURN' THEN v_qty_adj := -v_qty_adj; END IF;

        -- Update existing batch or insert new one (simplified: update if matches warehouse/batch_no/prod)
        UPDATE batches 
        SET quantity = quantity + v_qty_adj, 
            purchase_price = CASE WHEN v_type = 'PURCHASE' THEN v_item.cost_price ELSE purchase_price END,
            selling_price = CASE WHEN v_type = 'PURCHASE' THEN v_item.selling_price ELSE selling_price END
        WHERE product_id = v_item.product_id AND warehouse_id = v_item.warehouse_id AND batch_number = v_item.batch_number;

        -- Update product base prices if purchase
        IF v_type = 'PURCHASE' THEN
            UPDATE products SET purchase_price = v_item.cost_price, selling_price = v_item.selling_price WHERE id = v_item.product_id;
        END IF;

        -- Log Movement
        INSERT INTO stock_movements (
            id, date, type, product_id, batch_number, warehouse_id, quantity, reference_id
        ) VALUES (
            'SM' || extract(epoch from now())::text || (random()*100)::int::text,
            now(), v_type, v_item.product_id, v_item.batch_number, v_item.warehouse_id, v_qty_adj, v_inv_id
        );
    END LOOP;

    -- D. Handle Cash Tx
    IF p_cash_tx IS NOT NULL THEN
        INSERT INTO cash_transactions (
            id, type, category, reference_id, amount, date, notes
        ) VALUES (
            p_cash_tx->>'id', p_cash_tx->>'type', p_cash_tx->>'category',
            p_cash_tx->>'reference_id', (p_cash_tx->>'amount')::NUMERIC,
            (p_cash_tx->>'date')::TIMESTAMP WITH TIME ZONE, p_cash_tx->>'notes'
        );
    END IF;

    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
