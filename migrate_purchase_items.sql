-- ============================================================
-- سكربت ترحيل البيانات المطور: إضافة الأعمدة الناقصة وتحديث البيانات
-- الإصدار: 1.1
-- ============================================================

BEGIN;

-- 1. التأكد من وجود عمود الإصدار وتحديث الوقت (لتجنب الخطأ 42703)
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. تحديث بيانات الأصناف وإضافة الأسماء داخل الـ JSONB
UPDATE purchase_invoices
SET items = enriched_data.new_items,
    updated_at = NOW(),
    version = COALESCE(version, 0) + 1
FROM (
    SELECT 
        pi.id,
        jsonb_agg(
            item || jsonb_build_object(
                'product_name', COALESCE(p.name, '--- صنف محذوف ---'),
                'product_code', COALESCE(p.code, '---'),
                '_migrated_at', NOW()
            )
        ) as new_items
    FROM 
        purchase_invoices pi,
        jsonb_array_elements(pi.items) AS item
    LEFT JOIN 
        products p ON (item->>'product_id') = p.id
    GROUP BY 
        pi.id
) AS enriched_data
WHERE 
    purchase_invoices.id = enriched_data.id
    AND purchase_invoices.items IS NOT NULL
    AND jsonb_array_length(purchase_invoices.items) > 0;

COMMIT;