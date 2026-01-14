import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Representative, Invoice, PaymentStatus } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Edit2, Users, ClipboardList, Wallet, ArrowRight, Printer, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Representatives() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'LIST' | 'CLOSING'>('LIST');
  const [reps, setReps] = useState(db.getRepresentatives());
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const currency = db.getSettings().currency;
  const companyName = db.getSettings().companyName;
  
  // Edit Mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentRepId, setCurrentRepId] = useState('');

  const [form, setForm] = useState({ code: '', name: '', phone: '', commission_rate: 1, commission_target: 0 });

  // Closing State (Updated for Range)
  const [selectedRepForClosing, setSelectedRepForClosing] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean, invoice: Invoice | null, amount: number }>({ isOpen: false, invoice: null, amount: 0 });

  const handleOpenAdd = () => {
      setIsEditMode(false);
      setForm({ code: '', name: '', phone: '', commission_rate: 1, commission_target: 0 });
      setIsOpen(true);
  };

  const handleOpenEdit = (rep: Representative) => {
      setIsEditMode(true);
      setCurrentRepId(rep.id);
      setForm({ 
          code: rep.code, 
          name: rep.name, 
          phone: rep.phone,
          commission_rate: rep.commission_rate || 1,
          commission_target: rep.commission_target || 0
      });
      setIsOpen(true);
  };

  const handleSave = () => {
    try {
        if (isEditMode) {
             db.updateRepresentative(currentRepId, { 
                 name: form.name, 
                 phone: form.phone,
                 commission_rate: Number(form.commission_rate),
                 commission_target: Number(form.commission_target)
             }); // Code usually static
        } else {
             db.addRepresentative({
                 ...form,
                 commission_rate: Number(form.commission_rate),
                 commission_target: Number(form.commission_target)
             });
        }
        setReps(db.getRepresentatives());
        setIsOpen(false);
    } catch (e: any) {
        alert(e.message);
    }
  };

  // Quick Date Setters
  const setDateRange = (type: 'TODAY' | 'WEEK' | 'MONTH') => {
      const today = new Date();
      const end = today.toISOString().split('T')[0];
      let start = end;

      if (type === 'WEEK') {
          const d = new Date(today);
          d.setDate(d.getDate() - 7);
          start = d.toISOString().split('T')[0];
      } else if (type === 'MONTH') {
          const d = new Date(today.getFullYear(), today.getMonth(), 1);
          start = d.toISOString().split('T')[0];
      }

      setStartDate(start);
      setEndDate(end);
  };

  // --- Closing Logic (Updated for Range) ---
  const closingData = useMemo(() => {
      if (!selectedRepForClosing) return { invoices: [], totalExpected: 0, totalCollected: 0 };

      const allInvoices = db.getInvoices();
      const allCustomers = db.getCustomers();
      
      // Get Invoices for this date range AND this Rep
      const rangeInvoices = allInvoices.filter(inv => {
          const d = inv.date.split('T')[0];
          const isDateMatch = d >= startDate && d <= endDate;
          if (!isDateMatch) return false;
          
          const customer = allCustomers.find(c => c.id === inv.customer_id);
          return customer?.representative_code === selectedRepForClosing;
      });

      let totalExpected = 0;
      let totalCollected = 0;

      const invoicesWithPaymentInfo = rangeInvoices.map(inv => {
          const paidAmount = db.getInvoicePaidAmount(inv.id);
          const remaining = inv.net_total - paidAmount;
          const cust = allCustomers.find(c => c.id === inv.customer_id);
          
          totalExpected += inv.net_total;
          totalCollected += paidAmount;

          return {
              ...inv,
              customerName: cust?.name || 'Unknown',
              customerAddress: cust?.address || '',
              customerPhone: cust?.phone || '',
              paidAmount,
              remaining
          };
      });

      return { invoices: invoicesWithPaymentInfo, totalExpected, totalCollected };
  }, [selectedRepForClosing, startDate, endDate, paymentModal.isOpen]); 

  const handleRecordPayment = async () => {
      if (!paymentModal.invoice || paymentModal.amount <= 0) return;
      
      if (paymentModal.amount > (paymentModal.invoice.net_total - db.getInvoicePaidAmount(paymentModal.invoice.id))) {
          if(!confirm("Amount exceeds remaining balance. Continue?")) return;
      }

      const res = await db.recordInvoicePayment(paymentModal.invoice.id, paymentModal.amount);
      if (res.success) {
          setPaymentModal({ isOpen: false, invoice: null, amount: 0 });
      } else {
          alert(res.message);
      }
  };

  const handlePrintManifest = () => {
      window.print();
  };

  const customers = db.getCustomers();

  return (
    <div className="space-y-6">
      
      {/* Top Tabs */}
      <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('LIST')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'LIST' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Users className="w-4 h-4" />
              {t('rep.title')}
          </button>
          <button 
            onClick={() => setActiveTab('CLOSING')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'CLOSING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <ClipboardList className="w-4 h-4" />
              {t('rep.daily_closing')}
          </button>
      </div>

      {activeTab === 'LIST' && (
        <>
            <div className="flex justify-between items-center">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
                    <input 
                    className="pl-10 pr-4 py-2 border rounded-lg w-full rtl:pr-10 rtl:pl-4" 
                    placeholder={t('cust.search')} 
                    value={search} onChange={e => setSearch(e.target.value)} 
                    />
                </div>
                <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
                    <Plus className="w-4 h-4" /> {t('rep.add')}
                </button>
            </div>

            {isOpen && (
                <div className="bg-white p-6 rounded-xl border shadow-lg space-y-4 animate-in fade-in zoom-in duration-200">
                <h3 className="font-bold text-lg">{isEditMode ? 'Edit Representative' : t('rep.add')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('rep.code')}</label>
                        <input 
                            placeholder={t('rep.code')} 
                            className="w-full border p-2 rounded bg-gray-50" 
                            value={form.code} 
                            onChange={e => setForm({...form, code: e.target.value})} 
                            disabled={isEditMode} // Disable code editing
                        />
                        {isEditMode && <span className="text-xs text-red-500">Code cannot be changed</span>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('rep.name')}</label>
                        <input placeholder={t('rep.name')} className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('cust.phone')}</label>
                        <input placeholder={t('cust.phone')} className="w-full border p-2 rounded" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('rep.commission')}</label>
                        <input 
                            type="number" 
                            min="0" 
                            step="0.1"
                            placeholder="%" 
                            className="w-full border p-2 rounded" 
                            value={form.commission_rate} 
                            onChange={e => setForm({...form, commission_rate: parseFloat(e.target.value) || 0})} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('rep.target')}</label>
                        <input 
                            type="number" 
                            min="0" 
                            placeholder="0.00" 
                            className="w-full border p-2 rounded" 
                            value={form.commission_target} 
                            onChange={e => setForm({...form, commission_target: parseFloat(e.target.value) || 0})} 
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('common.action')}</button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('set.save')}</button>
                </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right min-w-[700px]">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <tr>
                        <th className="p-4">{t('rep.code')}</th>
                        <th className="p-4">{t('rep.name')}</th>
                        <th className="p-4">{t('cust.phone')}</th>
                        <th className="p-4 text-center">{t('rep.target')}</th>
                        <th className="p-4 text-center">{t('rep.commission')}</th>
                        <th className="p-4 text-center">{t('rep.customers_count')}</th>
                        <th className="p-4 text-center">{t('common.action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reps.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.code.includes(search)).map(r => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-mono text-gray-500">{r.code}</td>
                            <td className="p-4 font-bold">{r.name}</td>
                            <td className="p-4">{r.phone}</td>
                            <td className="p-4 text-center font-bold text-slate-600">
                                {r.commission_target ? `${currency}${r.commission_target.toLocaleString()}` : '-'}
                            </td>
                            <td className="p-4 text-center font-bold text-blue-600">{r.commission_rate || 0}%</td>
                            <td className="p-4 text-center">
                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                    {customers.filter(c => c.representative_code === r.code).length}
                                </span>
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={() => handleOpenEdit(r)} className="text-gray-500 hover:text-blue-600">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                        ))}
                        {reps.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-400">No representatives found</td>
                            </tr>
                        )}
                    </tbody>
                    </table>
                </div>
            </div>
        </>
      )}

      {activeTab === 'CLOSING' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm print-hidden">
                  <div className="flex flex-col gap-4">
                      
                      {/* Rep Selection */}
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">{t('rep.select_rep')}</label>
                          <select 
                            className="w-full border p-3 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedRepForClosing}
                            onChange={(e) => setSelectedRepForClosing(e.target.value)}
                          >
                              <option value="">-- Select Representative --</option>
                              {reps.map(r => <option key={r.code} value={r.code}>{r.name} ({r.code})</option>)}
                          </select>
                      </div>

                      {/* Date Range & Quick Filters */}
                      <div className="flex flex-col md:flex-row items-end gap-4 border-t border-gray-100 pt-4">
                          <div className="flex items-center gap-2 flex-1">
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">{t('rep.from')}</label>
                                  <input 
                                    type="date"
                                    className="border p-2.5 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                  />
                              </div>
                              <span className="text-gray-400 mt-5">-</span>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">{t('rep.to')}</label>
                                  <input 
                                    type="date"
                                    className="border p-2.5 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                  />
                              </div>
                          </div>

                          <div className="flex gap-2">
                              <button 
                                onClick={() => setDateRange('TODAY')}
                                className="px-3 py-2 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-medium transition-colors"
                              >
                                  {t('rep.today')}
                              </button>
                              <button 
                                onClick={() => setDateRange('WEEK')}
                                className="px-3 py-2 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-medium transition-colors"
                              >
                                  Last 7 Days
                              </button>
                              <button 
                                onClick={() => setDateRange('MONTH')}
                                className="px-3 py-2 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-xs font-medium transition-colors"
                              >
                                  {t('rep.this_month')}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>

              {selectedRepForClosing && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print-hidden">
                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                            <p className="text-sm font-bold text-blue-800 uppercase">Invoices (Period)</p>
                            <h3 className="text-2xl font-bold text-blue-900 mt-1">{currency}{closingData.totalExpected.toLocaleString()}</h3>
                            <p className="text-xs text-blue-600 mt-1">Count: {closingData.invoices.length}</p>
                        </div>
                        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
                            <p className="text-sm font-bold text-emerald-800 uppercase">{t('rep.total_collected')}</p>
                            <h3 className="text-2xl font-bold text-emerald-900 mt-1">{currency}{closingData.totalCollected.toLocaleString()}</h3>
                        </div>
                        <div className="bg-orange-50 p-5 rounded-xl border border-orange-100">
                            <p className="text-sm font-bold text-orange-800 uppercase">{t('rep.total_remaining')}</p>
                            <h3 className="text-2xl font-bold text-orange-900 mt-1">{currency}{(closingData.totalExpected - closingData.totalCollected).toLocaleString()}</h3>
                        </div>
                        <div 
                            onClick={handlePrintManifest}
                            className="bg-slate-800 p-5 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors flex flex-col justify-center items-center text-white"
                        >
                            <Printer className="w-8 h-8 mb-2 text-slate-300" />
                            <p className="font-bold">{t('rep.print_manifest')}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden print-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right min-w-[800px]">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                                    <tr>
                                        <th className="p-4">{t('common.date')}</th>
                                        <th className="p-4">Invoice #</th>
                                        <th className="p-4">{t('inv.customer')}</th>
                                        <th className="p-4 text-right rtl:text-left">{t('inv.net_total')}</th>
                                        <th className="p-4 text-right rtl:text-left">{t('rep.total_collected')}</th>
                                        <th className="p-4 text-center">{t('list.status')}</th>
                                        <th className="p-4 text-center">{t('common.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {closingData.invoices.map(inv => (
                                        <tr key={inv.id} className="border-b hover:bg-gray-50">
                                            <td className="p-4 text-gray-500 text-xs">{new Date(inv.date).toLocaleDateString()}</td>
                                            <td className="p-4 font-mono text-gray-500">{inv.invoice_number}</td>
                                            <td className="p-4 font-bold text-gray-800">
                                                {inv.customerName}
                                                <div className="text-[10px] text-gray-400 font-normal">{inv.customerAddress}</div>
                                            </td>
                                            <td className="p-4 text-right rtl:text-left font-bold">{currency}{inv.net_total.toLocaleString()}</td>
                                            <td className="p-4 text-right rtl:text-left text-emerald-600 font-bold">{currency}{inv.paidAmount.toLocaleString()}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${inv.remaining <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {inv.remaining <= 0 ? t('rep.full') : t('rep.partial')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    {inv.remaining > 0 && (
                                                        <button 
                                                            onClick={() => setPaymentModal({ isOpen: true, invoice: inv, amount: inv.remaining })}
                                                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1"
                                                        >
                                                            <Wallet className="w-3 h-3" /> {t('rep.collect')}
                                                        </button>
                                                    )}
                                                    {/* Return Goods Link */}
                                                    <button 
                                                        onClick={() => navigate('/invoice/new')} // Currently just goes to new invoice, ideally would preload
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200"
                                                    >
                                                        Return
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {closingData.invoices.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-gray-400">
                                                No invoices found for this representative in selected period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* PRINT MANIFEST LAYOUT (Hidden by default, visible on print) */}
                    <div id="manifest-print-area" className="hidden print:block fixed inset-0 bg-white z-[9999] p-8">
                        <style>{`
                            @media print {
                                body * { visibility: hidden; }
                                #manifest-print-area, #manifest-print-area * { visibility: visible; }
                                #manifest-print-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
                                .print-hidden { display: none !important; }
                            }
                        `}</style>
                        <div className="flex flex-col items-center mb-8 border-b-2 border-black pb-4">
                            <h1 className="text-2xl font-bold mb-2">{companyName}</h1>
                            <h2 className="text-xl font-bold border border-black px-4 py-1 rounded">{t('rep.manifest_title')}</h2>
                            <div className="flex justify-between w-full mt-4 text-sm font-bold">
                                <div>{t('rep.name')}: {reps.find(r => r.code === selectedRepForClosing)?.name}</div>
                                <div>Period: {startDate} To {endDate}</div>
                            </div>
                        </div>

                        <table className="w-full border-collapse border border-black text-xs">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-2 w-10">#</th>
                                    <th className="border border-black p-2 text-center">{t('common.date')}</th>
                                    <th className="border border-black p-2 text-right">Invoice #</th>
                                    <th className="border border-black p-2 text-right">{t('inv.customer')}</th>
                                    <th className="border border-black p-2 text-center">{t('inv.net_total')}</th>
                                    <th className="border border-black p-2 w-32">{t('rep.driver_sig')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closingData.invoices.map((inv, idx) => (
                                    <tr key={inv.id}>
                                        <td className="border border-black p-2 text-center">{idx + 1}</td>
                                        <td className="border border-black p-2 text-center">{new Date(inv.date).toLocaleDateString()}</td>
                                        <td className="border border-black p-2 text-right font-mono">{inv.invoice_number}</td>
                                        <td className="border border-black p-2 text-right font-bold">{inv.customerName}</td>
                                        <td className="border border-black p-2 text-center font-bold">{currency}{inv.net_total.toLocaleString()}</td>
                                        <td className="border border-black p-2"></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 font-bold">
                                    <td colSpan={4} className="border border-black p-2 text-center">Total ({closingData.invoices.length} Invoices)</td>
                                    <td className="border border-black p-2 text-center">{currency}{closingData.totalExpected.toLocaleString()}</td>
                                    <td className="border border-black p-2"></td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="mt-12 flex justify-between px-10 text-sm font-bold">
                            <div className="text-center">
                                <p className="mb-8">Store Keeper</p>
                                <p>_________________</p>
                            </div>
                            <div className="text-center">
                                <p className="mb-8">Representative</p>
                                <p>_________________</p>
                            </div>
                        </div>
                    </div>
                  </>
              )}

              {/* Payment Modal */}
              {paymentModal.isOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
                          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                              <Wallet className="w-5 h-5 text-emerald-600" />
                              Record Collection
                          </h3>
                          <p className="text-sm text-gray-500 mb-4">
                              Invoice #{paymentModal.invoice?.invoice_number} <br/>
                              Max Remaining: <b>{currency}{paymentModal.invoice ? (paymentModal.invoice.net_total - db.getInvoicePaidAmount(paymentModal.invoice.id)).toLocaleString() : 0}</b>
                          </p>
                          
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount Collected</label>
                          <input 
                            type="number" 
                            className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold mb-6"
                            value={paymentModal.amount}
                            onChange={(e) => setPaymentModal({...paymentModal, amount: parseFloat(e.target.value) || 0})}
                            autoFocus
                          />

                          <div className="flex justify-end gap-2">
                              <button onClick={() => setPaymentModal({ isOpen: false, invoice: null, amount: 0 })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                              <button onClick={handleRecordPayment} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
                                  Confirm
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}
    </div>
  );
}