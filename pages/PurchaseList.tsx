
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { PurchaseInvoice } from '../types';
import { t } from '../utils/t';
import { Search, Eye, PlusCircle, ArrowLeft, X, Printer, Filter, FileText, ChevronRight, ChevronLeft, Hash, Edit, Trash2, RefreshCcw, ShoppingCart, RotateCcw, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// @ts-ignore
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 15;

export default function PurchaseList() {
  const navigate = useNavigate();
  const currency = db.getSettings().currency;
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers] = useState(db.getSuppliers());
  const [products] = useState(db.getProductsWithBatches());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PURCHASE' | 'RETURN'>('ALL');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');

  // Modals State
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [conversionInvoice, setConversionInvoice] = useState<PurchaseInvoice | null>(null);

  const loadInvoices = () => {
    setInvoices(db.getPurchaseInvoices());
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const filtered = useMemo(() => {
      const results = invoices.filter(inv => {
          const supplier = suppliers.find(s => s.id === inv.supplier_id);
          const supplierName = supplier?.name.toLowerCase() || '';
          const matchSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) || 
                              (inv.document_number && inv.document_number.toLowerCase().includes(search.toLowerCase())) ||
                              supplierName.includes(search.toLowerCase());
          const matchType = filterType === 'ALL' || inv.type === filterType;
          return matchSearch && matchType;
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return results;
  }, [invoices, search, filterType, suppliers]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
      setCurrentPage(1);
  }, [search, filterType]);

  const handleJumpPage = (e: React.FormEvent) => {
      e.preventDefault();
      const p = parseInt(jumpPage);
      if (p >= 1 && p <= totalPages) {
          setCurrentPage(p);
          setJumpPage('');
      }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm("تحذير: هل أنت متأكد من حذف هذه الفاتورة؟ سيتم سحب الكميات من المخازن وتعديل رصيد المورد والخزينة تلقائياً.")) {
        await db.deletePurchaseInvoice(id);
        toast.success("تم حذف الفاتورة وعكس حركاتها بنجاح");
        loadInvoices();
    }
  };

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'غير معروف';
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'صنف غير معروف';

  // Conversion Actions
  const goToReturn = () => {
      if (!conversionInvoice) return;
      navigate('/purchases/return-from-invoice', { state: { preselectInvoice: conversionInvoice } });
      setConversionInvoice(null);
  };

  const copyToSales = () => {
      if (!conversionInvoice) return;
      const salesItems = conversionInvoice.items.map(item => ({
          product: products.find(p => p.id === item.product_id),
          quantity: item.quantity,
          unit_price: item.selling_price,
          discount_percentage: 0,
          bonus_quantity: item.bonus_quantity || 0
      }));
      navigate('/invoice/new', { state: { prefillItems: salesItems } });
      setConversionInvoice(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800">سجل المشتريات</h1>
            <p className="text-sm text-slate-500 mt-1">إجمالي الفواتير: {filtered.length} | صفحة {currentPage} من {totalPages || 1}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:flex-none">
                <Search className="absolute right-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="رقم الفاتورة أو المورد..." 
                    className="pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64 outline-none shadow-sm transition-shadow font-bold"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            
            <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <button onClick={() => setFilterType('ALL')} className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>الكل</button>
                <button onClick={() => setFilterType('PURCHASE')} className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${filterType === 'PURCHASE' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>مشتريات</button>
                <button onClick={() => setFilterType('RETURN')} className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${filterType === 'RETURN' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>مرتجع</button>
            </div>

            <button onClick={() => navigate('/purchases/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2 shrink-0">
                <PlusCircle className="w-5 h-5" />
                <span>فاتورة جديدة</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[900px]">
                <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] border-b border-slate-100 font-black">
                    <tr>
                        <th className="px-6 py-4">رقم الفاتورة</th>
                        <th className="px-6 py-4">رقم المستند</th>
                        <th className="px-6 py-4 text-center">التاريخ</th>
                        <th className="px-6 py-4">المورد</th>
                        <th className="px-6 py-4 text-center">النوع</th>
                        <th className="px-6 py-4 text-left">قيمة الفاتورة</th>
                        <th className="px-6 py-4 text-center">الإجراء</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                    {paginatedInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-6 py-4 font-mono text-blue-600">{inv.invoice_number}</td>
                            <td className="px-6 py-4 font-mono text-slate-400">{inv.document_number || '-'}</td>
                            <td className="px-6 py-4 text-center text-slate-500">{new Date(inv.date).toLocaleDateString('ar-EG')}</td>
                            <td className="px-6 py-4 font-black text-slate-800">{getSupplierName(inv.supplier_id)}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${inv.type === 'PURCHASE' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                    {inv.type === 'PURCHASE' ? 'شراء' : 'مرتجع'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-left font-black text-slate-900">{currency}{inv.total_amount.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setConversionInvoice(inv)} className="p-2 border border-slate-100 rounded-lg bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm transition-all" title="تحويل الفاتورة">
                                        <ArrowRightLeft className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setSelectedInvoice(inv)} className="p-2 border border-slate-100 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600 shadow-sm transition-all" title="معاينة">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => navigate(`/purchases/edit/${inv.id}`)} className="p-2 border border-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm transition-all" title="تعديل">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteInvoice(inv.id)} className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm transition-all" title="حذف">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {totalPages > 1 && (
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                    <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                    
                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum = currentPage;
                            if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;
                            if (pageNum <= 0 || pageNum > totalPages) return null;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleJumpPage} className="flex items-center gap-3">
                    <label htmlFor="jump_page_input" className="text-xs font-black text-slate-400 uppercase tracking-tighter">الذهاب لصفحة:</label>
                    <div className="relative">
                        <input 
                            id="jump_page_input"
                            type="number"
                            min="1"
                            max={totalPages}
                            className="w-20 border-2 border-slate-200 rounded-xl px-3 py-2 text-center font-black focus:border-blue-500 outline-none bg-white transition-all shadow-sm"
                            value={jumpPage}
                            onChange={e => setJumpPage(e.target.value)}
                            placeholder={currentPage.toString()}
                        />
                    </div>
                    <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-600 transition-all">انتقال</button>
                </form>
            </div>
        )}

        {filtered.length === 0 && (
            <div className="p-20 text-center text-slate-300 font-bold">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
                لم يتم العثور على فواتير تطابق البحث
            </div>
        )}
      </div>

      {/* --- Conversion Smart Modal --- */}
      {conversionInvoice && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in duration-200">
                  <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
                      <div>
                          <h3 className="text-xl font-black flex items-center gap-3">
                              <ArrowRightLeft className="w-6 h-6" /> تحويل فاتورة المشتريات
                          </h3>
                          <p className="text-xs text-indigo-100 font-bold mt-1">المرجع: {conversionInvoice.invoice_number} | المورد: {getSupplierName(conversionInvoice.supplier_id)}</p>
                      </div>
                      <button onClick={() => setConversionInvoice(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="p-8 space-y-6">
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                              <ShoppingCart className="w-3 h-3" /> ملخص أصناف الفاتورة
                          </h4>
                          <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                              {conversionInvoice.items.map((item, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs font-bold text-slate-600">
                                      <span className="truncate max-w-[180px]">{getProductName(item.product_id)}</span>
                                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-100 text-indigo-600">{item.quantity} قطعة</span>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                          <button 
                            onClick={goToReturn}
                            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all group text-right"
                          >
                              <div className="p-3 rounded-xl bg-red-100 text-red-600 group-hover:scale-110 transition-transform">
                                  <RotateCcw className="w-6 h-6" />
                              </div>
                              <div>
                                  <div className="font-black text-slate-800">تحويل لمرتجع مشتريات</div>
                                  <p className="text-[10px] text-slate-400 font-bold">يخصم الكميات من المخزون ويخفض رصيد المورد</p>
                              </div>
                          </button>

                          <button 
                            onClick={copyToSales}
                            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-100 hover:border-blue-600 hover:bg-blue-50 transition-all group text-right"
                          >
                              <div className="p-3 rounded-xl bg-blue-100 text-blue-600 group-hover:scale-110 transition-transform">
                                  <ShoppingCart className="w-6 h-6" />
                              </div>
                              <div>
                                  <div className="font-black text-slate-800">نسخ لفاتورة مبيعات جديدة</div>
                                  <p className="text-[10px] text-slate-400 font-bold">يفتح فاتورة مبيعات محملة بالأصناف بأسعار البيع</p>
                              </div>
                          </button>
                      </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t flex justify-center">
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-2">
                          <AlertCircle className="w-3 h-3" /> ميزة التحويل الذكي تحافظ على دقة البيانات وتوفر وقت الإدخال
                      </p>
                  </div>
              </div>
          </div>
      )}

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
                          </div>
                      </div>
                      <button onClick={() => setSelectedInvoice(null)} className="p-3 hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-400 transition-all"><X className="w-6 h-6" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-8 bg-white">
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse min-w-[600px]">
                              <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase font-black">
                                      <th className="p-4 text-right">الصنف</th>
                                      <th className="p-4 text-center">الكمية</th>
                                      <th className="p-4 text-center">سعر التكلفة</th>
                                      <th className="p-4 text-left">الإجمالي الفرعي</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {selectedInvoice.items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-4 font-black text-slate-800">{getProductName(item.product_id)}</td>
                                          <td className="p-4 text-center font-black text-slate-700 bg-slate-50/30">{item.quantity}</td>
                                          <td className="p-4 text-center font-bold text-slate-600">{currency}{item.cost_price.toLocaleString()}</td>
                                          <td className="p-4 text-left font-black text-slate-900">{currency}{(item.quantity * item.cost_price).toLocaleString()}</td>
                                      </tr>
                                  ))}
                              </tbody>
                              <tfoot className="border-t-4 border-slate-100">
                                  <tr>
                                      <td colSpan={3} className="p-4 text-left font-black text-slate-500 uppercase text-xs">إجمالي قيمة الفاتورة</td>
                                      <td className="p-4 text-left font-black text-2xl text-blue-600">{currency}{selectedInvoice.total_amount.toLocaleString()}</td>
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
