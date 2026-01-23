
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Supplier, PurchaseInvoice, PurchaseItem } from '../types';
import { Search, RotateCcw, Truck, FileText, ChevronRight, CheckCircle2, ArrowLeft, Trash2, Save, X, AlertCircle, Loader2 } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { t } from '../utils/t';
// @ts-ignore
import toast from 'react-hot-toast';

export default function PurchaseReturn() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [supplierInvoices, setSupplierInvoices] = useState<PurchaseInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [returnItems, setReturnItems] = useState<PurchaseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashRefund, setCashRefund] = useState(0);

  const currency = db.getSettings().currency;

  useEffect(() => {
    setSuppliers(db.getSuppliers());
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      const invoices = db.getPurchaseInvoices().filter(inv => inv.supplier_id === selectedSupplier && inv.type === 'PURCHASE');
      setSupplierInvoices(invoices);
      setSelectedInvoice(null);
      setReturnItems([]);
    }
  }, [selectedSupplier]);

  const supplierOptions = useMemo(() => 
    suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone })), 
  [suppliers]);

  const handleSelectInvoice = (inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    // Initialize return items with 0 quantity initially
    const items = inv.items.map(item => ({
      ...item,
      quantity: 0
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
      return sum + (item.quantity * (item.cost_price || 0));
    }, 0);
  }, [returnItems]);

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error("يرجى تحديد كميات للإرجاع أولاً");
      return;
    }

    if (!confirm("هل أنت متأكد من تسجيل هذا المرتجع؟ سيتم تقليل المخزون وخصم القيمة من حساب المورد.")) return;

    setIsSubmitting(true);

    try {
      // Logic: Create a new purchase invoice of type 'RETURN'
      // db.createPurchaseInvoice handles stock deduction and liability reduction when isReturn = true
      const result = await db.createPurchaseInvoice(
        selectedSupplier,
        itemsToReturn,
        cashRefund, // If we receive cash back from supplier, it records a receipt
        true // isReturn = true
      );

      if (result.success) {
        toast.success("تم تسجيل مرتجع المشتريات بنجاح");
        // Reset
        setSelectedSupplier('');
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

  const getProductName = (id: string) => {
      return db.getProductsWithBatches().find(p => p.id === id)?.name || "صنف غير معروف";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <RotateCcw className="w-8 h-8 text-red-600" />
          مرتجع مشتريات (من فاتورة سابقة)
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Select Supplier & Invoice */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100">
            <label className="block text-sm font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" /> الخطوة 1: اختيار المورد
            </label>
            <SearchableSelect 
              options={supplierOptions}
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              placeholder="ابحث عن المورد..."
            />
          </div>

          {selectedSupplier && (
            <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100 animate-in slide-in-from-top-4">
              <label className="block text-sm font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-500" /> الخطوة 2: اختر فاتورة الشراء
              </label>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {supplierInvoices.length > 0 ? (
                  supplierInvoices.map(inv => (
                    <button 
                      key={inv.id}
                      onClick={() => handleSelectInvoice(inv)}
                      className={`w-full text-right p-4 rounded-2xl border transition-all flex justify-between items-center group ${selectedInvoice?.id === inv.id ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <div>
                        <div className={`font-black ${selectedInvoice?.id === inv.id ? 'text-red-700' : 'text-slate-700'}`}>فاتورة #{inv.invoice_number}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{new Date(inv.date).toLocaleDateString('ar-EG')}</div>
                      </div>
                      <div className="text-left">
                        <div className="font-black text-slate-900">{currency}{inv.total_amount.toLocaleString()}</div>
                        <ChevronRight className={`w-4 h-4 mt-1 transition-transform ${selectedInvoice?.id === inv.id ? 'translate-x-[-4px] text-red-500' : 'text-slate-300'}`} />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-10 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold">لا توجد فواتير مشتريات سابقة لهذا المورد</p>
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
                  <p className="text-xs text-slate-500 font-bold mt-1">حدد الكميات التي تريد ردها للمورد</p>
                </div>
                <button 
                  onClick={handleFullReturn}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-black hover:bg-red-200 transition-colors"
                >
                  إرجاع الفاتورة بالكامل
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">الصنف</th>
                      <th className="px-6 py-4 text-center">الكمية المشتراة</th>
                      <th className="px-6 py-4 text-center">الكمية المرتجعة</th>
                      <th className="px-6 py-4 text-center">سعر التكلفة</th>
                      <th className="px-6 py-4 text-left">إجمالي المرتجع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedInvoice.items.map((item, idx) => {
                      const returnItem = returnItems[idx];
                      const lineTotal = (returnItem?.quantity || 0) * (item.cost_price || 0);
                      
                      return (
                        <tr key={idx} className={`transition-colors ${returnItem?.quantity > 0 ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{getProductName(item.product_id)}</div>
                            <div className="text-[10px] text-slate-400">Batch: {item.batch_number}</div>
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
                                  className={`w-20 border-2 rounded-xl p-2 text-center font-black outline-none transition-all ${returnItem?.quantity > 0 ? 'border-red-500 bg-white ring-4 ring-red-50' : 'border-slate-100 bg-slate-50 focus:border-blue-400'}`}
                                  value={returnItem?.quantity || ''}
                                  placeholder="0"
                                  onChange={(e) => updateReturnQty(idx, parseInt(e.target.value) || 0, item.quantity)}
                                />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-500">
                            {currency}{(item.cost_price || 0).toLocaleString()}
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
                  <span className="text-slate-400 text-[10px] font-black uppercase">إجمالي قيمة المرتجع للمورد</span>
                  <div className="text-4xl font-black text-red-400">{currency}{returnTotal.toLocaleString()}</div>
                  <p className="text-[10px] text-slate-500">سيتم تخفيض هذا المبلغ من حساب المورد تلقائياً</p>
                </div>

                <div className="flex flex-col gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-400 whitespace-nowrap">نقدية مستلمة (كاش):</label>
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
                      className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Save className="w-6 h-6 text-white" />}
                      تأكيد المرتجع وحفظ البيانات
                    </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center opacity-60">
              <RotateCcw className="w-16 h-16 text-slate-200 mb-4 animate-reverse-spin" style={{ animationDuration: '10s' }} />
              <h3 className="text-xl font-bold text-slate-400">يرجى اختيار مورد ثم فاتورة شراء لبدء عملية المرتجع</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
