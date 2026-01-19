
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Customer } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Upload, FileText, X, Printer, User, ShieldAlert, BarChart3, Users, ArrowUpDown, FileDown, Download, Percent, Edit, Trash2, MapPin, Truck, Map, MessageCircle, Loader2 } from 'lucide-react';
import { readExcelFile } from '../utils/excel';
import { useLocation } from 'react-router-dom';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
// @ts-ignore
import toast from 'react-hot-toast';

interface StatementItem {
  date: string;
  description: string;
  debit: number; 
  credit: number; 
  balance: number;
}

type SortKey = 'name' | 'totalSales' | 'totalPaid' | 'repaymentRatio' | 'invCount' | 'monthlyRate';
interface SortConfig {
    key: SortKey;
    direction: 'asc' | 'desc';
}

export default function Customers() {
  const currency = db.getSettings().currency;
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS' | 'DIST_LINES'>('LIST');
  const [customers, setCustomers] = useState(db.getCustomers());
  const representatives = db.getRepresentatives();
  const [settings, setSettings] = useState(db.getSettings());
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', phone: '', area: '', address: '', distribution_line: '', opening_balance: 0, credit_limit: 0, representative_code: '', default_discount_percent: 0 });
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalSales', direction: 'desc' });

  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
        openAddModal();
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const openAddModal = () => {
      setIsEditMode(false);
      setCurrentCustomerId(null);
      const allCustomers = db.getCustomers();
      const numericCodes = allCustomers.map(c => parseInt(c.code)).filter(c => !isNaN(c));
      const maxCode = numericCodes.length > 0 ? Math.max(...numericCodes) : 1000;
      const nextCode = (maxCode + 1).toString();
      setForm({ code: nextCode, name: '', phone: '', area: '', address: '', distribution_line: '', opening_balance: 0, credit_limit: 0, representative_code: '', default_discount_percent: 0 });
      setIsOpen(true);
  };

  const openEditModal = (customer: Customer) => {
      setIsEditMode(true);
      setCurrentCustomerId(customer.id);
      setForm({ code: customer.code, name: customer.name, phone: customer.phone, area: customer.area, address: customer.address || '', distribution_line: customer.distribution_line || '', opening_balance: customer.opening_balance, credit_limit: customer.credit_limit || 0, representative_code: customer.representative_code || '', default_discount_percent: customer.default_discount_percent || 0 });
      setIsOpen(true);
  };

  const handleSave = () => {
    const customerData = { name: form.name, phone: form.phone, area: form.area, address: form.address, distribution_line: form.distribution_line, opening_balance: form.opening_balance, credit_limit: form.credit_limit, representative_code: form.representative_code, default_discount_percent: form.default_discount_percent };
    if (isEditMode && currentCustomerId) db.updateCustomer(currentCustomerId, customerData);
    else db.addCustomer({ ...customerData, code: form.code });
    setCustomers(db.getCustomers());
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Are you sure you want to delete this customer?")) {
          db.deleteCustomer(id);
          setCustomers(db.getCustomers());
      }
  };

  const handleImport = async (e: any) => {
    if(e.target.files[0]) {
      const data = await readExcelFile<any>(e.target.files[0]);
      data.forEach(c => db.addCustomer({ ...c, opening_balance: c.opening_balance || 0 }));
      setCustomers(db.getCustomers());
    }
  };

  const handleSort = (key: SortKey) => {
      let direction: 'asc' | 'desc' = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
      setSortConfig({ key, direction });
  };

  const customerAnalytics = useMemo(() => {
      const allInvoices = db.getInvoices();
      const allTransactions = db.getCashTransactions();
      return customers.map(c => {
          const cInvoices = allInvoices.filter(i => i.customer_id === c.id);
          const cPayments = allTransactions.filter(t => t.reference_id === c.id && t.category === 'CUSTOMER_PAYMENT' && t.type === 'RECEIPT');
          const totalSales = cInvoices.reduce((sum, i) => sum + i.net_total, 0);
          const totalPaid = cPayments.reduce((sum, t) => sum + t.amount, 0);
          const repaymentRatio = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;
          const invCount = cInvoices.length;
          let monthlyRate = 0;
          if (invCount > 0) {
              const dates = cInvoices.map(i => new Date(i.date).getTime());
              const firstDate = Math.min(...dates);
              const lastDate = new Date().getTime(); 
              const diffTime = Math.abs(lastDate - firstDate);
              const diffMonths = Math.max(1, diffTime / (1000 * 60 * 60 * 24 * 30)); 
              monthlyRate = invCount / diffMonths;
          }
          return { ...c, totalSales, totalPaid, repaymentRatio, invCount, monthlyRate };
      });
  }, [customers]);

  const sortedAnalytics = useMemo(() => {
      const filtered = customerAnalytics.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
      return [...filtered].sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
          if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [customerAnalytics, search, sortConfig]);

  // إصلاح دالة تصدير الإكسيل لتجنب خطأ TypeScript
  const handleExportAnalysisExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sortedAnalytics);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analysis");
    XLSX.writeFile(wb, "Customer_Analysis.xlsx");
  };

  const handleAddLine = async () => {
      const name = newLineName.trim();
      if (!name) return;
      const currentLines = settings.distributionLines || [];
      if (currentLines.includes(name)) return alert("هذا الخط موجود بالفعل");
      const updatedLines = [...currentLines, name];
      const updatedSettings = { ...settings, distributionLines: updatedLines };
      const success = await db.updateSettings(updatedSettings);
      if (success) { setSettings(updatedSettings); setNewLineName(''); }
  };

  const handleDeleteLine = async (line: string) => {
      if (!confirm(`هل أنت متأكد من حذف خط التوزيع "${line}"؟`)) return;
      const updatedLines = (settings.distributionLines || []).filter(l => l !== line);
      const updatedSettings = { ...settings, distributionLines: updatedLines };
      const success = await db.updateSettings(updatedSettings);
      if (success) setSettings(updatedSettings);
  };

  const statementData = useMemo(() => {
    if (!statementCustomer) return [];
    const items: any[] = [];
    const invoices = db.getInvoices().filter(i => i.customer_id === statementCustomer.id);
    invoices.forEach(inv => { items.push({ date: inv.date, description: `Invoice #${inv.invoice_number}`, debit: inv.net_total, credit: 0, rawDate: new Date(inv.date) }); });
    const payments = db.getCashTransactions().filter(tx => tx.category === 'CUSTOMER_PAYMENT' && tx.reference_id === statementCustomer.id);
    payments.forEach(pay => { items.push({ date: pay.date, description: `Payment: ${pay.notes || '-'}`, debit: 0, credit: pay.amount, rawDate: new Date(pay.date) }); });
    items.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    let balance = statementCustomer.opening_balance;
    const finalStatement: StatementItem[] = [{ date: '', description: t('common.opening'), debit: 0, credit: 0, balance: balance }];
    items.forEach(item => { balance = balance + item.debit - item.credit; finalStatement.push({ date: item.date, description: item.description, debit: item.debit, credit: item.credit, balance: balance }); });
    return finalStatement;
  }, [statementCustomer]);

  const handleWhatsAppStatement = async () => {
    if (!statementCustomer || !statementCustomer.phone) return alert("لا يوجد رقم هاتف مسجل لهذا العميل");

    const toastId = toast.loading('جاري تجهيز كشف الحساب PDF والواتساب...');
    
    // 1. Generate PDF
    const element = document.getElementById('statement-export-area');
    if (!element) return;
    
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = '800px'; 
    clone.style.background = 'white';
    clone.querySelectorAll('.print-hidden').forEach((el) => (el as HTMLElement).style.display = 'none'); 
    document.body.appendChild(clone);
    
    try {
        const canvas = await html2canvas(clone, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Statement-${statementCustomer.name}.pdf`);

        // 2. Open WhatsApp
        const message = `*عزيزي العميل ${statementCustomer.name}*\n` +
                        `مرفق كشف حساب مالي يوضح الحركات والمستحقات حتى تاريخه.\n` +
                        `إجمالي الرصيد المستحق: ${statementCustomer.current_balance.toFixed(2)} ${currency}\n\n` +
                        `📥 *يرجى إرفاق ملف الـ PDF الذي تم تحميله الآن في هذه المحادثة.*`;

        const encodedMsg = encodeURIComponent(message);
        const cleanPhone = statementCustomer.phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`;
        
        toast.success('تم تحميل كشف الحساب، يرجى إرفاقه في الواتساب', { id: toastId });
        window.open(`https://wa.me/${finalPhone}?text=${encodedMsg}`, '_blank');

    } finally { document.body.removeChild(clone); }
  };

  const handleStatementExportPDF = async () => {
        const element = document.getElementById('statement-export-area');
        if (!element) return;
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.width = '800px'; clone.style.background = 'white';
        clone.querySelectorAll('.print-hidden').forEach((el) => (el as HTMLElement).style.display = 'none'); 
        document.body.appendChild(clone);
        try {
            const canvas = await html2canvas(clone, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Statement_${statementCustomer?.name}.pdf`);
        } finally { document.body.removeChild(clone); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('cust.title')}</h1>
        <div className="flex gap-2">
          <label className="cursor-pointer bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import
            <input type="file" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={openAddModal} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('cust.add')}
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
          <button onClick={() => setActiveTab('LIST')} className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'LIST' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Users className="w-4 h-4" />{t('cust.tab_list')}</button>
          <button onClick={() => setActiveTab('ANALYSIS')} className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ANALYSIS' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><BarChart3 className="w-4 h-4" />{t('cust.tab_analysis')}</button>
          <button onClick={() => setActiveTab('DIST_LINES')} className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'DIST_LINES' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Map className="w-4 h-4" />خطوط التوزيع</button>
      </div>

      {activeTab !== 'DIST_LINES' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative max-w-md w-full">
                <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
                <input className="pl-10 pr-4 py-2 border rounded-lg w-full rtl:pr-10 rtl:pl-4 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('cust.search')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {activeTab === 'ANALYSIS' && (
                <div className="flex gap-2">
                    <button onClick={handleExportAnalysisExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-bold"><FileDown className="w-4 h-4" />{t('cust.export_excel')}</button>
                </div>
            )}
          </div>
      )}

      {activeTab === 'LIST' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right min-w-[900px]">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr><th className="p-4">{t('cust.code')}</th><th className="p-4">{t('cust.name')}</th><th className="p-4">{t('cust.address')}</th><th className="p-4">{t('cust.dist_line')}</th><th className="p-4">{t('cust.rep')}</th><th className="p-4">{t('cust.phone')}</th><th className="p-4 text-center">{t('cust.default_discount')}</th><th className="p-4 text-right rtl:text-left">{t('cust.balance')}</th><th className="p-4 text-center">{t('common.action')}</th></tr>
                </thead>
                <tbody>
                    {customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => {
                        const repName = representatives.find(r => r.code === c.representative_code)?.name;
                        const isOverLimit = c.credit_limit && c.credit_limit > 0 && c.current_balance > c.credit_limit;
                        return (
                        <tr key={c.id} className="border-b hover:bg-gray-50 group">
                            <td className="p-4 font-mono text-gray-500">{c.code}</td>
                            <td className="p-4 font-bold">{c.name}{isOverLimit && <span className="block text-[10px] text-white font-bold bg-red-500 w-fit px-1.5 py-0.5 rounded mt-1 shadow-sm">OVER LIMIT</span>}</td>
                            <td className="p-4 text-gray-500 text-xs max-w-[150px] truncate" title={c.address}>{c.address || '-'}</td>
                            <td className="p-4 text-gray-500 text-xs max-w-[120px] truncate">{c.distribution_line || '-'}</td>
                            <td className="p-4">{repName ? <span className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-700 w-fit"><User className="w-3 h-3" /> {repName}</span> : <span className="text-gray-400">-</span>}</td>
                            <td className="p-4">{c.phone}</td>
                            <td className="p-4 text-center font-bold text-blue-600">{c.default_discount_percent ? `${c.default_discount_percent}%` : '-'}</td>
                            <td className={`p-4 text-right rtl:text-left font-bold ${c.current_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{currency}{c.current_balance.toFixed(2)}{c.credit_limit && c.credit_limit > 0 && ( <div className="text-[10px] text-gray-400 font-normal">Limit: {c.credit_limit}</div> )}</td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setStatementCustomer(c)} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-xs font-medium border border-blue-200"><FileText className="w-4 h-4" /></button>
                                    <button onClick={() => openEditModal(c)} className="text-gray-500 hover:text-blue-600 hover:bg-gray-100 p-1.5 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(c.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </td>
                        </tr>
                    )})}
                </tbody>
                </table>
            </div>
          </div>
      )}

      {/* STATEMENT MODAL */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:bg-white print:static print:p-0">
            <style> {` @media print { @page { size: portrait; margin: 1cm; } body * { visibility: hidden; } #statement-modal, #statement-modal * { visibility: visible; } #statement-modal { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 0; background: white; z-index: 9999; } .print-hidden { display: none !important; } } `} </style>
            <div id="statement-modal" className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none">
                <div id="statement-export-area">
                    <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center shrink-0 print:bg-white print:border-b-2 print:border-black">
                        <div><h3 className="text-lg font-bold text-gray-800">{t('common.statement')}</h3><p className="text-sm text-gray-500">{statementCustomer.name} - {new Date().toLocaleDateString()}</p></div>
                        <div className="flex gap-2 print-hidden">
                            <button onClick={handleWhatsAppStatement} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full" title="إرسال PDF عبر واتساب"><MessageCircle className="w-5 h-5" /></button>
                            <button onClick={handleStatementExportPDF} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Export PDF"><Download className="w-5 h-5" /></button>
                            <button onClick={() => window.print()} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full" title="Print"><Printer className="w-5 h-5" /></button>
                            <button onClick={() => setStatementCustomer(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full" title="Close"><X className="w-6 h-6" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right border-collapse min-w-[600px]">
                                <thead className="bg-gray-100 text-gray-700 sticky top-0 print:static">
                                    <tr><th className="p-3 border">{t('common.date')}</th><th className="p-3 border">{t('common.desc')}</th><th className="p-3 border text-right rtl:text-left text-red-600">{t('common.debit')} (+)</th><th className="p-3 border text-right rtl:text-left text-green-600">{t('common.credit')} (-)</th><th className="p-3 border text-right rtl:text-left">{t('common.balance')}</th></tr>
                                </thead>
                                <tbody>
                                    {statementData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 border-b">
                                            <td className="p-3 border text-gray-600">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                                            <td className="p-3 border font-medium">{row.description}</td>
                                            <td className="p-3 border text-right rtl:text-left">{row.debit > 0 ? `${currency}${row.debit.toLocaleString()}` : '-'}</td>
                                            <td className="p-3 border text-right rtl:text-left">{row.credit > 0 ? `${currency}${row.credit.toLocaleString()}` : '-'}</td>
                                            <td className={`p-3 border text-right rtl:text-left font-bold ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{currency}{row.balance.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
