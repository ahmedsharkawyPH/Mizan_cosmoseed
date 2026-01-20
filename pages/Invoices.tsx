
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Invoice, PaymentStatus } from '../types';
import { FileText, Search, Eye, Edit, X, Printer, FileDown, PlusCircle, MessageCircle, Loader2 } from 'lucide-react';
import { t } from '../utils/t';
import { useNavigate, useLocation } from 'react-router-dom';
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
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; margin-bottom: 8px; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .table-container { flex-grow: 1; min-height: 380px; }
    .invoice-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .invoice-table th { background-color: #1e293b !important; color: white !important; border: 1px solid #334155; padding: 4px; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; }
    .invoice-table td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: center; color: #0f172a; }
    .col-item { text-align: right !important; }

    /* --- التعديل: منطقة الإجماليات المضغوطة 3 أسطر --- */
    .totals-area-ultra-compact {
        margin-top: 5px;
        border-top: 2px solid #000;
        padding-top: 5px;
    }
    .invoice-row-line {
        display: grid;
        grid-template-columns: 1.2fr 1fr 1.5fr;
        gap: 15px;
        margin-bottom: 3px;
        font-size: 11.5px;
        align-items: center;
    }
    .data-cell {
        display: flex;
        justify-content: space-between;
        padding: 1px 0;
    }
    .data-cell.bold-total {
        border-right: 2px solid #000;
        padding-right: 12px;
        font-size: 13px;
    }
    .signature-row {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        padding-top: 4px;
        border-top: 1px dotted #ccc;
        font-size: 10px;
        color: #444;
    }

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

    return (
        <div className="invoice-half-container">
            <div className="header-section">
                <div style={{ flex: 1 }}>
                    <div className="company-name">{settings.companyName}</div>
                    <div style={{fontSize: '9px'}}>{settings.companyAddress}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    {settings.companyLogo && <img src={settings.companyLogo} alt="Logo" style={{ maxHeight: '40px', maxWidth: '80px', objectFit: 'contain' }} />}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                        <span style={{fontFamily:'monospace', fontWeight:'bold', fontSize: '14px'}}>{invoice.invoice_number}</span>
                        <div className="invoice-type-badge">مبيعات</div>
                    </div>
                    <div style={{ fontSize: '10px' }}><b>{title}</b> | {pageNumber}/{totalPages}</div>
                </div>
            </div>

            <div className="meta-grid">
                <div><span style={{color:'#64748b'}}>العميل:</span> <b>{customer?.name}</b></div>
                <div style={{textAlign: 'left'}}><span>التاريخ: {new Date(invoice.date).toLocaleDateString('en-GB')}</span></div>
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
                        {items.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - items.length }).map((_, i) => (
                            <tr key={`empty-${i}`}><td style={{color:'transparent'}}>.</td><td></td><td></td><td></td><td></td></tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- الإجماليات المضغوطة: 3 أسطر فقط --- */}
            <div className="totals-area-ultra-compact">
                {isLastPage ? (
                    <>
                        {/* السطر 1: ملخص الفاتورة الحالية */}
                        <div className="invoice-row-line">
                            <div className="data-cell"><span>إجمالي الفاتورة:</span><span>{invoice.total_before_discount.toFixed(2)}</span></div>
                            <div className="data-cell"><span>الخصم:</span><span className="text-red-600">-{totalDiscount.toFixed(2)}</span></div>
                            <div className="data-cell" style={{fontWeight:'bold'}}><span>صافي الفاتورة:</span><span>{invoice.net_total.toFixed(2)}</span></div>
                        </div>

                        {/* السطر 2: الحساب السابق والمدفوع والإجمالي المطلوب (في صف واحد كما طلبت) */}
                        <div className="invoice-row-line">
                            <div className="data-cell"><span>حساب سابق:</span><span>{(invoice.previous_balance || 0).toFixed(2)}</span></div>
                            <div className="data-cell"><span>المدفوع نقداً:</span><span className="text-emerald-600">{paidCash.toFixed(2)}</span></div>
                            <div className="data-cell bold-total">
                                <b>المطلوب سداده نهائياً:</b>
                                <b>{currency} {finalBalance.toFixed(2)}</b>
                            </div>
                        </div>

                        {/* السطر 3: التوقيعات والملاحظات */}
                        <div className="signature-row">
                            <span>ملاحظات: {invoice.notes || 'لا يوجد'}</span>
                            <div style={{display:'flex', gap: '40px'}}>
                                <span>توقيع المستلم: .....................</span>
                                <span>توقيع الحسابات: .....................</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{textAlign:'center', fontSize:'10px', color:'#64748b'}}>تكملة الأصناف في الصفحة التالية...</div>
                )}
            </div>
        </div>
    );
};

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const settings = db.getSettings();
  const currency = settings.currency;

  useEffect(() => {
    setInvoices(db.getInvoices());
    if (location.state && (location.state as any).autoPrintId) {
        const inv = db.getInvoices().find(i => i.id === (location.state as any).autoPrintId);
        if (inv) setSelectedInvoice(inv);
    }
  }, [location]);

  const handlePrint = () => window.print();
  const handleWhatsApp = async (inv: Invoice) => {
    const customer = db.getCustomers().find(c => c.id === inv.customer_id);
    if (!customer?.phone) return alert("لا يوجد هاتف");
    setSelectedInvoice(inv);
    setTimeout(() => window.open(`https://wa.me/2${customer.phone.replace(/\D/g, '')}?text=فاتورة رقم ${inv.invoice_number}`, '_blank'), 500);
  };

  const filtered = invoices.filter(inv => inv.invoice_number.includes(search) || db.getCustomers().find(c => c.id === inv.customer_id)?.name.toLowerCase().includes(search.toLowerCase()));
  const invoicePages = selectedInvoice ? chunkArray(selectedInvoice.items, ITEMS_PER_PAGE) : [];

  return (
    <div className="space-y-6 relative">
      <style>{INVOICE_STYLES}</style>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t('list.title')}</h1>
        <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input type="text" placeholder="بحث..." className="pr-10 pl-4 py-2 border rounded-xl" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <button onClick={() => navigate('/invoice/new')} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2"><PlusCircle className="w-5 h-5" />فاتورة جديدة</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border overflow-hidden">
        <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr><th className="px-6 py-4">#</th><th className="px-6 py-4">التاريخ</th><th className="px-6 py-4">العميل</th><th className="px-6 py-4">الإجمالي</th><th className="px-6 py-4 text-center">إجراء</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {filtered.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 group">
                        <td className="px-6 py-4 font-mono font-medium">{inv.invoice_number}</td>
                        <td className="px-6 py-4">{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                        <td className="px-6 py-4 font-medium">{db.getCustomers().find(c => c.id === inv.customer_id)?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 font-bold">{currency}{inv.net_total.toFixed(2)}</td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                                <button onClick={() => setSelectedInvoice(inv)} className="p-2 border rounded-lg hover:bg-gray-100"><Eye className="w-4 h-4" /></button>
                                <button onClick={() => handleWhatsApp(inv)} className="p-2 border rounded-lg text-emerald-600"><MessageCircle className="w-4 h-4" /></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
            <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm print-hidden sticky top-0 z-50">
                <h3 className="font-bold">معاينة فاتورة مبيعات #{selectedInvoice.invoice_number}</h3>
                <div className="flex gap-3">
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Printer className="w-4 h-4" />طباعة</button>
                    <button onClick={() => setSelectedInvoice(null)} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">إغلاق</button>
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
