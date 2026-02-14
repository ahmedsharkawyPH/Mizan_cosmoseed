
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { useData } from '../context/DataContext';
import { authService } from '../services/auth';
import { Customer, ProductWithBatches, CartItem, BatchStatus } from '../types';
import { Plus, Trash2, Save, Search, AlertCircle, Calculator, Package, Users, ArrowLeft, ChevronDown, Printer, Settings as SettingsIcon, Check, X, Eye, RotateCcw, ShieldAlert, Lock, Percent, Info, Tag, RefreshCw, AlertTriangle, ListChecks, Coins, TrendingDown, Layers, ShoppingBag } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { t } from '../utils/t';
import SearchableSelect, { SearchableSelectRef } from '../components/SearchableSelect';
// @ts-ignore
import toast from 'react-hot-toast';

interface InvoiceSettings {
    enableManualPrice: boolean;
    enableDiscount: boolean;
    showCostInfo: boolean;
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { createInvoice, updateInvoice } = useData();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [warehouses] = useState(db.getWarehouses());
  
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashPayment, setCashPayment] = useState<number>(0);
  const [additionalDiscount, setAdditionalDiscount] = useState<number>(0);
  const [additionalDiscountPercent, setAdditionalDiscountPercent] = useState<number>(0);
  const [commissionValue, setCommissionValue] = useState<number>(0); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceSettings>(() => {
      const saved = localStorage.getItem('invoice_settings');
      return saved ? JSON.parse(saved) : { enableManualPrice: true, enableDiscount: true, showCostInfo: false };
  });

  useEffect(() => {
      localStorage.setItem('invoice_settings', JSON.stringify(invoiceConfig));
  }, [invoiceConfig]);

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [bonus, setBonus] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [manualPrice, setManualPrice] = useState<number>(0);

  const customerRef = useRef<SearchableSelectRef>(null);
  const productRef = useRef<SearchableSelectRef>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const bonusRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);

  const currency = db.getSettings().currency;

  useEffect(() => {
    setCustomers(db.getCustomers());
    const allBaseProducts = db.getAllProducts().filter(p => p.status !== 'INACTIVE');
    const productsWithStockInfo = db.getProductsWithBatches();
    const completeProductsList = allBaseProducts.map(p => {
        const enriched = productsWithStockInfo.find(pb => pb.id === p.id);
        return { ...p, batches: enriched ? enriched.batches : [] } as ProductWithBatches;
    });
    setProducts(completeProductsList);
    const def = db.getWarehouses().find(w => w.is_default);
    if(def) setSelectedWarehouse(def.id);
    if (location.state && (location.state as any).prefillItems) setCart((location.state as any).prefillItems);
    if (id) {
      const inv = db.getInvoices().find(i => i.id === id);
      if (inv) {
        setSelectedCustomer(inv.customer_id);
        setCart(inv.items);
        setIsReturnMode(inv.type === 'RETURN');
        setAdditionalDiscount(inv.additional_discount || 0);
        setCommissionValue(inv.commission_value || 0);
        setCashPayment(db.getInvoicePaidAmount(inv.id));
      }
    } else {
        setTimeout(() => customerRef.current?.focus(), 100);
    }
  }, [id, location]);

  const totals = useMemo(() => {
    let totalGross = 0;
    let totalItemDiscount = 0;
    cart.forEach(item => {
      const price = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || item.product.selling_price || 0);
      const gross = item.quantity * price;
      totalGross += gross;
      totalItemDiscount += gross * (item.discount_percentage / 100);
    });
    const subtotal = totalGross - totalItemDiscount;
    const discountFromPercent = (subtotal * additionalDiscountPercent / 100);
    const totalAddVal = discountFromPercent + additionalDiscount;
    return { gross: totalGross, itemDiscount: totalItemDiscount, subtotal, totalAdditionalDiscount: totalAddVal, net: Math.max(0, subtotal - totalAddVal) };
  }, [cart, additionalDiscount, additionalDiscountPercent]);

  // ذكاء المنتج: حساب أحدث سعر شراء
  const lastPurchaseCost = useMemo(() => {
    if (!selectedProduct) return null;
    const allPurchases = db.getPurchaseInvoices();
    const productHistory = allPurchases
        .filter(inv => inv.type === 'PURCHASE')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    for (const inv of productHistory) {
        const item = inv.items.find(i => i.product_id === selectedProduct);
        if (item) return item.cost_price;
    }
    return null;
  }, [selectedProduct]);

  // تحديث سعر البيع الافتراضي عند اختيار صنف
  useEffect(() => {
    if (selectedProduct) {
        const p = products.find(prod => prod.id === selectedProduct);
        if (p) {
            setManualPrice(p.selling_price || 0);
            setQty(1);
            // توجيه المستخدم للكمية فور الاختيار
            setTimeout(() => qtyRef.current?.focus(), 100);
        }
    }
  }, [selectedProduct, products]);

  const handleCheckout = async (print: boolean = false) => {
    if (!selectedCustomer || cart.length === 0) return toast.error(t('inv.select_customer'));
    
    setIsSubmitting(true);
    const user = authService.getCurrentUser();
    try {
      const result = id 
        ? await updateInvoice(id, selectedCustomer, cart, cashPayment)
        : await createInvoice(selectedCustomer, cart, cashPayment, isReturnMode, totals.totalAdditionalDiscount, user ? { id: user.id, name: user.name } : undefined, commissionValue);
      
      if (!result.success) {
          toast.error(result.message || "حدث خطأ أثناء حفظ الفاتورة");
          setIsSubmitting(false);
          return;
      }

      toast.success("تم الحفظ بنجاح");
      navigate('/invoices', { state: { autoPrintId: result.id } });
      
    } catch (e: any) {
      toast.error(e.message || "فشل النظام في معالجة الطلب");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentProduct = useMemo(() => products.find(p => p.id === selectedProduct), [selectedProduct, products]);
  const availableBatch = useMemo(() => {
    if (!currentProduct || !selectedWarehouse) return null;
    return currentProduct.batches.find(b => b.warehouse_id === selectedWarehouse) || null;
  }, [currentProduct, selectedWarehouse]);

  const addItemToCart = () => {
    if (!currentProduct) return;
    const finalPrice = invoiceConfig.enableManualPrice ? Number(manualPrice) : (availableBatch?.selling_price || currentProduct.selling_price || 0);
    const newItem: CartItem = {
      product: currentProduct,
      batch: availableBatch || undefined,
      quantity: Number(qty),
      bonus_quantity: Number(bonus),
      discount_percentage: invoiceConfig.enableDiscount ? Number(discount) : 0,
      unit_price: finalPrice
    };
    setCart([...cart, newItem]);
    setSelectedProduct(''); setQty(1); setBonus(0); setDiscount(0); setManualPrice(0);
    productRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1600px] mx-auto pb-6">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate('/invoices')} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
             </button>
             <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                 {id ? `تعديل فاتورة #${db.getInvoices().find(i => i.id === id)?.invoice_number}` : t('nav.new_invoice')}
                 {isReturnMode && <span className="mr-2 bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-black">وضع المرتجع</span>}
             </h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-blue-600"><SettingsIcon className="w-5 h-5" /></button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 flex flex-col space-y-6 w-full">
          <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100">
             <SearchableSelect ref={customerRef} label={t('inv.customer')} options={customers.map(c => ({ value: c.id, label: c.name, subLabel: c.phone }))} value={selectedCustomer} onChange={setSelectedCustomer} />
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-card border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-slate-700 flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" /> إضافة أصناف</h3>
                 <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400">المخزن:</label>
                    <select disabled={!selectedCustomer} className="bg-slate-50 border border-slate-200 text-sm rounded-xl p-2 font-bold focus:ring-2 focus:ring-blue-500" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                 </div>
            </div>
            
            <div className="space-y-6">
              {/* اختيار الصنف في سطر كامل */}
              <div className="w-full">
                <SearchableSelect ref={productRef} placeholder="ابحث عن الصنف بالاسم أو الكود..." options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.code }))} value={selectedProduct} onChange={setSelectedProduct} disabled={!selectedCustomer} />
              </div>

              {/* شريط معلومات الصنف اللحظي */}
              {selectedProduct && (
                  <div className="grid grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl flex flex-col items-center">
                          <span className="text-[9px] font-black text-orange-400 uppercase tracking-tighter">آخر تكلفة شراء</span>
                          <span className="text-sm font-black text-orange-700">{lastPurchaseCost !== null ? `${currency}${lastPurchaseCost.toLocaleString()}` : 'لا يوجد'}</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex flex-col items-center">
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">الرصيد المتاح</span>
                          <span className="text-sm font-black text-emerald-700">{availableBatch?.quantity || 0} قطعة</span>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl flex flex-col items-center">
                          <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">سعر البيع المسجل</span>
                          <span className="text-sm font-black text-blue-700">{currency}{currentProduct?.selling_price?.toLocaleString()}</span>
                      </div>
                  </div>
              )}

              {/* سطر الإدخال الثاني */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 md:col-span-4">
                  <label className="block text-[10px] font-black text-slate-400 mb-1">سعر البيع ({currency})</label>
                  <input ref={priceRef} type="number" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-black text-blue-600 focus:border-blue-500 outline-none" value={manualPrice} onChange={e => setManualPrice(Number(e.target.value))} disabled={!selectedProduct} />
                </div>
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-[10px] font-black text-slate-400 mb-1">الكمية</label>
                  <input ref={qtyRef} type="number" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-black text-center focus:border-blue-500 outline-none" value={qty} onChange={e => setQty(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && addItemToCart()} disabled={!selectedProduct} />
                </div>
                <div className="col-span-3 md:col-span-5 flex items-end">
                  <button onClick={addItemToCart} disabled={!selectedProduct} className="w-full bg-blue-600 text-white h-[46px] rounded-xl font-black shadow-lg hover:bg-blue-700 active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" /> إضافة
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden flex-1">
            <table className="w-full text-sm text-right">
              <thead className="text-[10px] text-slate-400 font-black uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4">الصنف</th>
                  <th className="px-6 py-4 text-center">الكمية</th>
                  <th className="px-6 py-4 text-center">السعر</th>
                  <th className="px-6 py-4 text-left">الإجمالي</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {cart.map((item, idx) => {
                  const price = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || 0);
                  const total = (item.quantity * price) * (1 - item.discount_percentage / 100);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-slate-800">{item.product.name}</td>
                      <td className="px-6 py-4 text-center">{item.quantity}</td>
                      <td className="px-6 py-4 text-center text-blue-600">{currency}{price.toLocaleString()}</td>
                      <td className="px-6 py-4 text-left font-black">{currency}{total.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center"><button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-full xl:w-96 shrink-0 bg-white p-8 rounded-3xl shadow-card border border-slate-100 sticky top-6 space-y-6">
            <h3 className="font-black text-slate-800 text-lg border-b pb-4">تفاصيل السداد</h3>
            <div className="space-y-4">
                <div className="flex justify-between text-slate-500 font-bold"><span>الإجمالي</span><span>{currency}{totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-red-500 font-bold"><span>الخصم الإضافي</span><span>-{currency}{totals.totalAdditionalDiscount.toFixed(2)}</span></div>
                
                {!isReturnMode && (
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                        <label className="text-xs font-black text-slate-400 uppercase whitespace-nowrap">العمولة:</label>
                        <input type="number" className="w-full border-2 border-slate-100 p-2 rounded-xl text-center font-black text-amber-600 focus:border-amber-400 outline-none" value={commissionValue || ''} onChange={e => setCommissionValue(Number(e.target.value))} />
                    </div>
                )}

                <div className="flex justify-between text-3xl font-black pt-4 border-t-2 border-slate-50"><span className="text-slate-800">الصافي</span><span className="text-blue-600">{currency}{totals.net.toLocaleString()}</span></div>
                
                <div className="pt-6">
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">المسدد نقداً (كاش)</label>
                    <input type="number" className="w-full border-2 border-emerald-100 p-4 rounded-2xl text-2xl font-black text-emerald-600 bg-emerald-50/20 focus:ring-4 focus:ring-emerald-500/10 outline-none" value={cashPayment || ''} onChange={e => setCashPayment(Number(e.target.value))} />
                </div>
                
                <div className="grid grid-cols-1 gap-3 pt-6">
                    <button onClick={() => handleCheckout(true)} disabled={isSubmitting || cart.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-xl active:scale-95 disabled:opacity-30"><Printer className="w-5 h-5" /> حفظ وطباعة</button>
                    <button onClick={() => handleCheckout(false)} disabled={isSubmitting || cart.length === 0} className="w-full bg-white border-2 border-slate-100 text-slate-400 py-4 rounded-2xl font-black hover:text-slate-800 hover:border-slate-800 transition-all active:scale-95 disabled:opacity-30">حفظ فقط</button>
                </div>
            </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white p-8 rounded-3xl border shadow-2xl w-full max-w-sm relative">
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                <h3 className="font-black text-lg mb-6 flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-blue-600" /> إعدادات الفاتورة</h3>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                        <input type="checkbox" className="w-5 h-5 rounded text-blue-600" checked={invoiceConfig.enableManualPrice} onChange={e => setInvoiceConfig({...invoiceConfig, enableManualPrice: e.target.checked})} />
                        <span className="text-sm font-bold text-slate-700">تعديل الأسعار يدوياً</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                        <input type="checkbox" className="w-5 h-5 rounded text-blue-600" checked={invoiceConfig.enableDiscount} onChange={e => setInvoiceConfig({...invoiceConfig, enableDiscount: e.target.checked})} />
                        <span className="text-sm font-bold text-slate-700">تفعيل الخصم على الصنف</span>
                    </label>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-full mt-8 bg-slate-900 text-white py-3 rounded-xl font-black">حفظ وإغلاق</button>
             </div>
        </div>
      )}
    </div>
  );
}
