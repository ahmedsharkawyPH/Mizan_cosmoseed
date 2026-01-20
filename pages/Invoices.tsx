
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

// الحفاظ على 20 صنفاً لضمان سعة الفاتورة
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

    /* --- التعديل: منطقة الإجماليات 3 أسطر فقط --- */
    .totals-box-compact {
        margin-top: 5px;
        border-top: 2px solid #000;
        padding-top: 5px;
    }

    .compact-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
        margin-bottom: 2px;
        font-size: 11px;
    }

    .compact-cell {
        display: flex;
        justify-content: space-between;
        padding: 1px 5px;
        border-bottom: 1px dashed #eee;
    }

    .compact-cell.highlight {
        background: #f1f5f9;
        border-bottom: 1px solid #ccc;
    }

    .final-text-line {
        margin-top: 4px;
        padding: 4px 10px;
        border-top: 1.5px solid #000;
        font-size: 13px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        background: #f8fafc;
        -webkit-print-color-adjust: exact;
    }

    .footer-section {
        margin-top: 5px;
        font-size: 9px;
        text-align: center;
        color: #64748b;
        border-top: 1px dotted #cbd5e1;
        padding-top: 3px;
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
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        direction: rtl;
    }
    .screen-half { width: 50%; height: 100%; border-left: 1px dashed #e2e8f0; }
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
    const title = copyType === 'ORIGINAL' ? 'الأصل' : 'صورة';
    const totalDiscount = (invoice.total_discount || 0) + (invoice.additional_discount || 0);
    const paidCash = db.getInvoicePaidAmount(invoice.id);
    const grandTotal = invoice.net_total + (invoice.previous_balance || 0);

    return (
        <div className="invoice-half-container">
            <div className="watermark">{copyType === 'ORIGINAL' ? 'ORIGINAL' : 'COPY'}</div>
            
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
                        <div className="invoice-type-badge">فاتورة مبيعات</div>
                    </div>
                    <div style={{ fontSize: '10px' }}><b>{title}</b> | {pageNumber}/{totalPages}</div>
                </div>
            </div>

            <div className="meta-grid">
                <div><span style={{color:'#64748b'}}>العميل:</span> <span style={{fontWeight:'bold'}}>{customer?.name}</span></div>
                <div style={{textAlign: 'left'}}><span style={{color:'#64748b'}}>التاريخ:</span> <span>{new Date(invoice.date).toLocaleDateString('en-GB')}</span></div>
                <div><span style={{color:'#64748b'}}>العنوان:</span> <span style={{fontSize: '10px'}}>{customer?.address || '-'}</span></div>
                <div style={{textAlign: 'left', fontSize: '10px'}}>{customer?.phone}</div>
            </div>

            <div className="table-container">
                <table className="invoice-table">
                    <thead>
                        <tr>
                            <th style={{width: '5%'}}>#</th>
                            <th style={{textAlign: 'right'}}>الصنف</th>
                            <th style={{width: '10%'}}>الكمية</th>
                            <th style={{width: '12%'}}>السعر</th>
                            <th style={{width: '15%'}}>الإجمالي</th>
                        </tr>
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
                            <tr key={`empty-${i}`}>
                                <td style={{color:'transparent'}}>.</td><td></td><td></td><td></td><td></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- الإجماليات: 3 أسطر فقط --- */}
            <div className="totals-box-compact">
                {isLastPage ? (
                    <>
                        {/* السطر 1 */}
                        <div className="compact-row">
                            <div className="compact-cell"><span>إجمالي الأصناف:</span><span>{invoice.total_before_discount.toFixed(2)}</span></div>
                            <div className="compact-cell"><span>إجمالي الخصم:</span><span className="text-red-600">-{totalDiscount.toFixed(2)}</span></div>
                            <div className="compact-cell highlight"><b>صافي الفاتورة:</b><b>{invoice.net_total.toFixed(2)}</b></div>
                        </div>
                        {/* السطر 2 */}
                        <div className="compact-row">
                            <div className="compact-cell"><span>رصيد سابق:</span><span>{(invoice.previous_balance || 0).toFixed(2)}</span></div>
                            <div className="compact-cell"><span>المدفوع نقداً:</span><span className="text-emerald-600">{paidCash.toFixed(2)}</span></div>
                            <div className="compact-cell highlight"><span>باقي الفاتورة:</span><span>{(invoice.net_total - paidCash).toFixed(2)}</span></div>
                        </div>
                        {/* السطر 3: نص عادي توفيراً للمساحة */}
                        <div className="final-text-line">
                            <span>الرصيد الإجمالي المستحق بذمة العميل (نهائي):</span>
                            <span>{currency} {(grandTotal - paidCash).toFixed(2)}</span>
                        </div>
                    </>
                ) : (
                    <div style={{textAlign:'center', fontSize:'10px', color:'#64748b'}}>تكملة الأصناف في الصفحة التالية...</div>
                )}
                
                <div className="footer-section">
                    <div style={{display:'flex', justifyContent:'space-between', padding: '0 40px'}}>
                        <span>توقيع المستلم: .....................</span>
                        <span>توقيع الحسابات: .....................</span>
                    </div>
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
    if (location.state && (location.state as any).autoPrintId) {
        const inv = db.getInvoices().find(i => i.id === (location.state as any).autoPrintId);
        if (inv) setSelectedInvoice(inv);
    }
  }, [location]);

  const handlePrint = () => window.print();

  const handleWhatsApp = async (inv: Invoice) => {
    const customer = db.getCustomers().find(c => c.id === inv.customer_id);
    if (!customer?.phone) return alert("لا يوجد رقم هاتف");
    const toastId = toast.loading('جاري التجهيز...');
    setSelectedInvoice(inv);
    setTimeout(async () => {
        const container = document.getElementById('print-container');
        if (!container) return;
        try {
            const firstPageHalf = container.querySelector('.print-half');
            const canvas = await html2canvas(firstPageHalf as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, (canvas.height * 210) / canvas.width);
            pdf.save(`Inv-${inv.invoice_number}.pdf`);
            window.open(`https://wa.me/2${customer.phone.replace(/\D/g, '')}?text=فاتورة رقم ${inv.invoice_number}`, '_blank');
            toast.success('تم', { id: toastId });
        } catch (err) { toast.error('خطأ', { id: toastId }); }
    }, 600);
  };

  const handleDownloadPDF = async () => {
      const container = document.getElementById('print-container');
      if (!container || !selectedInvoice) return;
      setIsExporting(true);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pages = container.querySelectorAll('.landscape-page-wrapper');
      for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i] as HTMLElement, { scale: 2, useCORS: true });
          if (i > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
      }
      pdf.save(`Invoice-${selectedInvoice.invoice_number}.pdf`);
      setIsExporting(false);
  };

  const filtered = invoices.filter(inv => inv.invoice_number.includes(search) || db.getCustomers().find(c => c.id === inv.customer_id)?.name.toLowerCase().includes(search.toLowerCase()));
  const invoicePages = selectedInvoice ? chunkArray(selectedInvoice.items, ITEMS_PER_PAGE) : [];

  return (
    <div className="space-y-6 relative">
      <style>{INVOICE_STYLES}</style>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t('list.title')}</h1>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1">
                <Search className="absolute rtl:right-3 ltr:left-3 top-3 h-5 w-5 text-slate-400" />
                <input type="text" placeholder={t('list.search')} className="rtl:pr-10 ltr:pl-10 pr-4 py-2 border rounded-xl w-full" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => navigate('/invoice/new')} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2"><PlusCircle className="w-5 h-5" />{t('nav.new_invoice')}</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
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
                            <button onClick={() => setSelectedInvoice(inv)} className="p-2 border rounded-lg"><Eye className="w-4 h-4" /></button>
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
                <h3 className="font-bold">Invoice #{selectedInvoice.invoice_number}</h3>
                <div className="flex gap-3">
                    <button onClick={handleDownloadPDF} disabled={isExporting} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm">{isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}PDF</button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"><Printer className="w-4 h-4 mr-1" />طباعة</button>
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
