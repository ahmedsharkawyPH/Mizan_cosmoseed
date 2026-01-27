
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { Customer, Invoice, CartItem } from '../types';
import { Search, RotateCcw, User, FileText, ChevronRight, CheckCircle2, ArrowLeft, Trash2, Save, X, AlertCircle, Filter } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { t } from '../utils/t';
// @ts-ignore
import toast from 'react-hot-toast';

export default function SalesReturn() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashRefund, setCashRefund] = useState(0);
  const [invoiceSearch, setInvoiceSearch] = useState(''); // حالة البحث الجديد

  const currency = db.getSettings().currency;

  useEffect(() => {
    setCustomers(db.getCustomers());
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      const invoices = db.getInvoices().filter(inv => inv.customer_id === selectedCustomer && inv.type === 'SALE');
      setCustomerInvoices(invoices);
      setSelectedInvoice(null);
      setReturnItems([]);
      setInvoiceSearch(''); // تصفية البحث عند تغيير العميل
    }
  }, [selectedCustomer]);

  const customerOptions = useMemo(() => 
    customers.map(c => ({ value: c.id, label: c.name, subLabel: c.phone })), 
  [customers]);

  // منطق تصفية الفواتير بناءً على رقم الفاتورة أو المنتج
  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return customerInvoices;
    
    const query = invoiceSearch.toLowerCase();
    return customerInvoices.filter(inv => {
      // 1. البحث برقم الفاتورة
      if (inv.invoice_number.includes(query)) return true;
      
      // 2. البحث باسم أو كود منتج داخل الفاتورة
      return inv.items.some(item => 
        item.product.name.toLowerCase().includes(query) || 
        item.product.code?.toLowerCase().includes(query)
      );
    });
  }, [customerInvoices, invoiceSearch]);

  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    // Initialize return items with 0 quantity initially
    const items = inv.items.map(item => ({
      ...item,
      quantity: 0,
      bonus_quantity: 0 
    }));
    setReturnItems(items);
  };

  const updateReturnQty = (idx: number, qty: number, max: number) => {
    const newItems = [...returnItems];
    const finalQty = Math.min(Math.max(0, qty), max);
    newItems[idx].quantity = finalQty;
    setReturnItems(newItems);
  };

  const returnTotal = useMemo(() => {
    return returnItems.reduce((sum, item) => {
      const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
      return sum + (item.quantity * price * (1 - (item.discount_percentage / 100)));
    }, 0);
  }, [returnItems]);

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error("يرجى تحديد كميات للإرجاع أولاً");
      return;
    }

    if (!confirm("هل أنت متأكد من تسجيل هذا المرتجع؟ سيتم تحديث المخزون وحساب العميل.")) return;

    setIsSubmitting(true);
    const user = authService.getCurrentUser();

    try {
      const result = await db.createInvoice(
        selectedCustomer,
        itemsToReturn,
        cashRefund,
        true,
        0,
        user ? { id: user.id, name: user.name } : undefined
      );

      if (result.success) {
        toast.success("تم تسجيل المرتجع بنجاح");
        setSelectedCustomer('');
        setSelectedInvoice(null);
        setReturnItems([]);
        setCashRefund(0);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFullReturn = () => {
    if (!selectedInvoice) return;
    const items = selectedInvoice.items.map(item => ({ ...item }));
    setReturnItems(items);
    toast.success("تم تحديد الفاتورة بالكامل للإرجاع");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <RotateCcw className="w-8 h-8 text-orange-600" />
          مرتجع مبيعات
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Select Customer & Invoice */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100">
            <label className="block text-sm font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" /> الخطوة 1: اختيار العميل
            </label>
            <SearchableSelect 
              options={customerOptions}
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              placeholder="ابحث عن العميل..."
            />
          </div>

          {selectedCustomer && (
            <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100 animate-in slide-in-from-top-4 flex flex-col min-h-[500px]">
              <label className="block text-sm font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" /> الخطوة 2: اختر الفاتورة
              </label>
              
              {/* حقل البحث الجديد عن الفاتورة */}
              <div className="relative mb-4">
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="بحث برقم الفاتورة أو اسم المنتج..."
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                />
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map(inv => (
                    <button 
                      key={inv.id}
                      onClick={() => handleSelectInvoice(inv)}
                      className={`w-full text-right p-4 rounded-2xl border transition-all flex justify-between items-center group ${selectedInvoice?.id === inv.id ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-100' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <div>
                        <div className={`font-black ${selectedInvoice?.id === inv.id ? 'text-orange-700' : 'text-slate-700'}`}>فاتورة #{inv.invoice_number}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{new Date(inv.date).toLocaleDateString('ar-EG')}</div>
                      </div>
                      <div className="text-left">
                        <div className="font-black text-slate-900">{currency}{inv.net_total.toLocaleString()}</div>
                        <ChevronRight className={`w-4 h-4 mt-1 transition-transform ${selectedInvoice?.id === inv.id ? 'translate-x-[-4px] text-orange-500' : 'text-slate-300'}`} />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-20 text-center text-slate-400">
                    {invoiceSearch ? (
                      <>
                        <Filter className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p className="text-xs font-bold">لا توجد نتائج تطابق بحثك</p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p className="text-xs font-bold">لا توجد فواتير مبيعات سابقة لهذا العميل</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Select Items to Return */}
        <div className="lg:col-span-2">
          {selectedInvoice ? (
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden animate-in zoom-in duration-300">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    أصناف الفاتورة #{selectedInvoice.invoice_number}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">حدد الكميات التي تريد إرجاعها للمخزن</p>
                </div>
                <button 
                  onClick={handleFullReturn}
                  className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl text-xs font-black hover:bg-orange-200 transition-colors"
                >
                  إرجاع الفاتورة بالكامل
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">الصنف</th>
                      <th className="px-6 py-4 text-center">الكمية المباعة</th>
                      <th className="px-6 py-4 text-center">الكمية المرتجعة</th>
                      <th className="px-6 py-4 text-center">السعر</th>
                      <th className="px-6 py-4 text-left">الإجمالي المرتجع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedInvoice.items.map((item, idx) => {
                      const returnItem = returnItems[idx];
                      const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
                      const lineTotal = (returnItem?.quantity || 0) * price * (1 - (item.discount_percentage / 100));
                      
                      return (
                        <tr key={idx} className={`transition-colors ${returnItem?.quantity > 0 ? 'bg-orange-50/30' : 'hover:bg-slate-50/50'}`}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{item.product.name}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <input 
                                  type="number"
                                  min="0"
                                  max={item.quantity}
                                  className={`w-20 border-2 rounded-xl p-2 text-center font-black outline-none transition-all ${returnItem?.quantity > 0 ? 'border-orange-500 bg-white ring-4 ring-orange-50' : 'border-slate-100 bg-slate-50 focus:border-blue-400'}`}
                                  value={returnItem?.quantity || ''}
                                  placeholder="0"
                                  onChange={(e) => updateReturnQty(idx, parseInt(e.target.value) || 0, item.quantity)}
                                />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-500">
                            {currency}{price.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-left font-black text-slate-900">
                            {currency}{lineTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-8 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 text-[10px] font-black uppercase">إجمالي قيمة المرتجع</span>
                  <div className="text-4xl font-black text-orange-400">{currency}{returnTotal.toLocaleString()}</div>
                  <p className="text-[10px] text-slate-500">سيتم خصم هذا المبلغ من حساب العميل تلقائياً</p>
                </div>

                <div className="flex flex-col gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-400 whitespace-nowrap">نقدية مستردة (كاش):</label>
                        <input 
                          type="number" 
                          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white font-black outline-none focus:bg-white/20 transition-all w-32"
                          value={cashRefund || ''}
                          placeholder="0.00"
                          onChange={e => setCashRefund(parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <button 
                      onClick={handleSubmitReturn}
                      disabled={isSubmitting || returnTotal <= 0}
                      className="bg-orange-500 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <span className="loader"></span> : <Save className="w-6 h-6" />}
                      تأكيد المرتجع وحفظ البيانات
                    </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center opacity-60">
              <RotateCcw className="w-16 h-16 text-slate-200 mb-4 animate-reverse-spin" style={{ animationDuration: '10s' }} />
              <h3 className="text-xl font-bold text-slate-400">يرجى اختيار عميل ثم فاتورة لبدء عملية الإرجاع</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
