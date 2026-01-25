import { db } from '../services/db';

const translations: Record<string, Record<string, string>> = {
  ar: {
    'nav.dashboard': 'لوحة التحكم',
    'nav.sales': 'المبيعات',
    'nav.new_invoice': 'فاتورة جديدة',
    'nav.invoices': 'قائمة الفواتير',
    'nav.products': 'الأصناف والمخزون',
    'nav.all_items': 'كافة الأصناف',
    'nav.inventory_analysis': 'تحليل المخزون',
    'nav.shortages': 'النواقص',
    'nav.purchases': 'المشتريات',
    'nav.cash': 'الخزينة والحسابات',
    'nav.reports': 'التقارير والتحليل',
    'nav.settings': 'الإعدادات',
    'nav.logout': 'تسجيل الخروج',
    'nav.telesales': 'قسم التيليسيلز',
    'nav.commissions': 'نظام العمولات',

    'dash.total_sales': 'إجمالي المبيعات',
    'dash.cash_balance': 'رصيد الخزينة',
    'dash.customers': 'إجمالي العملاء',
    'dash.low_stock': 'أصناف قاربت على النفاذ',
    'dash.quick_actions': 'روابط سريعة',
    'dash.sales_trend': 'مؤشر المبيعات (آخر 7 أيام)',
    'dash.insights': 'تحليلات ميزان الذكية',
    'dash.insights_desc': 'يساعدك النظام على تتبع الأرباح، النواقص، وأداء المناديب بشكل لحظي.',
    'dash.view_reports': 'مشاهدة التقارير الكاملة',
    'dash.supplier_stmt': 'حسابات الموردين',

    'inv.customer': 'العميل',
    'inv.product': 'الصنف',
    'inv.qty': 'الكمية',
    'inv.price': 'السعر',
    'inv.total': 'الإجمالي',
    'inv.add': 'إضافة صنف',
    'inv.add_btn': 'إضافة للفاتورة',
    'inv.details': 'تفاصيل الفاتورة',
    'inv.subtotal': 'الإجمالي قبل الخصم',
    'inv.additional_discount': 'خصم إضافي',
    'inv.net_total': 'الصافي النهائي',
    'inv.cash_paid': 'المبلغ المدفوع (نقداً)',
    'inv.save_print': 'حفظ وطباعة',
    'inv.finalize': 'حفظ الفاتورة فقط',
    'inv.prev_balance': 'رصيد سابق',
    'inv.settings': 'إعدادات الفاتورة',
    'inv.manual_price': 'تفعيل تعديل السعر يدوياً',
    'inv.discount': 'تفعيل الخصم على الصنف',
    'inv.return_mode': 'وضع المرتجع',

    'cust.title': 'إدارة العملاء',
    'cust.add': 'إضافة عميل جديد',
    'cust.search': 'بحث باسم العميل أو الكود...',
    'cust.name': 'اسم العميل',
    'cust.code': 'كود',
    'cust.phone': 'الموبايل',
    'cust.address': 'العنوان',
    'cust.balance': 'الرصيد الحالي',
    'cust.dist_line': 'خط التوزيع',
    'cust.rep': 'المندوب المسئول',
    'cust.tab_list': 'قائمة العملاء',
    'cust.tab_analysis': 'تحليل المديونيات',
    'cust.export_excel': 'تصدير إكسيل',

    'supp.title': 'الموردين',
    'supp.add': 'إضافة مورد جديد',
    'supp.contact': 'الشخص المسئول',

    'stock.title': 'المخازن والأصناف',
    'stock.new': 'صنف جديد',
    'stock.qty': 'الرصيد',
    'stock.total': 'إجمالي الرصيد',
    'stock.purchase': 'فاتورة مشتريات',
    'stock.order': 'طلب شراء',
    'stock.filter_warehouse': 'تصفية حسب المخزن',
    'stock.only_available': 'المتوفر فقط',

    'pur.title': 'فاتورة مشتريات جديدة',
    'pur.return_title': 'مرتجع مشتريات',
    'pur.select_supplier': 'اختر المورد',
    'pur.cost': 'سعر الشراء',
    'pur.profit_margin': 'هامش الربح %',
    'pur.sell': 'سعر البيع',
    'pur.submit': 'تسجيل الفاتورة',
    'pur.list_title': 'سجل المشتريات',

    'cash.title': 'حركة الخزينة',
    'cash.receipt': 'سند قبض (داخل)',
    'cash.expense': 'سند صرف (خارج)',
    'cash.income': 'إجمالي المقبوضات',
    'cash.total_expenses': 'إجمالي المصروفات',
    'cash.history': 'سجل الحركات المالية',
    'cash.category': 'البند / التصنيف',
    'cash.entity': 'الجهة / البيان',
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
    'comm.no_sales': 'لا توجد مبيعات لهذا الموظف في الفترة المحددة',

    'cat.CUSTOMER_PAYMENT': 'تحصيل عملاء',
    'cat.SUPPLIER_PAYMENT': 'سداد موردين',
    'cat.CAR': 'مصاريف سيارة',
    'cat.RENT': 'إيجار',
    'cat.ELECTRICITY': 'كهرباء',
    'cat.SALARY': 'مرتبات',
    'cat.COMMISSION': 'عمولات مبيعات',
    'cat.PARTNER_CONTRIBUTION': 'إيداع شريك',
    'cat.OTHER': 'نثريات أخرى',

    'common.date': 'التاريخ',
    'common.action': 'إجراء',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.desc': 'البيان',
    'common.debit': 'مدين',
    'common.credit': 'دائن',
    'common.balance': 'الرصيد',
    'common.statement': 'كشف حساب',
    'common.opening': 'رصيد افتتاحي'
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