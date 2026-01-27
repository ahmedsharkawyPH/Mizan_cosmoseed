
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
    'nav.settings': 'إدارة النظام',
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

    // Settings & Admin Translations
    'set.page_title': 'إدارة النظام والمدير',
    'set.tab_general': 'الإعدادات العامة',
    'set.tab_approvals': 'اعتماد الجرد',
    'set.tab_invoice': 'تصميم الفاتورة',
    'set.tab_users': 'المستخدمين',
    'set.tab_printer': 'الطباعة',
    'set.backup_mgmt': 'النسخ الاحتياطي',
    'set.danger_zone': 'منطقة الخطر',
    'set.company_info': 'بيانات المنشأة الهوية',
    'set.company_name': 'اسم الشركة / المحل',
    'set.tax_no': 'الرقم الضريبي',
    'set.phone': 'رقم الهاتف (يظهر في الفاتورة)',
    'set.address': 'العنوان التفصيلي',
    'set.save': 'حفظ التغييرات',
    'set.select_template': 'اختر نموذج طباعة الفاتورة',
    'set.paper_size': 'مقاس الورق الافتراضي',
    'set.paper_a4': 'ورق A4 (طابعة ليزر)',
    'set.paper_a5': 'ورق A5 (نصف صفحة)',
    'set.paper_thermal': 'حراري 80mm',
    'set.paper_thermal_58': 'حراري 58mm',
    'set.export_data': 'تصدير كافة البيانات',
    'set.import_data': 'استيراد نسخة احتياطية',
    'set.download_backup': 'تحميل ملف Backup',
    'set.select_file': 'اختر الملف المستخرج مسبقاً',
    'set.factory_reset': 'إعادة ضبط المصنع (مسح شامل)',
    'set.factory_desc': 'سيتم مسح كافة البيانات (أصناف، عملاء، فواتير) ولا يمكن التراجع!',
    'set.reset_everything': 'مسح كافة بيانات النظام',
    'set.backup_desc': 'احتفظ بنسخة دورية من بياناتك لضمان عدم فقدانها في حال تغيير الجهاز.',
    'set.danger_desc': 'تحتوي هذه المنطقة على عمليات حساسة تؤثر على سلامة البيانات.',

    'user.mgmt_title': 'إدارة مستخدمي النظام وصلاحياتهم',
    'user.add': 'إضافة مستخدم جديد',
    'user.edit': 'تعديل مستخدم',
    'user.fullname': 'الاسم بالكامل',
    'user.username': 'اسم الدخول (Username)',
    'user.password': 'كلمة المرور',
    'user.role': 'الدور الوظيفي',
    'user.permissions': 'الصلاحيات الممنوحة',
    'user.save': 'حفظ بيانات المستخدم',
    'user.delete_confirm': 'هل أنت متأكد من حذف هذا المستخدم؟',

    'perm.VIEW_DASHBOARD': 'رؤية لوحة التحكم والإحصائيات',
    'perm.VIEW_REPORTS': 'الاطلاع على التقارير المالية والتحليلية',
    'perm.MANAGE_SALES': 'إصدار فواتير المبيعات والمرتجع',
    'perm.MANAGE_INVENTORY': 'إدارة المخزون والأصناف',
    'perm.MANAGE_STOCK_TAKE': 'القيام بعملية جرد المخازن',
    'perm.MANAGE_CUSTOMERS': 'إدارة بيانات وحسابات العملاء',
    'perm.MANAGE_SUPPLIERS': 'إدارة بيانات وحسابات الموردين',
    'perm.MANAGE_REPS': 'إدارة المناديب وعمولاتهم',
    'perm.MANAGE_WAREHOUSES': 'إضافة وتعديل المخازن',
    'perm.MANAGE_CASH': 'التعامل مع الخزينة وسندات القبض والصرف',
    'perm.MANAGE_SETTINGS': 'الدخول لإعدادات المدير والنظام',
    'perm.MANAGE_USERS': 'إضافة وحذف المستخدمين وتعديل صلاحياتهم',

    'role.admin': 'مدير نظام (صلاحيات كاملة)',
    'role.user': 'مستخدم عادي',

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
