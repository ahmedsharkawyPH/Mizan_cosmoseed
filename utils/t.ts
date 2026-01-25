import { db } from '../services/db';

const translations: Record<string, Record<string, string>> = {
  ar: {
    // ... (keep existing)
    'nav.commissions': 'نظام العمولات',
    'pur.profit_margin': 'هامش الربح %',
    'stock.filter_warehouse': 'تصفية حسب المخزن',
    'stock.only_available': 'المتوفر فقط',
    'cash.filter_category': 'تصفية حسب البند',
    'comm.title': 'إدارة عمولات الموظفين',
    'comm.employee': 'الموظف',
    'comm.role': 'المسمى الوظيفي',
    'comm.sales_val': 'حجم المبيعات',
    'comm.ratio': 'نسبة العمولة %',
    'comm.net_comm': 'صافي العمولة',
    'comm.disburse': 'صرف العمولة الآن',
    'comm.month_select': 'اختر الشهر المراد حسابه',
    'comm.success': 'تم صرف العمولة وتسجيلها في الخزينة',
    'comm.no_sales': 'لا توجد مبيعات لهذا الموظف في الفترة المحددة'
  }
};

export const t = (key: string): string => {
  const settings = db.getSettings();
  const lang = settings.language || 'ar'; 
  // @ts-ignore
  const text = translations[lang]?.[key] || translations['ar']?.[key] || key;
  return text;
};

export const isRTL = (): boolean => {
  const settings = db.getSettings();
  const lang = settings.language || 'ar';
  return lang === 'ar';
};