
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { Invoice, PaymentStatus } from '../types';
import { FileText, Search, Eye, Edit, X, Printer, FileDown, PlusCircle, MessageCircle, Loader2, Trash2, Download, Filter } from 'lucide-react';
import { t } from '../utils/t';
import { useNavigate, useLocation } from 'react-router-dom';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 20; 

const INVOICE_STYLES = `
    .invoice-modal-content { background-color: #f3f4f6; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 20px; overflow: auto; }
    .invoice-half-container { font-family: 'Cairo', 'Arial', sans-serif; display: flex; flex-direction: column; height: 100%; padding: 8mm; box-sizing: border-box; position: relative; direction: rtl; background: white; }
    .header-section { border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .company-name { font-size: 18px; font-weight: 900; color: #000; line-height: 1.2; }
    .invoice-type-badge { font-size: 12px; font-weight: bold; border: 2px solid #000; padding: 2px 10px; border-radius: 6px; background: #f0f0f0; display: inline-block; }
    .meta-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 4px; font-size: 11px; margin-bottom: 8px; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .table-container { flex-grow: 1; display: flex; flex-direction: column; }
    .invoice-half-container .invoice-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .invoice-half-container .invoice-table th { background-color: #1e293b !important; color: white !important; border: 1px solid #334155; padding: 4px; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; }
    .invoice-half-container .invoice-table td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: center; color: #0f172a; }
    .col-item { text-align: right !important; }
    .totals-area-ultra-compact { margin-top: auto; border-top: 2.5px solid #000; padding-top: 5px; }
    .compact-line-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 3px; font-size: 11px; }
    .cell-box { display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px dashed #ddd; }
    .final-bold-text-line { margin-top: 4px; padding: 4px 8px; border: 1.5px solid #000; font-size: 13px; font-weight: 900; display: flex; justify-content: space-between; background: #fcfcfc; }
    .footer-signatures { margin-top: 6px; font-size: 9px; display: flex; justify-content: space-between; padding: 0 20px; color: #444; }

    @media print {
        @page { size: A4 landscape; margin: 0; }
        body * { visibility: hidden; }
        #print-container, #print-container * { visibility: visible; }
        #print-container { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: white; }
        .landscape-page-wrapper { display: flex; width: 297mm; height: 210mm; page-break-after: always; direction: rtl; }
        .print-half { width: 50%; height: 100%; border-left: 1px dashed #94a3b8; }
    }
    .screen-preview-wrapper { width: 297mm; height: 210mm; background: white; margin-bottom: 20px; display: flex; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); direction: rtl; }
    .screen-half { width: 50%; height: 100%; border-left: 1px dashed #e2e8f0; }
`;

const chunkArray = (array: any[], size: number) => {
    if (!array || array.length === 0) return [];
    const chunked = [];
    for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
    return chunked;
};

const InvoiceHalf = ({ items, pageNumber, totalPages, invoice, customer, settings, currency, isLastPage, startIndex, copyType }: any) => {
    const title = copyType === 'ORIGINAL' ? 'الأصل' : 'صورة';
    const totalDiscount = (invoice.total_discount || 0) + (invoice.additional_discount || 0);
    const paidCash = db.getInvoicePaidAmount(invoice.id);
    const finalBalance = invoice.net_total + (invoice.previous_balance || 0) - paidCash;
    const invoiceDate = new Date(invoice.date);

    return (
        <div className="invoice-half-container">
            <div className="header-section">
                <div style={{ flex: 1 }}>
                    <div className="company-name">{settings.companyName}</div>
                    <div style={{fontSize: '9px'}}>{settings.companyAddress}</div>
                    <div style={{fontSize: '9px'}}>{settings.companyPhone}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    {settings.companyLogo && <img src={settings.companyLogo} alt="Logo" style={{ maxHeight: '45px', maxWidth: '90px', objectFit: 'contain' }} />}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                        <span style={{fontFamily:'monospace', fontWeight:'bold', fontSize: '14px'}}>{invoice.invoice_number}</span>
                        <div className="invoice-type-badge">{invoice.type === 'RETURN' ? 'مرتجع مبيعات' : 'فاتورة مبيعات'}</div>
                    </div>
                    <div style={{ fontSize: '10px', marginTop: '2px' }}><b>{title}</b> | صفحة {pageNumber}/{totalPages}</div>
                </div>
            </div>

            <div className="meta-grid">
                <div>
                    <div style={{ marginBottom: '2px' }}><span style={{color:'#64748b'}}>العميل:</span> <b>{customer?.name}</b></div>
                    {customer?.phone && <div style={{ fontSize: '9px', color: '#475569', fontWeight: '500' }}>ت: {customer.phone}</div>}
                    {customer?.address && <div style={{ fontSize: '9px', color: '#475569', fontWeight: '500' }}>ع: {customer.address}</div>}
                </div>
                <div style={{textAlign: 'left', alignSelf: 'start'}}>
                    <div style={{ fontWeight: 'bold' }}>التاريخ: {invoiceDate.toLocaleDateString('en-GB')}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>الوقت: {invoiceDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                    {invoice.created_by_name && <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>البائع: {invoice.created_by_name}</div>}
                </div>
            </div>

            <div className="table-container">
                <table className="invoice-table">
                    <thead>
                        <tr><th style={{width: '5%'}}>#</th><th style={{textAlign: 'right'}}>الصنف</th><th style={{width: '10%'}}>الكمية</th><th style={{width: '12%'}}>السعر</th><th style={{width: '15%'}}>الإجمالي</th></tr>
                    </thead>
                    <tbody>
                        {items.map((item: any, idx: number) => {
                            const price = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || 0);
                            const val = item.quantity * price * (1 - (item.discount_percentage || 0) / 100);
                            return (
                                <tr key={idx}>
                                    <td>{startIndex + idx + 1}</td>
                                    <td className="col-item">{item.product.name}</td>
                                    <td>{item.quantity}</td>
                                    <td>{price.toFixed(2)}</td>
                                    <td style={{fontWeight: 'bold'}}>{val.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="totals-area-ultra-compact">
                {isLastPage ? (
                    <>
                        <div className="cell-box" style={{ borderBottom: '1.5px solid #000', marginBottom: '4px', background: '#fefce8' }}>
                            <span style={{ fontWeight: 'bold' }}>الحساب السابق المستحق على العميل:</span>
                            <span style={{ fontWeight: '900', fontSize: '12px' }}>{currency} {(invoice.previous_balance || 0).toFixed(2)}</span>
                        </div>
                        <div className="compact-line-row">
                            <div className="cell-box"><span>إجمالي الأصناف:</span><span>{invoice.total_before_discount.toFixed(2)}</span></div>
                            <div className="cell-box"><span>إجمالي الخصم:</span><span className="text-red-600">-{totalDiscount.toFixed(2)}</span></div>
                            <div className="cell-box" style={{background:'#f8fafc'}}><b>صافي الفاتورة:</b><b>{invoice.net_total.toFixed(2)}</b></div>
                        </div>
                        <div className="compact-line-row">
                            <div className="cell-box"><span>حساب سابق:</span><span>{(invoice.previous_balance || 0).toFixed(2)}</span></div>
                            <div className="cell-box"><span>المدفوع نقداً:</span><span className="text-emerald-600">{paidCash.toFixed(2)}</span></div>
                            <div className="cell-box" style={{background:'#f8fafc'}}><span>المطلوب سداده:</span><span>{finalBalance.toFixed(2)}</span></div>
                        </div>
                        <div className="final-bold-text-line">
                            <span>الرصيد الإجمالي المستحق بذمة العميل (الجديد):</span>
                            <span>{currency} {finalBalance.toFixed(2)}</span>
                        </div>
                    </>
                ) : (
                    <div style={{textAlign:'center', fontSize:'10px', color:'#64748b', padding: '10px 0'}}>تكملة الأصناف في الصفحة التالية...</div>
                )}
                <div className="footer-signatures">
                    <span>توقيع المستلم: ..........................</span>
                    <span>توقيع الحسابات: ..........................</span>
                </div>
            </div>
        </div>
    );
};

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SALE' | 'RETURN'>('ALL'); 
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const settings = db.getSettings();
  const currency = settings.currency;

  const loadData = () => {
    setInvoices(db.getInvoices());
  };

  useEffect(() => {
    loadData();
    if (location.state && (location.state as any).autoPrintId) {
        const inv = db.getInvoices().find(i => i.id === (location.state as any).autoPrintId);
        if (inv) setSelectedInvoice(inv);
    }
  }, [location]);

  const handleDeleteInvoice = async (id: string) => {
    const res = await db.deleteInvoice(id);
    if (res.success) {
        toast.success("تم حذف الفاتورة بنجاح");
        loadData();
    } else {
        toast.error(res.message || "فشل حذف الفاتورة");
    }
    setInvoiceToDelete(null);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-container');
    if (!element) return;
    setIsExporting(true);
    const toastId = toast.loading('جاري إنشاء ملف PDF...');
    try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Invoice_${selectedInvoice?.invoice_number}.pdf`);
        toast.success('تم تحميل الفاتورة بنجاح', { id: toastId });
        return true;
    } catch (err) {
        toast.error('فشل تصدير الفاتورة', { id: toastId });
        return false;
    } finally {
        setIsExporting(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!selectedInvoice) return;
    const customer = db.getCustomers().find(c => c.id === selectedInvoice.customer_id);
    if (!customer?.phone) { toast.error('رقم هاتف العميل غير مسجل'); return; }
    const success = await handleDownloadPDF();
    if (success) {
        const cleanPhone = customer.phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`;
        const message = `*عزيزي العميل ${customer.name}*\nمرفق فاتورة رقم: *${selectedInvoice.invoice_number}*\nإجمالي المطلوب: *${selectedInvoice.net_total.toFixed(2)} ${currency}*\n\n📥 *يرجى إرفاق ملف الـ PDF الذي تم تحميله الآن في هذه المحادثة.*`;
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const customerName = db.getCustomers().find(c => c.id === inv.customer_id)?.name.toLowerCase() || '';
      const matchSearch = inv.invoice_number.includes(search) || customerName.includes(search.toLowerCase());
      const matchType = typeFilter === 'ALL' || inv.type === typeFilter;
      return matchSearch && matchType;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, search, typeFilter]);

  const invoicePages = selectedInvoice ? chunkArray(selectedInvoice.items, ITEMS_PER_PAGE) : [];

  return (
    <div className="space-y-6 relative">
      <style>{INVOICE_STYLES}</style>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800">{t('list.title')}</h1>
            <p className="text-xs text-slate-400 font-bold mt-1">تتبع كافة العمليات التجارية الصادرة والواردة</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                <button 
                    onClick={() => setTypeFilter('ALL')}
                    className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${typeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    الكل
                </button>
                <button 
                    onClick={() => setTypeFilter('SALE')}
                    className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${typeFilter === 'SALE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    مبيعات فقط
                </button>
                <button 
                    onClick={() => setTypeFilter('RETURN')}
                    className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${typeFilter === 'RETURN' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    مرتجع فقط
                </button>
            </div>

            <div className="relative flex-1 md:flex-none">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="رقم الفاتورة أو العميل..." className="pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 font-bold" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            
            <button onClick={() => navigate('/invoice/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-black shadow-lg shadow-blue-100 transition-all active:scale-95"><PlusCircle className="w-5 h-5" />فاتورة جديدة</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4">رقم الفاتورة</th>
                        <th className="px-6 py-4 text-center">التاريخ</th>
                        <th className="px-6 py-4">العميل</th>
                        <th className="px-6 py-4 text-center">النوع</th>
                        <th className="px-6 py-4 text-center" title="حالة المزامنة">سحابة</th>
                        <th className="px-6 py-4 text-left">صافي الفاتورة</th>
                        <th className="px-6 py-4 text-left">الربح</th>
                        <th className="px-6 py-4 text-left">المسدد</th>
                        <th className="px-6 py-4 text-center">الإجراء</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filtered.map(inv => {
                        const paid = db.getInvoicePaidAmount(inv.id);
                        return (
                            <tr key={inv.id} className="hover:bg-blue-50/30 group transition-colors font-bold">
                                <td className="px-6 py-4 font-mono text-slate-600">{inv.invoice_number}</td>
                                <td className="px-6 py-4 text-center text-slate-500">{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                                <td className="px-6 py-4 font-black text-slate-800">{db.getCustomers().find(c => c.id === inv.customer_id)?.name || 'غير معروف'}</td>
                                <td className="px-6 py-4 text-center">
                                    {inv.type === 'SALE' ? (
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">مبيعات</span>
                                    ) : (
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-100">مرتجع مبيعات</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <SyncStatusIndicator status={inv.sync_status} error={inv.sync_error} />
                                </td>
                                <td className="px-6 py-4 text-left font-black text-slate-900">{currency}{inv.net_total.toFixed(2)}</td>
                                {(() => {
                                    const itemsProfit = inv.items.reduce((acc, item) => {
                                        const sellPrice = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || 0);
                                        const costPrice = item.batch?.purchase_price || item.product.purchase_price || 0;
                                        const revenue = (item.quantity * sellPrice) * (1 - (item.discount_percentage || 0) / 100);
                                        const cost = (item.quantity + (item.bonus_quantity || 0)) * costPrice;
                                        return acc + (revenue - cost);
                                    }, 0);
                                    const invoiceProfit = itemsProfit - (inv.additional_discount || 0);
                                    const finalProfit = inv.type === 'SALE' ? invoiceProfit : -invoiceProfit;
                                    return (
                                        <td className={`px-6 py-4 text-left font-black ${finalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {currency}{finalProfit.toFixed(2)}
                                        </td>
                                    );
                                })()}
                                <td className="px-6 py-4 text-left font-black text-emerald-600">{currency}{paid.toFixed(2)}</td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => setSelectedInvoice(inv)} className="p-2 border border-slate-100 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600 shadow-sm transition-all" title="معاينة"><Eye className="w-4 h-4" /></button>
                                        <button onClick={() => navigate(`/invoice/edit/${inv.id}`)} className="p-2 border border-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm transition-all" title="تعديل"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => setInvoiceToDelete(inv)} className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm transition-all" title="حذف"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {filtered.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-20 text-center text-slate-300">
                                <div className="flex flex-col items-center gap-2">
                                    <Filter className="w-12 h-12 opacity-10" />
                                    <p className="font-black">لا توجد فواتير مطابقة للبحث أو التصفية الحالية</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {invoiceToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border-2 border-red-100 animate-in zoom-in duration-200">
                  <div className="p-8 bg-red-50 text-red-700 flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                          <Trash2 className="w-10 h-10 text-red-600" />
                      </div>
                      <h3 className="text-2xl font-black mb-2">تأكيد حذف الفاتورة</h3>
                      <p className="text-sm font-bold text-red-600/70">هل أنت متأكد من حذف الفاتورة رقم {invoiceToDelete.invoice_number}؟</p>
                      <p className="text-[10px] mt-2 text-red-500 font-black uppercase tracking-widest">سيتم التراجع عن كافة التأثيرات المالية والمخزنية</p>
                  </div>

                  <div className="p-8 space-y-4">
                      <button 
                          onClick={() => handleDeleteInvoice(invoiceToDelete.id)}
                          className="w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95"
                      >
                          تأكيد الحذف النهائي
                      </button>
                      <button 
                          onClick={() => setInvoiceToDelete(null)}
                          className="w-full py-4 text-slate-400 font-black hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all"
                      >
                          إلغاء
                      </button>
                  </div>
              </div>
          </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 overflow-hidden">
            <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm print-hidden sticky top-0 z-50">
                <h3 className="font-black text-slate-800">معاينة الفاتورة #{selectedInvoice.invoice_number}</h3>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-slate-700 transition-colors"><Printer className="w-4 h-4" />طباعة</button>
                    <button onClick={handleDownloadPDF} disabled={isExporting} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-red-700 transition-colors disabled:opacity-50"><Download className="w-4 h-4" /> PDF</button>
                    <button onClick={handleWhatsApp} disabled={isExporting} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50"><MessageCircle className="w-4 h-4" /> واتساب</button>
                    <button onClick={() => setSelectedInvoice(null)} className="bg-gray-200 px-6 py-2 rounded-lg font-bold text-gray-700 hover:bg-gray-300 transition-colors">إغلاق</button>
                </div>
            </div>
            <div className="invoice-modal-content">
                <div id="print-container">
                    {invoicePages.map((pageItems, index) => (
                        <div key={index} className="landscape-page-wrapper screen-preview-wrapper">
                            <div className="print-half screen-half"><InvoiceHalf items={pageItems} pageNumber={index + 1} totalPages={invoicePages.length} invoice={selectedInvoice} customer={db.getCustomers().find(c => c.id === selectedInvoice.customer_id)} settings={settings} currency={currency} isLastPage={index === invoicePages.length - 1} startIndex={index * ITEMS_PER_PAGE} copyType="ORIGINAL" /></div>
                            <div className="print-half screen-half"><InvoiceHalf items={pageItems} pageNumber={index + 1} totalPages={invoicePages.length} invoice={selectedInvoice} customer={db.getCustomers().find(c => c.id === selectedInvoice.customer_id)} settings={settings} currency={currency} isLastPage={index === invoicePages.length - 1} startIndex={index * ITEMS_PER_PAGE} copyType="COPY" /></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
export default Invoices;
