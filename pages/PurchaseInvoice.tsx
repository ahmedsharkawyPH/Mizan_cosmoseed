
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseItem, PurchaseInvoice as IPurchaseInvoice } from '../types';
import { Plus, Save, ArrowLeft, Trash2, Edit, PackagePlus, X, TrendingUp, AlertCircle, FileText, Calendar, CheckCircle2, Hash, Clock, History, Truck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import SearchableSelect, { SearchableSelectRef } from '../components/SearchableSelect';
// @ts-ignore
import toast from 'react-hot-toast';

interface Props {
  type: 'PURCHASE' | 'RETURN';
}

export default function PurchaseInvoice({ type }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const currency = db.getSettings().currency;
  const isReturn = type === 'RETURN';
  
  const [suppliers, setSuppliers] = useState(db.getSuppliers());
  const [products, setProducts] = useState(db.getProductsWithBatches());
  const [warehouses] = useState(db.getWarehouses());
  
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); 
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selProd, setSelProd] = useState('');
  const [qty, setQty] = useState(1);
  const [bonus, setBonus] = useState(0); 
  const [cost, setCost] = useState(0);
  const [margin, setMargin] = useState(0); 
  const [sell, setSell] = useState(0);

  const productRef = useRef<SearchableSelectRef>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const bonusRef = useRef<HTMLInputElement>(null); 
  const marginRef = useRef<HTMLInputElement>(null);
  const sellRef = useRef<HTMLInputElement>(null);
  
  // مرجع لتتبع آخر صنف تم معالجته لمنع تكرار الـ Focus
  const lastProcessedProdId = useRef<string>('');

  useEffect(() => {
    const def = warehouses.find(w => w.is_default);
    if(def) setSelectedWarehouse(def.id);

    if (id) {
        const inv = db.getPurchaseInvoices().find(i => i.id === id);
        if (inv) {
            setIsLoadingInvoice(true);
            setSelectedSupplier(inv.supplier_id);
            setDocumentNo(inv.document_number || '');
            setManualDate(inv.date.split('T')[0]);
            setCart(inv.items);
            setCashPaid(inv.paid_amount);
            setIsLoadingInvoice(false);
        }
    }

    const checkSync = setInterval(() => {
        if (db.isFullyLoaded) {
            setProducts(db.getProductsWithBatches());
            setSuppliers(db.getSuppliers());
        }
    }, 2000);
    return () => clearInterval(checkSync);
  }, [id, warehouses]);

  const lastPurchasesIntelligence = useMemo(() => {
    if (!selProd) return [];
    const allInvoices = db.getPurchaseInvoices();
    const historyData: { price: number, supplierName: string, date: string }[] = [];

    allInvoices.forEach(inv => {
        if (inv.type === 'PURCHASE') {
            const item = inv.items.find(i => i.product_id === selProd);
            if (item) {
                const supplier = suppliers.find(s => s.id === inv.supplier_id);
                historyData.push({
                    price: item.cost_price,
                    supplierName: supplier?.name || 'غير معروف',
                    date: inv.date
                });
            }
        }
    });

    return historyData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  }, [selProd, suppliers]);

  const handleCostChange = (val: number) => {
    setCost(val);
    if (val > 0 && margin > 0) {
      const calculatedSell = val * (1 + margin / 100);
      setSell(parseFloat(calculatedSell.toFixed(2)));
    } else if (val > 0 && sell > 0) {
      const calculatedMargin = ((sell / val) - 1) * 100;
      setMargin(parseFloat(calculatedMargin.toFixed(1)));
    }
  };

  const handleMarginChange = (val: number) => {
    setMargin(val);
    if (cost > 0) {
      const calculatedSell = cost * (1 + val / 100);
      setSell(parseFloat(calculatedSell.toFixed(2)));
    }
  };

  const handleSellChange = (val: number) => {
    setSell(val);
    if (cost > 0 && val > 0) {
      const calculatedMargin = ((val / cost) - 1) * 100;
      setMargin(parseFloat(calculatedMargin.toFixed(1)));
    }
  };

  useEffect(() => {
    // التغيير هنا: نتأكد أن الصنف المختار هو صنف جديد فعلاً ولم نقم بعمل Focus له من قبل
    if (selProd && editingIndex === null && selProd !== lastProcessedProdId.current) {
      const p = products.find(x => x.id === selProd);
      if (p) {
        let initialCost = p.purchase_price || 0;
        let initialSell = p.selling_price || 0;
        
        if (p.batches.length > 0) {
          const lastBatch = p.batches[p.batches.length-1];
          initialCost = lastBatch.purchase_price;
          initialSell = lastBatch.selling_price;
        }
        
        setCost(initialCost);
        setSell(initialSell);
        if (initialCost > 0) {
            setMargin(parseFloat((((initialSell / initialCost) - 1) * 100).toFixed(1)));
        } else {
            setMargin(0);
        }
        
        lastProcessedProdId.current = selProd;
        setTimeout(() => costRef.current?.focus(), 100);
      }
    } else if (!selProd) {
      lastProcessedProdId.current = '';
    }
  }, [selProd, products, editingIndex]);

  const addItem = () => {
    if (!selProd) {
        toast.error("يرجى اختيار الصنف أولاً");
        return;
    }
    if (Number(qty) <= 0 && Number(bonus) <= 0) {
        toast.error("الكمية أو البونص يجب أن تكون أكبر من صفر");
        return;
    }

    const newItem: PurchaseItem = {
      product_id: selProd,
      warehouse_id: selectedWarehouse,
      batch_number: editingIndex !== null ? cart[editingIndex].batch_number : `BATCH-${Date.now().toString().slice(-6)}`,
      quantity: Number(qty),
      bonus_quantity: Number(bonus),
      cost_price: Number(cost),
      selling_price: Number(sell),
      expiry_date: '2099-12-31',
      serial_number: editingIndex !== null ? cart[editingIndex].serial_number : cart.length + 1
    };
    
    if (editingIndex !== null) {
        const updatedCart = [...cart];
        updatedCart[editingIndex] = newItem;
        setCart(updatedCart);
        setEditingIndex(null);
        toast.success("تم تحديث الصنف");
    } else {
        setCart(prev => [...prev, newItem]);
        toast.success("تمت الإضافة للفاتورة");
    }

    setSelProd('');
    setQty(1);
    setBonus(0);
    setCost(0);
    setMargin(0);
    setSell(0);
    lastProcessedProdId.current = ''; // تصفير المرجع بعد الإضافة
    
    setTimeout(() => productRef.current?.focus(), 100);
  };

  const handleEditItem = (index: number) => {
      const item = cart[index];
      setEditingIndex(index);
      setSelProd(item.product_id);
      lastProcessedProdId.current = item.product_id; // نمنع الـ Focus التلقائي لأنه وضع تعديل
      setQty(item.quantity);
      setBonus(item.bonus_quantity || 0);
      setCost(item.cost_price);
      setSell(item.selling_price);
      if (item.cost_price > 0) {
          setMargin(parseFloat((((item.selling_price / item.cost_price) - 1) * 100).toFixed(1)));
      }
      setSelectedWarehouse(item.warehouse_id);
      toast("تم تحميل بيانات الصنف للتعديل");
  };

  const cancelEdit = () => {
      setEditingIndex(null);
      setSelProd('');
      setQty(1);
      setBonus(0);
      setCost(0);
      setMargin(0);
      setSell(0);
      lastProcessedProdId.current = '';
  };

  const save = async () => {
    if (!selectedSupplier) {
        toast.error("يرجى اختيار المورد أولاً");
        return;
    }
    if (cart.length === 0) {
        toast.error("الفاتورة فارغة");
        return;
    }
    
    if (id) {
        await db.deletePurchaseInvoice(id);
    }
    
    const res = await db.createPurchaseInvoice(selectedSupplier, cart, cashPaid, isReturn, documentNo, manualDate);
    if (res.success) {
        toast.success(id ? "تم تحديث الفاتورة بنجاح" : "تم حفظ الفاتورة بنجاح");
        navigate('/purchases/list');
    } else {
        toast.error(res.message);
    }
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);

  if (isLoadingInvoice) return <div className="p-20 text-center font-bold">جاري تحميل بيانات الفاتورة...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/purchases/list')} className="p-2 hover:bg-gray-100 rounded-full transition-all"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className={`text-2xl font-black ${isReturn ? 'text-red-600' : 'text-blue-600'}`}>
            {id ? 'تعديل فاتورة مشتريات' : (isReturn ? t('pur.return_title') : t('pur.title'))}
        </h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                <div className="md:col-span-5">
                    <SearchableSelect 
                        id="purchase_supplier_select_input"
                        name="supplier_id"
                        label={t('pur.select_supplier')} 
                        placeholder="ابحث عن المورد..." 
                        options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))} 
                        value={selectedSupplier} 
                        onChange={setSelectedSupplier} 
                    />
                </div>
                {selectedSupplier && (
                    <>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-slate-400 mb-1 flex items-center gap-2">
                                <Hash className="w-3 h-3" /> رقم الفاتورة
                            </label>
                            <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl text-slate-500 font-black text-center">
                                {id ? db.getPurchaseInvoices().find(i => i.id === id)?.invoice_number : 'تلقائي'}
                            </div>
                        </div>
                        <div className="md:col-span-3">
                            <label htmlFor="purchase_document_no_input" className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-orange-400" /> رقم مستند المورد
                            </label>
                            <input 
                                id="purchase_document_no_input"
                                name="document_number"
                                type="text" 
                                className="w-full border-2 border-orange-100 p-2.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50/20 focus:bg-white"
                                placeholder="رقم الفاتورة الورقية"
                                value={documentNo}
                                onChange={e => setDocumentNo(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="purchase_manual_date_input" className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" /> التاريخ
                            </label>
                            <input 
                                id="purchase_manual_date_input"
                                name="manual_date"
                                type="date" 
                                className="w-full border p-2.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                                value={manualDate}
                                onChange={e => setManualDate(e.target.value)}
                            />
                        </div>
                    </>
                )}
            </div>
          </div>

          <div className={`bg-white p-6 rounded-2xl shadow-card border-2 transition-all ${editingIndex !== null ? 'border-orange-400 ring-4 ring-orange-50' : 'border-slate-100'} space-y-6`}>
            <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-black text-slate-700 flex items-center gap-2">
                    {editingIndex !== null ? <Edit className="w-5 h-5 text-orange-500" /> : <TrendingUp className="w-5 h-5 text-blue-500" />}
                    {editingIndex !== null ? 'تعديل الصنف' : 'إضافة أصناف'}
                </h3>
                <div className="flex items-center gap-3">
                    {editingIndex !== null && (
                        <button onClick={cancelEdit} className="text-red-500 hover:text-red-700 text-xs font-black flex items-center gap-1 px-3 py-1 bg-red-50 rounded-lg transition-colors border border-red-100">
                             إلغاء
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                      <label htmlFor="purchase_warehouse_select_input" className="text-xs font-black text-slate-400">المخزن:</label>
                      <select id="purchase_warehouse_select_input" name="warehouse_id" className="text-xs border p-1.5 rounded-lg font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                </div>
            </div>
            
            <div className="space-y-5">
              <div className="w-full">
                  <SearchableSelect 
                      id="purchase_product_select_input"
                      name="product_id"
                      ref={productRef} 
                      label={t('inv.product')} 
                      placeholder="ابحث عن الصنف بالاسم أو الكود..." 
                      options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.code }))} 
                      value={selProd} 
                      onChange={setSelProd} 
                      disabled={!selectedSupplier}
                      className="w-full"
                  />
                  {selProd && lastPurchasesIntelligence.length > 0 && (
                      <div className="mt-2 flex gap-4 animate-in fade-in">
                          <span className="text-[10px] font-bold text-slate-400">آخر أسعار شراء:</span>
                          {lastPurchasesIntelligence.map((p, i) => (
                              <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black border border-blue-100">
                                {currency}{p.price.toLocaleString()} ({p.supplierName})
                              </span>
                          ))}
                      </div>
                  )}
              </div>

              {/* صف الإدخال المرتب حسب طلب المستخدم */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-2">
                      <label htmlFor="purchase_cost_input" className="text-[10px] font-black text-slate-400 uppercase mb-1 block">سعر التكلفة</label>
                      <input id="purchase_cost_input" name="cost_price" ref={costRef} type="number" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold outline-none focus:border-blue-500 transition-all" value={cost || ''} onChange={e => handleCostChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && qtyRef.current?.focus()} disabled={!selProd} placeholder="0.00" />
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="purchase_qty_input" className="text-[10px] font-black text-slate-400 uppercase mb-1 block">الكمية</label>
                      <input id="purchase_qty_input" name="quantity" ref={qtyRef} type="number" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-black text-center outline-none focus:border-blue-500 transition-all" value={qty || ''} onChange={e => setQty(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && bonusRef.current?.focus()} disabled={!selProd} placeholder="1" />
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="purchase_bonus_input" className="text-[10px] font-black text-orange-400 uppercase mb-1 block">بونص</label>
                      <input id="purchase_bonus_input" name="bonus_quantity" ref={bonusRef} type="number" className="w-full border-2 border-orange-100 p-2.5 rounded-xl font-black text-center outline-none focus:border-orange-500 transition-all bg-orange-50/10" value={bonus || ''} onChange={e => setBonus(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && marginRef.current?.focus()} disabled={!selProd} placeholder="0" />
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="purchase_margin_input" className="text-[10px] font-black text-indigo-600 uppercase mb-1 block">الربح %</label>
                      <input id="purchase_margin_input" name="profit_margin" ref={marginRef} type="number" className="w-full border-2 border-indigo-100 p-2.5 rounded-xl font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/20" value={margin || ''} onChange={e => handleMarginChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && sellRef.current?.focus()} disabled={!selProd} placeholder="%" />
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="purchase_sell_price_input" className="text-[10px] font-black text-emerald-600 uppercase mb-1 block">سعر البيع</label>
                      <input id="purchase_sell_price_input" name="selling_price" ref={sellRef} type="number" className="w-full border-2 border-emerald-100 p-2.5 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500 transition-all bg-emerald-50/20" value={sell || ''} onChange={e => handleSellChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && addItem()} disabled={!selProd} placeholder="0.00" />
                  </div>
                  <div className="md:col-span-2">
                      <button id="purchase_add_btn" name="add_to_cart" onClick={addItem} type="button" className={`w-full ${editingIndex !== null ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white h-[46px] rounded-xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50`} disabled={!selProd}>
                          {editingIndex !== null ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          {editingIndex !== null ? 'تعديل' : 'إضافة'}
                      </button>
                  </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                   <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                      <tr>
                         <th className="px-4 py-4 text-center">#</th>
                         <th className="px-4 py-4">اسم الصنف</th>
                         <th className="px-4 py-4 text-center">الكمية</th>
                         <th className="px-4 py-4 text-center">البونص</th>
                         <th className="px-4 py-4 text-center">سعر الشراء</th>
                         <th className="px-4 py-4 text-center">سعر البيع</th>
                         <th className="px-4 py-4 text-left">الإجمالي</th>
                         <th className="px-4 py-4 text-center">إجراء</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {cart.map((item, idx) => (
                         <tr key={idx} className={`hover:bg-slate-50 transition-colors font-bold ${editingIndex === idx ? 'bg-orange-50' : ''}`}>
                            <td className="px-4 py-4 text-center text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-4 py-4 text-slate-800">{products.find(x => x.id === item.product_id)?.name}</td>
                            <td className="px-4 py-4 text-center">{item.quantity}</td>
                            <td className="px-4 py-4 text-center">
                               {item.bonus_quantity > 0 ? (
                                   <span className="text-orange-600">+{item.bonus_quantity}</span>
                               ) : "-"}
                            </td>
                            <td className="px-4 py-4 text-center text-slate-600">{currency}{item.cost_price.toLocaleString()}</td>
                            <td className="px-4 py-4 text-center text-emerald-600">{currency}{item.selling_price.toLocaleString()}</td>
                            <td className="px-4 py-4 text-left font-black">{currency}{(item.quantity * item.cost_price).toLocaleString()}</td>
                            <td className="px-4 py-4 text-center">
                               <div className="flex justify-center gap-2">
                                  <button onClick={() => handleEditItem(idx)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="تعديل"><Edit className="w-4 h-4" /></button>
                                  <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="حذف"><Trash2 className="w-4 h-4" /></button>
                               </div>
                            </td>
                         </tr>
                      ))}
                      {cart.length === 0 && (
                          <tr>
                              <td colSpan={8} className="p-10 text-center text-slate-300 font-bold">لا توجد أصناف مضافة بعد</td>
                          </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        <div className="w-full xl:w-96 bg-white p-8 rounded-2xl shadow-card border border-slate-100 h-fit space-y-6 sticky top-6">
            <h3 className="font-black text-slate-800 text-lg border-b pb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500" /> ملخص الفاتورة
            </h3>
            
            <div className="space-y-4">
                <div className="bg-blue-50/50 p-6 rounded-2xl border-2 border-blue-100">
                    <div className="text-xs text-blue-500 font-black uppercase mb-1">إجمالي الفاتورة</div>
                    <div className="text-4xl font-black text-blue-700">{currency}{totalAmount.toLocaleString()}</div>
                </div>

                <div>
                    <label htmlFor="purchase_cash_paid_input" className="block text-xs font-black text-slate-400 uppercase mb-2">المسدد نقداً (كاش)</label>
                    <input 
                        id="purchase_cash_paid_input"
                        name="paid_amount"
                        type="number" 
                        className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-2xl text-emerald-600 bg-emerald-50/20 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all" 
                        value={cashPaid || ''} 
                        onChange={e => setCashPaid(Number(e.target.value))} 
                        placeholder="0.00" 
                        disabled={!selectedSupplier} 
                    />
                    <div className="mt-2 text-xs text-slate-400 font-bold">
                        المتبقي على الحساب: <span className="text-red-500">{currency}{(totalAmount - cashPaid).toLocaleString()}</span>
                    </div>
                </div>

                <div className="pt-4">
                    <button id="purchase_finalize_btn" name="finalize_invoice" onClick={save} disabled={cart.length === 0 || !selectedSupplier} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
                        <Save className="w-6 h-6" />
                        {id ? 'حفظ التعديلات' : 'حفظ الفاتورة'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
