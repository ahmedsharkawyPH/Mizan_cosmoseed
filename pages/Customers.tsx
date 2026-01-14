import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Customer } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Upload, FileText, X, Printer, User, ShieldAlert, BarChart3, Users, ArrowUpDown, FileDown, Download, Percent, Edit, Trash2, MapPin, Truck } from 'lucide-react';
import { readExcelFile } from '../utils/excel';
import { useLocation } from 'react-router-dom';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface StatementItem {
  date: string;
  description: string;
  debit: number; // + (Invoice)
  credit: number; // - (Payment)
  balance: number;
}

// Helper for sorting
type SortKey = 'name' | 'totalSales' | 'totalPaid' | 'repaymentRatio' | 'invCount' | 'monthlyRate';
interface SortConfig {
    key: SortKey;
    direction: 'asc' | 'desc';
}

export default function Customers() {
  const currency = db.getSettings().currency;
  const location = useLocation();
  
  // TABS
  const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS'>('LIST');

  const [customers, setCustomers] = useState(db.getCustomers());
  const representatives = db.getRepresentatives();

  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null);

  const [form, setForm] = useState({ 
      code: '', 
      name: '', 
      phone: '', 
      area: '',
      address: '', 
      distribution_line: '', 
      opening_balance: 0, 
      credit_limit: 0, 
      representative_code: '', 
      default_discount_percent: 0 
  });

  // Statement State
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Sorting State for Analysis
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalSales', direction: 'desc' });

  // Auto-open modal from navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
        openAddModal();
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const openAddModal = () => {
      setIsEditMode(false);
      setCurrentCustomerId(null);
      setForm({ 
          code: '', 
          name: '', 
          phone: '', 
          area: '',
          address: '', 
          distribution_line: '', 
          opening_balance: 0, 
          credit_limit: 0, 
          representative_code: '', 
          default_discount_percent: 0 
      });
      setIsOpen(true);
  };

  const openEditModal = (customer: Customer) => {
      setIsEditMode(true);
      setCurrentCustomerId(customer.id);
      setForm({
          code: customer.code,
          name: customer.name,
          phone: customer.phone,
          area: customer.area,
          address: customer.address || '',
          distribution_line: customer.distribution_line || '',
          opening_balance: customer.opening_balance,
          credit_limit: customer.credit_limit || 0,
          representative_code: customer.representative_code || '',
          default_discount_percent: customer.default_discount_percent || 0
      });
      setIsOpen(true);
  };

  const handleSave = () => {
    const customerData = {
        name: form.name,
        phone: form.phone,
        area: form.area,
        address: form.address,
        distribution_line: form.distribution_line,
        opening_balance: form.opening_balance,
        credit_limit: form.credit_limit,
        representative_code: form.representative_code,
        default_discount_percent: form.default_discount_percent
    };

    if (isEditMode && currentCustomerId) {
        db.updateCustomer(currentCustomerId, customerData);
    } else {
        db.addCustomer({ ...customerData, code: form.code });
    }
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
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
  };

  // --- ANALYTICS LOGIC ---
  const customerAnalytics = useMemo(() => {
      const allInvoices = db.getInvoices();
      const allTransactions = db.getCashTransactions();

      return customers.map(c => {
          // Filter data for this customer
          const cInvoices = allInvoices.filter(i => i.customer_id === c.id);
          const cPayments = allTransactions.filter(t => t.reference_id === c.id && t.category === 'CUSTOMER_PAYMENT' && t.type === 'RECEIPT');

          // 1. Total Sales (Net Total of Invoices)
          const totalSales = cInvoices.reduce((sum, i) => sum + i.net_total, 0);

          // 2. Total Paid (Receipts)
          const totalPaid = cPayments.reduce((sum, t) => sum + t.amount, 0);

          // 3. Repayment Ratio
          const repaymentRatio = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;

          // 4. Invoice Count
          const invCount = cInvoices.length;

          // 5. Monthly Rate
          let monthlyRate = 0;
          if (invCount > 0) {
              const dates = cInvoices.map(i => new Date(i.date).getTime());
              const firstDate = Math.min(...dates);
              const lastDate = new Date().getTime(); // or max invoice date
              
              // Diff in months (approx)
              const diffTime = Math.abs(lastDate - firstDate);
              const diffMonths = Math.max(1, diffTime / (1000 * 60 * 60 * 24 * 30)); 
              
              monthlyRate = invCount / diffMonths;
          }

          return {
              ...c,
              totalSales,
              totalPaid,
              repaymentRatio,
              invCount,
              monthlyRate
          };
      });
  }, [customers]);

  const sortedAnalytics = useMemo(() => {
      const filtered = customerAnalytics.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
      
      return [...filtered].sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) {
              return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (a[sortConfig.key] > b[sortConfig.key]) {
              return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
      });
  }, [customerAnalytics, search, sortConfig]);

  // --- EXPORT HANDLERS (Analysis Tab) ---
  const handleExportExcel = () => {
      const data = sortedAnalytics.map(c => ({
          [t('cust.code')]: c.code,
          [t('cust.name')]: c.name,
          [t('cust.address')]: c.address,
          [t('cust.dist_line')]: c.distribution_line,
          [t('cust.total_sales')]: c.totalSales,
          [t('cust.total_paid')]: c.totalPaid,
          [t('cust.repayment_ratio')]: `${c.repaymentRatio.toFixed(1)}%`,
          [t('cust.inv_count')]: c.invCount,
          [t('cust.monthly_rate')]: c.monthlyRate.toFixed(2),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analysis");
      XLSX.writeFile(wb, "Customer_Analysis.xlsx");
  };

  const handleExportPDF = async () => {
      const element = document.getElementById('analysis-table-container');
      if (!element) return;

      try {
          const originalClass = element.className;
          element.className = 'bg-white p-4'; 

          const canvas = await html2canvas(element, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save("Customer_Analysis.pdf");

          element.className = originalClass;
      } catch (err) {
          console.error("PDF Export failed", err);
      }
  };

  // --- STATEMENT LOGIC ---
  const statementData = useMemo(() => {
    if (!statementCustomer) return [];
    
    const items: any[] = [];
    
    // 1. Invoices (Debit)
    const invoices = db.getInvoices().filter(i => i.customer_id === statementCustomer.id);
    invoices.forEach(inv => {
      items.push({
        date: inv.date,
        description: `Invoice #${inv.invoice_number}`,
        debit: inv.net_total,
        credit: 0,
        rawDate: new Date(inv.date)
      });
    });

    // 2. Payments (Credit)
    const payments = db.getCashTransactions().filter(tx => 
      tx.category === 'CUSTOMER_PAYMENT' && tx.reference_id === statementCustomer.id
    );
    payments.forEach(pay => {
       items.push({
        date: pay.date,
        description: `Payment: ${pay.notes || '-'}`,
        debit: 0,
        credit: pay.amount,
        rawDate: new Date(pay.date)
      });
    });

    // Sort by Date
    items.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // Calculate Running Balance
    let balance = statementCustomer.opening_balance;
    const finalStatement: StatementItem[] = [];

    // Add Opening Balance Row
    finalStatement.push({
        date: '',
        description: t('common.opening'),
        debit: 0,
        credit: 0,
        balance: balance
    });

    items.forEach(item => {
        balance = balance + item.debit - item.credit;
        finalStatement.push({
            date: item.date,
            description: item.description,
            debit: item.debit,
            credit: item.credit,
            balance: balance
        });
    });

    return finalStatement;

  }, [statementCustomer]);

  // --- STATEMENT EXPORT HANDLERS ---
  const handleStatementExportExcel = () => {
        const data = statementData.map(row => ({
            [t('common.date')]: row.date ? new Date(row.date).toLocaleDateString() : '',
            [t('common.desc')]: row.description,
            [t('common.debit')]: row.debit,
            [t('common.credit')]: row.credit,
            [t('common.balance')]: row.balance
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Statement");
        XLSX.writeFile(wb, `Statement_${statementCustomer?.name}.xlsx`);
  };

  const handleStatementExportPDF = async () => {
        const element = document.getElementById('statement-export-area');
        if (!element) return;

        // Clone node to render full height off-screen
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.width = '800px'; 
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.background = 'white';
        // Remove shadows and print-hidden elements
        clone.classList.remove('shadow-2xl', 'rounded-xl', 'max-h-[90vh]');
        clone.querySelectorAll('.print-hidden').forEach((el) => (el as HTMLElement).style.display = 'none'); 

        document.body.appendChild(clone);

        try {
            const canvas = await html2canvas(clone, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // Handle pagination for long statements
            const pageHeight = 295;
            let heightLeft = pdfHeight;
            let position = 0;

            if (heightLeft > pageHeight) {
                 pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                 heightLeft -= pageHeight;
                 while (heightLeft >= 0) {
                   position = heightLeft - pdfHeight;
                   pdf.addPage();
                   pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                   heightLeft -= pageHeight;
                 }
            } else {
                 pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            }

            pdf.save(`Statement_${statementCustomer?.name}.pdf`);
        } finally {
            document.body.removeChild(clone);
        }
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

      {/* TABS */}
      <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('LIST')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'LIST' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Users className="w-4 h-4" />
              {t('cust.tab_list')}
          </button>
          <button 
            onClick={() => setActiveTab('ANALYSIS')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'ANALYSIS' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <BarChart3 className="w-4 h-4" />
              {t('cust.tab_analysis')}
          </button>
      </div>

      {/* SEARCH BAR & EXPORT (For Analysis Tab) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative max-w-md w-full">
            <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
            <input 
              className="pl-10 pr-4 py-2 border rounded-lg w-full rtl:pr-10 rtl:pl-4 focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder={t('cust.search')} 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
          
          {activeTab === 'ANALYSIS' && (
              <div className="flex gap-2">
                  <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-bold">
                      <FileDown className="w-4 h-4" />
                      {t('cust.export_excel')}
                  </button>
                  <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-bold">
                      <Download className="w-4 h-4" />
                      {t('cust.export_pdf')}
                  </button>
              </div>
          )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-xl border shadow-lg space-y-4 animate-in fade-in zoom-in duration-200 w-full max-w-lg relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
            </button>
           <h3 className="font-bold text-lg">{isEditMode ? 'Edit Customer' : t('cust.add')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder={t('cust.code')} className="border p-2 rounded" value={form.code} onChange={e => setForm({...form, code: e.target.value})} disabled={isEditMode} />
            <input placeholder={t('cust.name')} className="border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input placeholder={t('cust.phone')} className="border p-2 rounded" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <div className="col-span-1">
                <label className="block text-xs text-gray-500 mb-1">{t('cust.rep')}</label>
                <select 
                    className="w-full border p-2 rounded" 
                    value={form.representative_code} 
                    onChange={e => setForm({...form, representative_code: e.target.value})}
                >
                    <option value="">-- Select Rep --</option>
                    {representatives.map(r => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                </select>
            </div>
            
            {/* New Fields: Address & Distribution Line */}
            <div className="col-span-1 md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {t('cust.address')}
                </label>
                <input 
                    placeholder={t('cust.address')} 
                    className="w-full border p-2 rounded" 
                    value={form.address} 
                    onChange={e => setForm({...form, address: e.target.value})} 
                />
            </div>
            <div className="col-span-1 md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> {t('cust.dist_line')}
                </label>
                <input 
                    placeholder={t('cust.dist_line')} 
                    className="w-full border p-2 rounded" 
                    value={form.distribution_line} 
                    onChange={e => setForm({...form, distribution_line: e.target.value})} 
                />
            </div>

            <div>
                <label className="block text-xs text-gray-500 mb-1">{t('cust.balance')}</label>
                <input type="number" placeholder="0" className="w-full border p-2 rounded" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: +e.target.value})} />
            </div>
            <div>
                <label className="block text-xs text-gray-500 mb-1 font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-red-500" /> Credit Limit</label>
                <input type="number" placeholder="0 (No Limit)" className="w-full border p-2 rounded" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: +e.target.value})} />
            </div>
            <div>
                <label className="block text-xs text-gray-500 mb-1 font-bold flex items-center gap-1"><Percent className="w-3 h-3 text-blue-500" /> {t('cust.default_discount')}</label>
                <input type="number" step="0.1" min="0" max="100" placeholder="0 %" className="w-full border p-2 rounded" value={form.default_discount_percent} onChange={e => setForm({...form, default_discount_percent: +e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('common.action')}</button>
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('set.save')}</button>
          </div>
        </div>
        </div>
      )}

      {/* LIST VIEW */}
      {activeTab === 'LIST' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right min-w-[900px]">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                    <th className="p-4">{t('cust.code')}</th>
                    <th className="p-4">{t('cust.name')}</th>
                    <th className="p-4">{t('cust.address')}</th>
                    <th className="p-4">{t('cust.dist_line')}</th>
                    <th className="p-4">{t('cust.rep')}</th>
                    <th className="p-4">{t('cust.phone')}</th>
                    <th className="p-4 text-center">{t('cust.default_discount')}</th>
                    <th className="p-4 text-right rtl:text-left">{t('cust.balance')}</th>
                    <th className="p-4 text-center">{t('common.action')}</th>
                    </tr>
                </thead>
                <tbody>
                    {customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => {
                        const repName = representatives.find(r => r.code === c.representative_code)?.name;
                        const isOverLimit = c.credit_limit && c.credit_limit > 0 && c.current_balance > c.credit_limit;
                        
                        return (
                        <tr key={c.id} className="border-b hover:bg-gray-50 group">
                            <td className="p-4 font-mono text-gray-500">{c.code}</td>
                            <td className="p-4 font-bold">
                                {c.name}
                                {isOverLimit && <span className="block text-[10px] text-white font-bold bg-red-500 w-fit px-1.5 py-0.5 rounded mt-1 shadow-sm">OVER LIMIT</span>}
                            </td>
                            <td className="p-4 text-gray-500 text-xs max-w-[150px] truncate" title={c.address}>{c.address || '-'}</td>
                            <td className="p-4 text-gray-500 text-xs max-w-[120px] truncate">{c.distribution_line || '-'}</td>
                            <td className="p-4">
                                {repName ? (
                                    <span className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-700 w-fit">
                                        <User className="w-3 h-3" /> {repName}
                                    </span>
                                ) : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="p-4">{c.phone}</td>
                            <td className="p-4 text-center font-bold text-blue-600">
                                {c.default_discount_percent ? `${c.default_discount_percent}%` : '-'}
                            </td>
                            <td className={`p-4 text-right rtl:text-left font-bold ${c.current_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {currency}{c.current_balance.toFixed(2)}
                                {c.credit_limit && c.credit_limit > 0 && (
                                    <div className="text-[10px] text-gray-400 font-normal">Limit: {c.credit_limit}</div>
                                )}
                            </td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button 
                                        onClick={() => setStatementCustomer(c)}
                                        className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-xs font-medium border border-blue-200"
                                        title={t('common.statement')}
                                    >
                                        <FileText className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => openEditModal(c)}
                                        className="text-gray-500 hover:text-blue-600 hover:bg-gray-100 p-1.5 rounded transition-colors"
                                        title={t('list.edit')}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(c.id)}
                                        className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )})}
                </tbody>
                </table>
            </div>
          </div>
      )}

      {/* ANALYSIS VIEW */}
      {activeTab === 'ANALYSIS' && (
          <div id="analysis-table-container" className="bg-white rounded-xl shadow-sm border overflow-hidden animate-in fade-in">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left rtl:text-right min-w-[800px]">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                          <tr>
                              <th 
                                className="p-4 cursor-pointer hover:bg-slate-100" 
                                onClick={() => handleSort('name')}
                              >
                                  <div className="flex items-center gap-1">
                                      {t('cust.name')} <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                  </div>
                              </th>
                              <th 
                                className="p-4 cursor-pointer hover:bg-slate-100 text-right rtl:text-left" 
                                onClick={() => handleSort('totalSales')}
                              >
                                  <div className="flex items-center gap-1 justify-end rtl:justify-start">
                                      {t('cust.total_sales')} <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                  </div>
                              </th>
                              <th 
                                className="p-4 cursor-pointer hover:bg-slate-100 text-right rtl:text-left" 
                                onClick={() => handleSort('totalPaid')}
                              >
                                  <div className="flex items-center gap-1 justify-end rtl:justify-start">
                                      {t('cust.total_paid')} <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                  </div>
                              </th>
                              <th 
                                className="p-4 cursor-pointer hover:bg-slate-100 text-center" 
                                onClick={() => handleSort('repaymentRatio')}
                              >
                                  <div className="flex items-center gap-1 justify-center">
                                      {t('cust.repayment_ratio')} <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                  </div>
                              </th>
                              <th 
                                className="p-4 cursor-pointer hover:bg-slate-100 text-center" 
                                onClick={() => handleSort('invCount')}
                              >
                                  <div className="flex items-center gap-1 justify-center">
                                      {t('cust.inv_count')} <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                  </div>
                              </th>
                              <th 
                                className="p-4 cursor-pointer hover:bg-slate-100 text-center" 
                                onClick={() => handleSort('monthlyRate')}
                              >
                                  <div className="flex items-center gap-1 justify-center">
                                      {t('cust.monthly_rate')} <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                  </div>
                              </th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {sortedAnalytics.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 font-bold text-gray-800">{c.name}</td>
                                  <td className="p-4 text-right rtl:text-left font-mono">{currency}{c.totalSales.toLocaleString()}</td>
                                  <td className="p-4 text-right rtl:text-left font-mono text-emerald-600">{currency}{c.totalPaid.toLocaleString()}</td>
                                  <td className="p-4 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                              <div 
                                                className={`h-full rounded-full ${c.repaymentRatio >= 80 ? 'bg-emerald-500' : c.repaymentRatio >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                                style={{width: `${Math.min(c.repaymentRatio, 100)}%`}}
                                              ></div>
                                          </div>
                                          <span className="text-xs font-bold w-8">{c.repaymentRatio.toFixed(0)}%</span>
                                      </div>
                                  </td>
                                  <td className="p-4 text-center font-bold text-slate-600">{c.invCount}</td>
                                  <td className="p-4 text-center">
                                      <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full text-xs font-bold border border-purple-100">
                                          {c.monthlyRate.toFixed(1)} /mo
                                      </span>
                                  </td>
                              </tr>
                          ))}
                          {sortedAnalytics.length === 0 && (
                              <tr>
                                  <td colSpan={6} className="p-8 text-center text-gray-400">No data available</td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Account Statement Modal (Remains same) */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:bg-white print:static print:p-0">
            {/* ... Modal content ... */}
            <style>
                {`
                @media print {
                  @page { size: portrait; margin: 1cm; }
                  body * { visibility: hidden; }
                  #statement-modal, #statement-modal * { visibility: visible; }
                  #statement-modal { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 0; background: white; z-index: 9999; }
                  .print-hidden { display: none !important; }
                }
                `}
            </style>
            
            <div id="statement-modal" className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none">
                <div id="statement-export-area">
                    <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center shrink-0 print:bg-white print:border-b-2 print:border-black">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">{t('common.statement')}</h3>
                            <p className="text-sm text-gray-500">{statementCustomer.name} - {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2 print-hidden">
                            <button onClick={handleStatementExportExcel} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full" title="Export Excel">
                                <FileDown className="w-5 h-5" />
                            </button>
                            <button onClick={handleStatementExportPDF} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Export PDF">
                                <Download className="w-5 h-5" />
                            </button>
                            <button onClick={() => window.print()} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full" title="Print">
                                <Printer className="w-5 h-5" />
                            </button>
                            <button onClick={() => setStatementCustomer(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full" title="Close">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right border-collapse min-w-[600px]">
                                <thead className="bg-gray-100 text-gray-700 sticky top-0 print:static">
                                    <tr>
                                        <th className="p-3 border">{t('common.date')}</th>
                                        <th className="p-3 border">{t('common.desc')}</th>
                                        <th className="p-3 border text-right rtl:text-left text-red-600">{t('common.debit')} (+)</th>
                                        <th className="p-3 border text-right rtl:text-left text-green-600">{t('common.credit')} (-)</th>
                                        <th className="p-3 border text-right rtl:text-left">{t('common.balance')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statementData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 border-b">
                                            <td className="p-3 border text-gray-600">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                                            <td className="p-3 border font-medium">{row.description}</td>
                                            <td className="p-3 border text-right rtl:text-left">{row.debit > 0 ? `${currency}${row.debit.toLocaleString()}` : '-'}</td>
                                            <td className="p-3 border text-right rtl:text-left">{row.credit > 0 ? `${currency}${row.credit.toLocaleString()}` : '-'}</td>
                                            <td className={`p-3 border text-right rtl:text-left font-bold ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {currency}{row.balance.toLocaleString()}
                                            </td>
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