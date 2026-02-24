import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Customer } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Upload, FileText, X, Printer, User, ShieldAlert, BarChart3, Users, ArrowUpDown, FileDown, Download, Percent, Edit, Trash2, MapPin, Truck, Map, MessageCircle, Loader2 } from 'lucide-react';
import { readExcelFile } from '../utils/excel';
import { customerSchema } from '../utils/validation';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
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

type SortKey = 'name' | 'monthlySalesValue' | 'monthlyInvCount' | 'repaymentRatio' | 'actualBalance';
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'actualBalance', direction: 'desc' });

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
    
    // التحقق من صحة البيانات باستخدام Zod
    const validation = customerSchema.safeParse(customerData);
    if (!validation.success) {
      return toast.error(validation.error.issues[0].message);
    }

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

  const customerDataWithCalculatedBalance = useMemo(() => {
      const allInvoices = db.getInvoices();
      const allTransactions = db.getCashTransactions();
      const now = new Date().getTime();
      return customers.map(c => {
          const cInvoices = allInvoices.filter(i => i.customer_id === c.id);
          const cPayments = allTransactions.filter(t => t.reference_id === c.id && t.category === 'CUSTOMER_PAYMENT');
          const totalSales = cInvoices.filter(i => i.type === 'SALE').reduce((sum, i) => sum + i.net_total, 0);
          const totalReturns = cInvoices.filter(i => i.type === 'RETURN').reduce((sum, i) => sum + i.net_total, 0);
          const totalPaid = cPayments.filter(t => t.type === 'RECEIPT').reduce((sum, t) => sum + t.amount, 0);
          const totalRefunded = cPayments.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
          const actualBalance = c.opening_balance + totalSales - totalReturns - totalPaid + totalRefunded;
          const invCount = cInvoices.filter(i => i.type === 'SALE').length;
          let diffMonths = 1;
          if (invCount > 0) {
              const dates = cInvoices.filter(i => i.type === 'SALE').map(i => new Date(i.date).getTime());
              const firstDate = Math.min(...dates);
              const diffTime = Math.abs(now - firstDate);
              diffMonths = Math.max(1, diffTime / (1000 * 60 * 60 * 24 * 30)); 
          }
          return { 
              ...c, 
              actualBalance,
              totalSales,
              totalPaid,
              monthlySalesValue: totalSales / diffMonths, 
              monthlyInvCount: invCount / diffMonths,
              repaymentRatio: totalSales > 0 ? (totalPaid / totalSales) * 100 : 0
          };
      });
  }, [customers, activeTab]);

  const sortedAndFiltered = useMemo(() => {
      const filtered = customerDataWithCalculatedBalance.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
      return [...filtered].sort((a, b) => {
          const valA = a[sortConfig.key] || 0;
          const valB = b[sortConfig.key] || 0;
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [customerDataWithCalculatedBalance, search, sortConfig]);

  const handleExportAnalysisExcel = () => {
    const dataToExport = sortedAndFiltered.map(c => ({
        "الاسم": c.name,
        "الرصيد الحالي": c.actualBalance.toFixed(2),
        "حجم المسحوبات الشهرية": c.monthlySalesValue.toFixed(2),
        "معدل الفواتير الشهري": c.monthlyInvCount.toFixed(1),
        "نسبة السداد %": c.repaymentRatio.toFixed(1)
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analysis");
    XLSX.writeFile(wb, `Customer_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      const updatedLines = (settings.distributionLines || []).filter((l: string) => l !== line);
      const updatedSettings = { ...settings, distributionLines: updatedLines };
      const success = await db.updateSettings(updatedSettings);
      if (success) setSettings(updatedSettings);
  };

  const statementData = useMemo(() => {
    if (!statementCustomer) return [];
    const items: any[] = [];
    const invoices = db.getInvoices().filter(i => i.customer_id === statementCustomer.id);
    invoices.forEach(inv => { 
        if(inv.type === 'SALE') {
            items.push({ date: inv.date, description: `فاتورة مبيعات #${inv.invoice_number}`, debit: inv.net_total, credit: 0, rawDate: new Date(inv.date) }); 
        } else {
            items.push({ date: inv.date, description: `مرتجع مبيعات #${inv.invoice_number}`, debit: 0, credit: inv.net_total, rawDate: new Date(inv.date) });
        }
    });
    const payments = db.getCashTransactions().filter(tx => tx.category === 'CUSTOMER_PAYMENT' && tx.reference_id === statementCustomer.id);
    payments.forEach(pay => { 
        if(pay.type === 'RECEIPT') {
            items.push({ date: pay.date, description: `سند قبض: ${pay.notes || '-'}`, debit: 0, credit: pay.amount, rawDate: new Date(pay.date) }); 
        } else {
            items.push({ date: pay.date, description: `سند صرف (رد نقدية): ${pay.notes || '-'}`, debit: pay.amount, credit: 0, rawDate: new Date(pay.date) });
        }
    });
    items.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    let balance = statementCustomer.opening_balance;
    const finalStatement: StatementItem[] = [{ date: '', description: t('common.opening'), debit: 0, credit: 0, balance: balance }];
    items.forEach(item => { balance = balance + item.debit - item.credit; finalStatement.push({ date: item.date, description: item.description, debit: item.debit, credit: item.credit, balance: balance }); });
    return finalStatement;
  }, [statementCustomer]);

  const handleWhatsAppStatement = async () => {
    if (!statementCustomer || !statementCustomer.phone) return alert("لا يوجد رقم هاتف مسجل لهذا العميل");
    const toastId = toast.loading('جاري تجهيز كشف الحساب PDF والواتساب...');
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
          <label htmlFor="import_cust_excel" className="cursor-pointer bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import
            <input id="import_cust_excel" name="import_cust_excel" type="file" className="hidden" onChange={handleImport} />
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
                <input id="customer_search_input" name="customer_search" className="pl-10 pr-4 py-2 border rounded-lg w-full rtl:pr-10 rtl:pl-4 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('cust.search')} value={search} onChange={e => setSearch(e.target.value)} />
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
                    <tr><th className="p-4">{t('cust.code')}</th><th className="p-4">{t('cust.name')}</th><th className="p-4">{t('cust.address')}</th><th className="p-4">{t('cust.dist_line')}</th><th className="p-4">{t('cust.rep')}</th><th className="p-4">{t('cust.phone')}</th><th className="p-4 text-center">{t('cust.default_discount')}</th><th className="p-4 text-center" title="حالة المزامنة">سحابة</th><th className="p-4 text-right rtl:text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('actualBalance')}>{t('cust.balance')} <ArrowUpDown className="w-3 h-3 inline ml-1" /></th><th className="p-4 text-center">{t('common.action')}</th></tr>
                </thead>
                <tbody>
                    {sortedAndFiltered.map(c => {
                        const repName = representatives.find(r => r.code === c.representative_code)?.name;
                        const isOverLimit = c.credit_limit && c.credit_limit > 0 && c.actualBalance > c.credit_limit;
                        return (
                        <tr key={c.id} className="border-b hover:bg-gray-50 group">
                            <td className="p-4 font-mono text-gray-500">{c.code}</td>
                            <td className="p-4 font-bold">{c.name}{isOverLimit && <span className="block text-[10px] text-white font-bold bg-red-500 w-fit px-1.5 py-0.5 rounded mt-1 shadow-sm">OVER LIMIT</span>}</td>
                            <td className="p-4 text-gray-500 text-xs max-w-[150px] truncate" title={c.address}>{c.address || '-'}</td>
                            <td className="p-4 text-gray-500 text-xs max-w-[120px] truncate">{c.distribution_line || '-'}</td>
                            <td className="p-4">{repName ? <span className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-700 w-fit"><User className="w-3 h-3" /> {repName}</span> : <span className="text-gray-400">-</span>}</td>
                            <td className="p-4">{c.phone}</td>
                            <td className="p-4 text-center font-bold text-blue-600">{c.default_discount_percent ? `${c.default_discount_percent}%` : '-'}</td>
                            <td className="p-4 text-center">
                                <SyncStatusIndicator status={c.sync_status} error={c.sync_error} />
                            </td>
                            <td className={`p-4 text-right rtl:text-left font-bold ${c.actualBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>{currency}{c.actualBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{c.credit_limit && c.credit_limit > 0 && ( <div className="text-[10px] text-gray-400 font-normal">Limit: {c.credit_limit}</div> )}</td>
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

      {activeTab === 'ANALYSIS' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">الاسم <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="p-4 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('monthlySalesValue')}>
                                <div className="flex items-center justify-center gap-1">حجم المسحوبات الشهرية <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="p-4 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('monthlyInvCount')}>
                                <div className="flex items-center justify-center gap-1">معدل الفواتير الشهري <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                            <th className="p-4 text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('repaymentRatio')}>
                                <div className="flex items-center justify-center gap-1">نسبة السداد <ArrowUpDown className="w-3 h-3" /></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sortedAndFiltered.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-bold text-slate-800">{c.name}</td>
                                <td className="p-4 text-center font-black text-blue-600">
                                    {currency}{c.monthlySalesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-4 text-center font-bold text-slate-600">
                                    {c.monthlyInvCount.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">فاتورة/شهر</span>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={`font-black ${c.repaymentRatio >= 80 ? 'text-emerald-600' : c.repaymentRatio >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                                            {c.repaymentRatio.toFixed(1)}%
                                        </span>
                                        <div className="w-20 bg-gray-100 rounded-full h-1 overflow-hidden">
                                            <div 
                                                className={`h-full ${c.repaymentRatio >= 80 ? 'bg-emerald-500' : c.repaymentRatio >= 50 ? 'bg-orange-500' : 'bg-red-500'}`} 
                                                style={{ width: `${Math.min(100, c.repaymentRatio)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedAndFiltered.length === 0 && (
                    <div className="p-20 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-10" />
                        <p className="font-bold">لا توجد بيانات متاحة حالياً</p>
                    </div>
                )}
            </div>
          </div>
      )}

      {activeTab === 'DIST_LINES' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" />إضافة خط توزيع جديد</h3>
                  <div className="flex gap-2">
                      <input id="new_dist_line_input" name="new_dist_line" className="flex-1 border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="مثلاً: خط الدقي، خط الهرم..." value={newLineName} onChange={e => setNewLineName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLine()} />
                      <button onClick={handleAddLine} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100">إضافة</button>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Map className="w-5 h-5 text-blue-600" />الخطوط الحالية</h3>
                  <div className="space-y-2">
                      {(settings.distributionLines || []).map((line: string) => (
                          <div key={line} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{line.charAt(0)}</div>
                                  <span className="font-bold text-slate-700">{line}</span>
                                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border text-slate-400 font-bold">{customers.filter(c => c.distribution_line === line).length} عميل</span>
                              </div>
                              <button onClick={() => handleDeleteLine(line)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                      ))}
                      {(!settings.distributionLines || settings.distributionLines.length === 0) && (
                          <div className="py-10 text-center text-slate-400 text-sm font-medium italic">لم يتم تعريف خطوط توزيع بعد</div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
             <div className="bg-white p-6 rounded-xl border shadow-lg space-y-4 animate-in fade-in zoom-in duration-200 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
             <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          <h3 className="font-bold text-lg">{isEditMode ? 'Edit Customer' : t('cust.add')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label htmlFor="cust_code" className="block text-xs font-bold text-gray-400 mb-1">{t('cust.code')}</label><input id="cust_code" name="cust_code" className="w-full border p-2 rounded bg-gray-50 font-mono" value={form.code} readOnly={isEditMode} onChange={e => setForm({...form, code: e.target.value})} /></div>
            <div><label htmlFor="cust_name" className="block text-xs font-bold text-gray-400 mb-1">{t('cust.name')}</label><input id="cust_name" name="cust_name" className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><label htmlFor="cust_phone" className="block text-xs font-bold text-gray-400 mb-1">{t('cust.phone')}</label><input id="cust_phone" name="cust_phone" className="w-full border p-2 rounded" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label htmlFor="cust_address" className="block text-xs font-bold text-gray-400 mb-1">{t('cust.address')}</label><input id="cust_address" name="cust_address" className="w-full border p-2 rounded" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><label htmlFor="cust_dist" className="block text-xs font-bold text-gray-400 mb-1">{t('cust.dist_line')}</label><select id="cust_dist" name="cust_dist" className="w-full border p-2 rounded" value={form.distribution_line} onChange={e => setForm({...form, distribution_line: e.target.value})}><option value="">-- بلا خط --</option>{(settings.distributionLines || []).map((l: string) => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><label htmlFor="cust_rep" className="block text-xs font-bold text-gray-400 mb-1">{t('cust.rep')}</label><select id="cust_rep" name="cust_rep" className="w-full border p-2 rounded" value={form.representative_code} onChange={e => setForm({...form, representative_code: e.target.value})}><option value="">-- بلا مندوب --</option>{representatives.map(r => <option key={r.id} value={r.code}>{r.name} ({r.code})</option>)}</select></div>
            <div><label htmlFor="cust_opening" className="block text-xs font-bold text-gray-400 mb-1">الرصيد الافتتاحي</label><input id="cust_opening" name="cust_opening" type="number" className="w-full border p-2 rounded" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: +e.target.value})} disabled={isEditMode} /></div>
            <div><label htmlFor="cust_limit" className="block text-xs font-bold text-gray-400 mb-1">الحد الائتماني</label><input id="cust_limit" name="cust_limit" type="number" className="w-full border p-2 rounded" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: +e.target.value})} /></div>
            <div><label htmlFor="cust_disc" className="block text-xs font-bold text-gray-400 mb-1">نسبة خصم ثابتة %</label><input id="cust_disc" name="cust_disc" type="number" className="w-full border p-2 rounded font-bold text-blue-600" value={form.default_discount_percent} onChange={e => setForm({...form, default_discount_percent: +e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('common.cancel')}</button>
            <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 shadow-lg shadow-blue-100">{t('set.save')}</button>
          </div>
        </div>
        </div>
      )}

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