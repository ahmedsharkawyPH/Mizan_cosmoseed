
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { PurchaseInvoice } from '../types';
import { t } from '../utils/t';
import { Search, Eye, PlusCircle, ArrowLeft, X, Printer, Filter, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PurchaseList() {
  const navigate = useNavigate();
  const currency = db.getSettings().currency;
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers] = useState(db.getSuppliers());
  const [products] = useState(db.getProductsWithBatches());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PURCHASE' | 'RETURN'>('ALL');
  
  // Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  useEffect(() => {
    setInvoices(db.getPurchaseInvoices());
  }, []);

  const filtered = invoices.filter(inv => {
      const matchSearch = inv.invoice_number.includes(search) || 
                          (inv.document_number && inv.document_number.includes(search)) ||
                          suppliers.find(s => s.id === inv.supplier_id)?.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'ALL' || inv.type === filterType;
      return matchSearch && matchType;
  });

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'غير معروف';
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'صنف غير معروف';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800">سجل المشتريات والمرتجعات</h1>
            <p className="text-sm text-slate-500 mt-1">عرض وتتبع كافة فواتير المشتريات والمرتجع للموردين</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:flex-none">
                <Search className="absolute right-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="رقم الفاتورة أو المستند..." 
                    className="pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64 outline-none shadow-sm transition-shadow font-bold"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            
            <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <button 
                    onClick={() => setFilterType('ALL')}
                    className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    الكل
                </button>
                <button 
                    onClick={() => setFilterType('PURCHASE')}
                    className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${filterType === 'PURCHASE' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    مشتريات
                </button>
                <button 
                    onClick={() => setFilterType('RETURN')}
                    className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${filterType === 'RETURN' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    مرتجع
                </button>
            </div>

            <button 
                onClick={() => navigate('/purchases/new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2 shrink-0"
            >
                <PlusCircle className="w-5 h-5" />
                <span>فاتورة جديدة</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[800px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100 font-black">
                    <tr>
                        <th className="px-6 py-4">رقم الفاتورة (النظام)</th>
                        <th className="px-6 py-4">رقم المستند (المورد)</th>
                        <th className="px-6 py-4 text-center">التاريخ</th>
                        <th className="px-6 py-4">المورد</th>
                        <th className="px-6 py-4 text-center">النوع</th>
                        <th className="px-6 py-4 text-left">قيمة الفاتورة</th>
                        <th className="px-6 py-4 text-center">الإجراء</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                    {filtered.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 font-mono text-blue-600">
                                {inv.invoice_number}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-500">
                                {inv.document_number || <span className="text-slate-300 italic">-</span>}
                            </td>
                            <td className="px-6 py-4 text-center text-slate-500">
                                {new Date(inv.date).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="px-6 py-4 font-black text-slate-800">
                                {getSupplierName(inv.supplier_id)}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${inv.type === 'PURCHASE' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                    {inv.type === 'PURCHASE' ? 'شراء' : 'مرتجع'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-left font-black text-slate-900">
                                {currency}{inv.total_amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button 
                                    onClick={() => setSelectedInvoice(inv)}
                                    className="p-2 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-all"
                                    title="عرض التفاصيل"
                                >
                                    <Eye className="w-5 h-5" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedInvoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                  <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
                      <div>
                          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                              {selectedInvoice.type === 'PURCHASE' ? 'تفاصيل فاتورة شراء' : 'تفاصيل مرتجع مشتريات'}
                              <span className="text-xs font-mono bg-blue-600 text-white px-3 py-1 rounded-lg shadow-sm">{selectedInvoice.invoice_number}</span>
                          </h3>
                          <div className="flex items-center gap-4 mt-2">
                              <p className="text-xs text-slate-500 font-bold">
                                {new Date(selectedInvoice.date).toLocaleString('ar-EG')} • المورد: <span className="text-blue-600">{getSupplierName(selectedInvoice.supplier_id)}</span>
                              </p>
                              {selectedInvoice.document_number && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-black border border-orange-200">
                                      رقم المستند: {selectedInvoice.document_number}
                                  </span>
                              )}
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => window.print()} className="p-3 hover:bg-white rounded-xl text-slate-500 border border-transparent hover:border-slate-200 transition-all shadow-sm">
                              <Printer className="w-5 h-5" />
                          </button>
                          <button onClick={() => setSelectedInvoice(null)} className="p-3 hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-400 transition-all">
                              <X className="w-6 h-6" />
                          </button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-8 bg-white">
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse min-w-[600px]">
                              <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase font-black">
                                      <th className="p-4 text-right">الصنف</th>
                                      <th className="p-4 text-center">رقم التشغيلة</th>
                                      <th className="p-4 text-center">الكمية</th>
                                      <th className="p-4 text-center">سعر التكلفة</th>
                                      <th className="p-4 text-left">الإجمالي الفرعي</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {selectedInvoice.items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-4 font-black text-slate-800">{getProductName(item.product_id)}</td>
                                          <td className="p-4 text-center font-mono text-xs text-slate-400">{item.batch_number}</td>
                                          <td className="p-4 text-center font-black text-slate-700 bg-slate-50/30">{item.quantity}</td>
                                          <td className="p-4 text-center font-bold text-slate-600">{currency}{item.cost_price.toLocaleString()}</td>
                                          <td className="p-4 text-left font-black text-slate-900">
                                              {currency}{(item.quantity * item.cost_price).toLocaleString()}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                              <tfoot className="border-t-4 border-slate-100">
                                  <tr>
                                      <td colSpan={4} className="p-4 text-left font-black text-slate-500 uppercase text-xs">إجمالي قيمة الفاتورة</td>
                                      <td className="p-4 text-left font-black text-2xl text-blue-600">{currency}{selectedInvoice.total_amount.toLocaleString()}</td>
                                  </tr>
                                  <tr>
                                      <td colSpan={4} className="p-4 pt-0 text-left font-black text-slate-500 uppercase text-xs">المبلغ المسدد نقداً</td>
                                      <td className="p-4 pt-0 text-left font-black text-xl text-emerald-600">{currency}{selectedInvoice.paid_amount.toLocaleString()}</td>
                                  </tr>
                                  {selectedInvoice.total_amount > selectedInvoice.paid_amount && (
                                    <tr>
                                        <td colSpan={4} className="p-4 pt-0 text-left font-black text-slate-500 uppercase text-xs">المتبقي لحساب المورد</td>
                                        <td className="p-4 pt-0 text-left font-black text-xl text-red-600">{currency}{(selectedInvoice.total_amount - selectedInvoice.paid_amount).toLocaleString()}</td>
                                    </tr>
                                  )}
                              </tfoot>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
