-- ============================================================
-- سكربت ترحيل البيانات: إضافة أسماء الأصناف لفواتير المشتريات
-- الإصدار: 1.0
-- الهدف: إثراء بيانات JSONB بأسماء الأصناف لتجنب فقدانها عند حذف الصنف
-- ملاحظة: يرجى أخذ نسخة احتياطية من جدول purchase_invoices قبل التشغيل
-- ============================================================

BEGIN;

UPDATE purchase_invoices
SET items = enriched_data.new_items,
    updated_at = NOW(),
    version = version + 1
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

-- التحقق من عدد السجلات المحدثة
-- SELECT count(*) FROM purchase_invoices WHERE updated_at > NOW() - interval '1 minute';

COMMIT;