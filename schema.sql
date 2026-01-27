
-- جدول الإعدادات السحابي لمزامنة بنود المصروفات والهوية البصرية
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY DEFAULT 'global_settings',
    company_name TEXT DEFAULT 'Mizan Online',
    currency TEXT DEFAULT 'LE',
    expense_categories JSONB DEFAULT '["SALARY", "ELECTRICITY", "CAR", "RENT", "COMMISSION", "OTHER"]'::jsonb,
    company_logo TEXT,
    company_address TEXT,
    company_phone TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- تحديث جدول الحسابات لضمان قبول التصنيفات الجديدة
-- ملاحظة: إذا كان هناك CONSTRAINT على الكاتيجوري يفضل تحديثه
ALTER TABLE cash_transactions 
ALTER COLUMN category TYPE TEXT;

-- وظيفة RPC لحفظ الإعدادات بشكل ذري
CREATE OR REPLACE FUNCTION update_system_settings(p_settings JSONB)
RETURNS TEXT AS $$
BEGIN
    INSERT INTO system_settings (id, company_name, currency, expense_categories, company_logo, company_address, company_phone, updated_at)
    VALUES (
        'global_settings',
        p_settings->>'companyName',
        p_settings->>'currency',
        (p_settings->'expenseCategories')::jsonb,
        p_settings->>'companyLogo',
        p_settings->>'companyAddress',
        p_settings->>'companyPhone',
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        currency = EXCLUDED.currency,
        expense_categories = EXCLUDED.expense_categories,
        company_logo = EXCLUDED.company_logo,
        company_address = EXCLUDED.company_address,
        company_phone = EXCLUDED.company_phone,
        updated_at = NOW();
    RETURN 'SUCCESS';
END;
$$ LANGUAGE plpgsql;
