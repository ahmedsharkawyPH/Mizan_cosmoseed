
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { PurchaseInvoice } from '../types';
import { t } from '../utils/t';
import { Search, Eye, PlusCircle, ArrowLeft, X, Printer, Filter } from 'lucide-react';
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
                          suppliers.find(s => s.id === inv.supplier_id)?.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'ALL' || inv.type === filterType;
      return matchSearch && matchType;
  });

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('pur.list_title')}</h1>
            <p className="text-sm text-slate-500 mt-1">History of all purchases and returns</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:flex-none">
                <Search className="absolute rtl:right-3 ltr:left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder={t('list.search')} 
                    className="rtl:pr-10 ltr:pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64 outline-none shadow-sm transition-shadow"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            
            <div className="flex bg-white border border-slate-200 rounded-lg p-1">
                <button 
                    onClick={() => setFilterType('ALL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    ALL
                </button>
                <button 
                    onClick={() => setFilterType('PURCHASE')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'PURCHASE' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    PURCHASE
                </button>
                <button 
                    onClick={() => setFilterType('RETURN')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterType === 'RETURN' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    RETURN
                </button>
            </div>

            <button 
                onClick={() => navigate('/purchases/new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2 shrink-0"
            >
                <PlusCircle className="w-5 h-5" />
                <span className="hidden sm:inline">{t('stock.purchase')}</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[800px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 font-bold">{t('pur.invoice_no')}</th>
                        <th className="px-6 py-4 font-bold">{t('common.date')}</th>
                        <th className="px-6 py-4 font-bold">{t('inv.supplier')}</th>
                        <th className="px-6 py-4 font-bold text-center">{t('pur.type')}</th>
                        <th className="px-6 py-4 font-bold text-right rtl:text-left">{t('pur.total_amount')}</th>
                        <th className="px-6 py-4 font-bold text-right rtl:text-left">{t('pur.paid_amount')}</th>
                        <th className="px-6 py-4 font-bold text-center">{t('common.action')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filtered.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 font-mono font-medium text-slate-600">
                                {inv.invoice_number}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                                {new Date(inv.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">
                                {getSupplierName(inv.supplier_id)}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${inv.type === 'PURCHASE' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                    {inv.type === 'PURCHASE' ? 'Purchase' : 'Return'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right rtl:text-left font-bold text-slate-900">
                                {currency}{inv.total_amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right rtl:text-left font-medium text-emerald-600">
                                {currency}{inv.paid_amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button 
                                    onClick={() => setSelectedInvoice(inv)}
                                    className="p-2 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filtered.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-400">
                                {t('list.no_data')}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                              {selectedInvoice.type === 'PURCHASE' ? 'Purchase Invoice' : 'Return Invoice'}
                              <span className="text-sm font-normal text-slate-500 bg-white border px-2 py-0.5 rounded ml-2">#{selectedInvoice.invoice_number}</span>
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">{new Date(selectedInvoice.date).toLocaleString()} • {getSupplierName(selectedInvoice.supplier_id)}</p>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => window.print()} className="p-2 hover:bg-white rounded-full text-slate-500 print:hidden">
                              <Printer className="w-5 h-5" />
                          </button>
                          <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-400 transition-colors">
                              <X className="w-6 h-6" />
                          </button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-6 bg-white">
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse min-w-[600px]">
                              <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                                      <th className="p-3 text-left rtl:text-right">{t('inv.product')}</th>
                                      <th className="p-3 text-left rtl:text-right">{t('stock.batch')}</th>
                                      <th className="p-3 text-center">{t('stock.qty')}</th>
                                      <th className="p-3 text-center">{t('pur.cost')}</th>
                                      <th className="p-3 text-right rtl:text-left">{t('inv.total')}</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {selectedInvoice.items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                          <td className="p-3 font-medium text-slate-800">{getProductName(item.product_id)}</td>
                                          <td className="p-3 font-mono text-xs text-slate-500">{item.batch_number}</td>
                                          <td className="p-3 text-center font-bold">{item.quantity}</td>
                                          <td className="p-3 text-center">{currency}{item.cost_price.toLocaleString()}</td>
                                          <td className="p-3 text-right rtl:text-left font-bold text-slate-800">
                                              {currency}{(item.quantity * item.cost_price).toLocaleString()}
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                              <tfoot>
                                  <tr className="border-t-2 border-slate-100">
                                      <td colSpan={4} className="p-4 text-right rtl:text-left font-bold text-slate-600 uppercase text-xs">Total Amount</td>
                                      <td className="p-4 text-right rtl:text-left font-bold text-xl text-blue-600">{currency}{selectedInvoice.total_amount.toLocaleString()}</td>
                                  </tr>
                                  <tr>
                                      <td colSpan={4} className="p-4 pt-0 text-right rtl:text-left font-bold text-slate-600 uppercase text-xs">Paid Amount</td>
                                      <td className="p-4 pt-0 text-right rtl:text-left font-bold text-emerald-600">{currency}{selectedInvoice.paid_amount.toLocaleString()}</td>
                                  </tr>
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
