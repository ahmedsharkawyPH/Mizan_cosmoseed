
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

// تم الحفاظ على 20 صنفاً بناءً على التعديل السابق
const ITEMS_PER_PAGE = 20; 

// --- STYLES ---
const INVOICE_STYLES = `
    .invoice-modal-content {
        background-color: #f3f4f6;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        overflow: auto;
    }

    /* Common Styles for the Invoice Half */
    .invoice-half-container {
        font-family: 'Cairo', 'Arial', sans-serif;
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 8mm; 
        box-sizing: border-box;
        position: relative;
        direction: rtl; 
        background: white;
    }

    .header-section {
        border-bottom: 2px solid #333;
        padding-bottom: 5px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .company-name {
        font-size: 18px;
        font-weight: 900;
        color: #000;
        line-height: 1.2;
    }

    .invoice-type-badge {
        font-size: 12px;
        font-weight: bold;
        border: 2px solid #000;
        padding: 2px 10px;
        border-radius: 6px;
        background: #f0f0f0;
        display: inline-block;
    }

    .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        font-size: 11px;
        margin-bottom: 8px;
        background: #f8fafc;
        padding: 6px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
    }

    .table-container {
        flex-grow: 1;
        min-height: 380px; 
    }

    .invoice-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
    }

    .invoice-table th {
        background-color: #1e293b !important; 
        color: white !important;
        border: 1px solid #334155;
        padding: 4px;
        font-weight: bold;
        text-align: center;
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact;
    }

    .invoice-table td {
        border: 1px solid #cbd5e1;
        padding: 3px 5px;
        text-align: center;
        color: #0f172a;
    }

    .col-item { text-align: right !important; }

    .totals-box {
        margin-top: auto; 
        border-top: 2px solid #000;
        padding-top: 5px;
        font-size: 11px;
    }

    .totals-grid {
        display: flex;
        justify-content: flex-end;
        gap: 20px;
        align-items: flex-start;
    }

    .total-row {
        display: flex;
        justify-content: space-between;
        width: 160px;
        margin-bottom: 2px;
    }

    .total-row.final {
        font-weight: 900;
        font-size: 14px;
        border-top: 1px dashed #999;
        margin-top: 4px;
        padding-top: 4px;
        background: #f1f5f9;
        -webkit-print-color-adjust: exact;
    }

    .footer-section {
        margin-top: 8px;
        font-size: 9px;
        text-align: center;
        color: #64748b;
        border-top: 1px dotted #cbd5e1;
        padding-top: 5px;
    }

    .watermark {
        position: absolute;
        top: 40%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 60px;
        font-weight: bold;
        color: rgba(0, 0, 0, 0.03);
        pointer-events: none;
        white-space: nowrap;
        z-index: 0;
    }

    @media print {
        @page { size: A4 landscape; margin: 0; }
        body { background: white; }
        body * { visibility: hidden; }
        #print-container, #print-container * { visibility: visible; }
        #print-container { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: white; }
        .landscape-page-wrapper { display: flex; width: 297mm; height: 210mm; page-break-after: always; direction: rtl; overflow: hidden; }
        .landscape-page-wrapper:last-child { page-break-after: auto; }
        .print-half { width: 50%; height: 100%; border-left: 1px dashed #94a3b8; }
        .print-half:last-child { border-left: none; }
        .print-hidden { display: none !important; }
    }

    .screen-preview-wrapper {
        width: 297mm;
        height: 210mm;
        background: white;
        margin-bottom: 20px;
        display: flex;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        direction: rtl;
    }
    .screen-half { width: 50%; height: 100%; border-left: 1px dashed #e2e8f0; }
    
    #whatsapp-pdf-container {
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 210mm;
        background: white;
    }
`;

const chunkArray = (array: any[], size: number) => {
    if (!array || array.length === 0) return [];
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

const InvoiceHalf = ({ 
    items, 
    pageNumber, 
    totalPages, 
    invoice, 
    customer, 
    settings, 
    currency, 
    isLastPage,
    startIndex,
    copyType 
}: any) => {
    const title = copyType === 'ORIGINAL' ? ' الأصل' : 'صورة';
    
    return (
        <div className="invoice-half-container">
            <div className="watermark">{copyType === 'ORIGINAL' ? 'ORIGINAL' : 'COPY'}</div>
            
            {/* Header Section Updated */}
            <div className="header-section">
                {/* Right Side: Company Details */}
                <div style={{ flex: 1 }}>
                    <div className="company-name">{settings.companyName}</div>
                    <div style={{fontSize: '9px', color:'#334155'}}>{settings.companyAddress}</div>
                    <div style={{fontSize: '9px', color:'#334155'}}>{settings.companyPhone}</div>
                </div>

                {/* Center: Company Logo */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {settings.companyLogo && (
                        <img src={settings.companyLogo} alt="Logo" style={{ maxHeight: '50px', maxWidth: '120px', objectFit: 'contain' }} />
                    )}
                </div>

                {/* Left Side: Invoice Meta Data */}
                <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                        <span style={{fontFamily:'monospace', fontWeight:'bold', fontSize: '13px'}}>{invoice.invoice_number}</span>
                        <div className="invoice-type-badge" style={{ margin: 0 }}>فاتورة مبيعات</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', fontSize: '10px' }}>
                        <span style={{ fontWeight: 'bold', border: '1px solid #000', padding: '0 4px', borderRadius: '3px' }}>{title}</span>
                        <span style={{ color: '#64748b' }}>صفحة {pageNumber} من {totalPages}</span>
                    </div>
                </div>
            </div>

            <div className="meta-grid">
                <div><span style={{color:'#64748b'}}>العميل:</span> <span style={{fontWeight:'bold'}}>{customer?.name}</span></div>
                <div style={{textAlign: 'left'}}><span style={{color:'#64748b'}}>التاريخ:</span> <span>{new Date(invoice.date).toLocaleDateString('en-GB')}</span></div>
                <div><span style={{color:'#64748b'}}>العنوان:</span> <span style={{fontSize: '10px'}}>{customer?.address || '-'}</span>{customer?.phone && <span style={{color:'#64748b', marginRight: '8px'}}> | ت: {customer.phone}</span>}</div>
                <div style={{textAlign: 'left', fontSize: '9px', color: '#64748b'}}>{new Date(invoice.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            </div>

            <div className="table-container">
                <table className="invoice-table">
                    <thead>
                        <tr>
                            <th style={{width: '5%'}}>#</th>
                            <th style={{textAlign: 'right'}}>الصنف</th>
                            <th style={{width: '10%'}}>الكمية</th>
                            <th style={{width: '12%'}}>السعر</th>
                            <th style={{width: '10%'}}>الخصم</th>
                            <th style={{width: '15%'}}>الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any, idx: number) => {
                            const price = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
                            const gross = item.quantity * price;
                            const val = gross - (gross * ((item.discount_percentage || 0) / 100));
                            return (
                                <tr key={idx}>
                                    <td>{startIndex + idx + 1}</td>
                                    <td className="col-item">{item.product.name}</td>
                                    <td>{item.quantity}</td>
                                    <td>{price.toFixed(2)}</td>
                                    <td>{item.discount_percentage > 0 ? `%${item.discount_percentage}` : '-'}</td>
                                    <td style={{fontWeight: 'bold'}}>{val.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                        {items.length < ITEMS_PER_PAGE && Array.from({ length: ITEMS_PER_PAGE - items.length }).map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td style={{color:'transparent'}}>.</td><td></td><td></td><td></td><td></td><td></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="totals-box">
                {isLastPage ? (
                    <div className="totals-grid">
                        <div style={{flex: 1, fontSize:'9px', color:'#64748b'}}>
                            <div>بواسطة: {invoice.created_by_name || 'Admin'}</div>
                            <div>ملاحظات: {invoice.notes || '-'}</div>
                        </div>
                        <div>
                            <div className="total-row"><span>الإجمالي:</span><span>{currency} {invoice.total_before_discount.toFixed(2)}</span></div>
                            {(invoice.total_discount > 0 || (invoice.additional_discount || 0) > 0) && (
                                <div className="total-row" style={{color: '#dc2626'}}><span>إجمالي الخصم:</span><span>- {currency} {(invoice.total_discount + (invoice.additional_discount || 0)).toFixed(2)}</span></div>
                            )}
                            <div className="total-row final"><span>الصافي:</span><span>{currency} {invoice.net_total.toFixed(2)}</span></div>
                        </div>
                        <div style={{borderRight: '1px solid #ccc', paddingRight: '15px'}}>
                            <div className="total-row"><span>المدفوع:</span><span>{currency} {db.getInvoicePaidAmount(invoice.id).toFixed(2)}</span></div>
                            <div className="total-row"><span>المتبقي:</span><span>{currency} {(invoice.net_total - db.getInvoicePaidAmount(invoice.id)).toFixed(2)}</span></div>
                        </div>
                    </div>
                ) : (
                    <div style={{textAlign:'center', fontSize:'10px', fontStyle:'italic', padding:'10px'}}>يتبع في الصفحة التالية...</div>
                )}
                <div className="footer-section">
                    <p>البضاعة المباعة لا ترد ولا تستبدل بعد 14 يوم - {title}</p>
                    <div style={{display:'flex', justifyContent:'space-between', marginTop: '10px', padding: '0 20px'}}><span>المستلم: ....................</span><span>أمين المخزن: ....................</span></div>
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
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const settings = db.getSettings();
  const currency = settings.currency;

  useEffect(() => {
    setInvoices(db.getInvoices());
    if (location.state) {
        const state = location.state as any;
        if (state.autoPrintId) {
            const id = state.autoPrintId;
            const inv = db.getInvoices().find(i => i.id === id);
            if (inv) setSelectedInvoice(inv);
        }
    }
  }, [location]);

  const handlePrint = () => window.print();

  const handleWhatsApp = async (inv: Invoice) => {
    const customer = db.getCustomers().find(c => c.id === inv.customer_id);
    if (!customer?.phone) return alert("لا يوجد رقم هاتف مسجل لهذا العميل");

    const toastId = toast.loading('جاري تجهيز الفاتورة PDF والواتساب...');
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const container = document.getElementById('whatsapp-pdf-container');
    if (!container) return;

    const fileName = `Invoice-${inv.invoice_number}.pdf`;
    pdf.save(fileName);
    
    const message = `*عزيزي العميل ${customer.name}*\n` +
                    `تم إصدار فاتورة مبيعات رقم: ${inv.invoice_number}\n` +
                    `بمبلغ إجمالي: ${inv.net_total.toFixed(2)} ${currency}\n\n` +
                    `📥 *يرجى إرفاق ملف الـ PDF الذي تم تحميله الآن في هذه المحادثة.*`;

    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`;
    
    toast.success('تم تحميل الفاتورة، يرجى إرفاقها في الواتساب', { id: toastId });
    window.open(`https://wa.me/${finalPhone}?text=${encodedMsg}`, '_blank');
  };

  const handleDownloadPDF = async () => {
      const container = document.getElementById('print-container');
      if (!container || !selectedInvoice) return;
      setIsExporting(true);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pages = container.querySelectorAll('.landscape-page-wrapper');
      for (let i = 0; i < pages.length; i++) {
          try {
              const canvas = await html2canvas(pages[i] as HTMLElement, { scale: 2, useCORS: true });
              const imgData = canvas.toDataURL('image/png');
              if (i > 0) pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
          } catch (err) { console.error(err); }
      }
      pdf.save(`Invoice-${selectedInvoice.invoice_number}.pdf`);
      setIsExporting(false);
  };

  const filtered = invoices.filter(inv => inv.invoice_number.includes(search) || db.getCustomers().find(c => c.id === inv.customer_id)?.name.toLowerCase().includes(search.toLowerCase()));
  const invoicePages = selectedInvoice ? chunkArray(selectedInvoice.items, ITEMS_PER_PAGE) : [];

  return (
    <div className="space-y-6 relative">
      <style>{INVOICE_STYLES}</style>
      
      <div id="whatsapp-pdf-container"></div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800">{t('list.title')}</h1><p className="text-sm text-slate-500 mt-1">Manage and view your sales history</p></div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:flex-none">
                <Search className="absolute rtl:right-3 ltr:left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input type="text" placeholder={t('list.search')} className="rtl:pr-10 ltr:pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-80 outline-none shadow-sm transition-shadow" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => navigate('/invoice/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2 shrink-0"><PlusCircle className="w-5 h-5" /><span className="hidden sm:inline">{t('nav.new_invoice')}</span></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left rtl:text-right min-w-[800px]">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                <tr>
                <th className="px-6 py-4 font-bold tracking-wider w-32">#</th>
                <th className="px-6 py-4 font-bold tracking-wider w-32">{t('cash.date')}</th>
                <th className="px-6 py-4 font-bold tracking-wider">{t('common.customer')}</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right rtl:text-left w-32">{t('inv.total')}</th>
                <th className="px-6 py-4 font-bold tracking-wider text-right rtl:text-left w-32">{t('inv.profit')}</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center w-32">{t('list.status')}</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center w-32">{t('common.action')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {filtered.map(inv => {
                const customerName = db.getCustomers().find(c => c.id === inv.customer_id)?.name || 'Unknown';
                const isReturn = inv.type === 'RETURN';
                const profit = db.getInvoiceProfit(inv);
                return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-mono font-medium text-slate-600 group-hover:text-blue-600 transition-colors">{inv.invoice_number}{isReturn && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">RET</span>}</td>
                    <td className="px-6 py-4 text-slate-500"><div>{new Date(inv.date).toLocaleDateString('en-GB')}</div><div dir="ltr" className="text-xs text-slate-400 font-mono mt-0.5 inline-block">{new Date(inv.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></td>
                    <td className="px-6 py-4 font-medium text-slate-800">{customerName}</td>
                    <td className={`px-6 py-4 text-right rtl:text-left font-bold ${isReturn ? 'text-red-600' : 'text-slate-900'}`}>{currency}{inv.net_total.toFixed(2)}</td>
                    <td className={`px-6 py-4 text-right rtl:text-left font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency}{profit.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${inv.payment_status === PaymentStatus.PAID ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : inv.payment_status === PaymentStatus.PARTIAL ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{inv.payment_status === 'PAID' ? t('status.paid') : inv.payment_status === 'PARTIAL' ? t('status.partial') : t('status.unpaid')}</span></td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setSelectedInvoice(inv)} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors shadow-sm" title={t('list.view')}><Eye className="w-4 h-4" /></button>
                            <button onClick={() => handleWhatsApp(inv)} className="p-2 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors shadow-sm" title="إرسال PDF عبر واتساب"><MessageCircle className="w-4 h-4" /></button>
                            {!isReturn && <button onClick={() => navigate(`/invoice/edit/${inv.id}`)} className="p-2 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors shadow-sm" title={t('list.edit')}><Edit className="w-4 h-4" /></button>}
                        </div>
                    </td>
                    </tr>
                );
                })}
            </tbody>
            </table>
        </div>
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-100" style={{zIndex: 9999}}>
            <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm print-hidden sticky top-0 z-50">
                <h3 className="font-bold text-gray-800">Invoice #{selectedInvoice.invoice_number} ({invoicePages.length} Pages)</h3>
                <div className="flex gap-3">
                    <button onClick={() => handleWhatsApp(selectedInvoice)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-bold text-sm shadow-sm"><MessageCircle className="w-4 h-4" /><span>WhatsApp PDF</span></button>
                    <button onClick={handleDownloadPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-bold text-sm shadow-sm disabled:opacity-50">{isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-4 h-4" />}<span>Save PDF</span></button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors"><Printer className="w-4 h-4" /><span>{t('common.print')} (Landscape)</span></button>
                    <button onClick={() => setSelectedInvoice(null)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors font-bold text-sm"><X className="w-4 h-4" /><span>{t('common.close')}</span></button>
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
