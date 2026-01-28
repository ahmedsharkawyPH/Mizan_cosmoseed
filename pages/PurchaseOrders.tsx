
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseOrder, PurchaseItem } from '../types';
import { Plus, Save, ArrowLeft, Trash2, ShoppingBag, FileText, Search, Clock, TrendingUp, Truck, Check, X, ClipboardCheck, PackagePlus, Info, Tag, Award, BarChart4, ChevronRight, Eye, RefreshCcw, Calendar, Hash, Edit3, Wallet, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';
// @ts-ignore
import toast from 'react-hot-toast';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const currency = db.getSettings().currency;
  
  const [activeTab, setActiveTab] = useState<'NEW' | 'LOG'>('NEW');
  const [suppliers] = useState(db.getSuppliers());
  const [products, setProducts] = useState(db.getProductsWithBatches());
  const [warehouses] = useState(db.getWarehouses());
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  
  const [selProd, setSelProd] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0); 
  const [margin, setMargin] = useState(0); 
  const [sellingPrice, setSellingPrice] = useState(0); 
  const [prodStats, setProdStats] = useState<{
      lastPrices: {price: number, supplier: string}[], 
      monthlyAvg: number, 
      currentStock: number,
      bestPrice: {price: number, supplier: string} | null
  } | null>(null);

  // Conversion States
  const [isConvModalOpen, setIsConvModalOpen] = useState(false);
  const [convOrder, setConvOrder] = useState<PurchaseOrder | null>(null);
  const [convItems, setConvItems] = useState<any[]>([]);
  const [convDocNo, setConvDocNo] = useState('');
  const [convDate, setConvDate] = useState(new Date().toISOString().split('T')[0]);
  const [convWarehouse, setConvWarehouse] = useState('');
  const [convCashPaid, setConvCashPaid] = useState(0);
  const [isSubmittingConv, setIsSubmittingConv] = useState(false);

  useEffect(() => {
    setOrders(db.getPurchaseOrders());
    const def = warehouses.find(w => w.is_default);
    const initialWh = def ? def.id : warehouses[0]?.id || '';
    setConvWarehouse(initialWh);
  }, [warehouses, activeTab]);

  const getPriceIntelligence = (prodId: string) => {
      const history = db.getPurchaseInvoices() || [];
      const allPrices: {price: number, supplier: string, date: string}[] = [];
      history.forEach((inv) => {
          if (inv.type === 'PURCHASE') {
              const item = inv.items.find((i) => i.product_id === prodId);
              if(item) {
                  const supplier = suppliers.find(s => s.id === inv.supplier_id)?.name || 'غير معروف';
                  allPrices.push({ price: item.cost_price, supplier, date: inv.date });
              }
          }
      });
      const sortedByDate = [...allPrices].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      let bestPrice = null;
      if (allPrices.length > 0) bestPrice = allPrices.reduce((min, p) => p.price < min.price ? p : min, allPrices[0]);
      return { lastPrices: sortedByDate.slice(0, 3), bestPrice };
  };

  const getMonthlyAvg = (prodId: string): number => {
      const invoices = db.getInvoices();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const strThirtyDaysAgo = thirtyDaysAgo.toISOString().split('T')[0];
      let totalQty = 0;
      invoices.forEach(inv => {
          if (inv.type === 'SALE' && inv.date.split('T')[0] >= strThirtyDaysAgo) {
              const item = inv.items.find(i => i.product.id === prodId);
              if(item) totalQty += item.quantity;
          }
      });
      return totalQty;
  };

  useEffect(() => {
      if (cost > 0 && margin > 0) {
          const calculated = cost * (1 + margin / 100);
          setSellingPrice(parseFloat(calculated.toFixed(2)));
      }
  }, [cost, margin]);

  useEffect(() => {
      if (selProd) {
          const p = products.find(x => x.id === selProd);
          if (p) {
              const currentStock = p.batches.reduce((sum, b) => sum + b.quantity, 0);
              const intelligence = getPriceIntelligence(selProd);
              const monthlyAvg = getMonthlyAvg(selProd);
              setProdStats({ lastPrices: intelligence.lastPrices, monthlyAvg, currentStock, bestPrice: intelligence.bestPrice });
              const latestPrice = intelligence.lastPrices[0]?.price;
              if (latestPrice !== undefined) setCost(latestPrice);
              else if (p.batches.length > 0) setCost(p.batches[p.batches.length - 1].purchase_price);
              else setCost(0);
              if (p.batches.length > 0) setSellingPrice(p.batches[p.batches.length - 1].selling_price);
              else setSellingPrice(p.selling_price || 0);
              setMargin(0);
          }
      } else {
          setProdStats(null); setCost(0); setSellingPrice(0); setMargin(0);
      }
  }, [selProd, products]);

  const handleAddItem = () => {
      if (!selProd || qty <= 0) return;
      const p = products.find(x => x.id === selProd);
      if (!p) return;
      setCart([...cart, { product: p, quantity: qty, cost_price: cost, selling_price: sellingPrice, last_cost: prodStats?.lastPrices[0]?.price || 0, current_stock: prodStats?.currentStock || 0, monthly_avg: prodStats?.monthlyAvg || 0 }]);
      setSelProd(''); setQty(1); setCost(0); setSellingPrice(0); setMargin(0); setProdStats(null);
      toast.success("تمت إضافة الصنف للطلب");
  };

  const handleRemoveItem = (idx: number) => setCart(cart.filter((_, i) => i !== idx));

  const handleSaveOrder = async () => {
      if (!selectedSupplier || cart.length === 0) return;
      const itemsPayload = cart.map(item => ({ product_id: item.product.id, quantity: item.quantity, cost_price: item.cost_price, selling_price: item.selling_price, last_cost: item.last_cost, current_stock: item.current_stock, monthly_avg: item.monthly_avg }));
      const res = await db.createPurchaseOrder(selectedSupplier, itemsPayload);
      if (res.success) { 
          toast.success("تم حفظ طلب الشراء بنجاح");
          setOrders(db.getPurchaseOrders()); 
          setCart([]); 
          setSelectedSupplier(''); 
          setActiveTab('LOG'); 
      }
  };

  // --- Conversion Logic ---
  const handleOpenConversion = (order: PurchaseOrder) => {
    setConvOrder(order);
    const mappedItems = order.items.map(item => ({
        ...item,
        productName: products.find(p => p.id === item.product_id)?.name || 'صنف غير معروف'
    }));
    setConvItems(mappedItems);
    setConvDocNo('');
    setConvDate(new Date().toISOString().split('T')[0]);
    setConvCashPaid(0);
    setIsConvModalOpen(true);
  };

  const updateConvItem = (idx: number, field: string, val: number) => {
    const updated = [...convItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setConvItems(updated);
  };

  const removeConvItem = (idx: number) => {
    if (convItems.length <= 1) return toast.error("لا يمكن إفراغ الفاتورة تماماً، يرجى إلغاء العملية بدلاً من ذلك.");
    setConvItems(convItems.filter((_, i) => i !== idx));
  };

  const executeConversion = async () => {
    if (!convOrder) return;
    if (!convDocNo) return toast.error("يرجى إدخال رقم المستند (فاتورة المورد)");
    
    setIsSubmittingConv(true);
    const pItems: PurchaseItem[] = convItems.map(item => ({
        product_id: item.product_id,
        warehouse_id: convWarehouse,
        batch_number: `BATCH-${Date.now().toString().slice(-4)}`,
        quantity: item.quantity,
        cost_price: item.cost_price,
        selling_price: item.selling_price || 0,
        expiry_date: '2099-12-31'
    }));

    const res = await db.createPurchaseInvoice(convOrder.supplier_id, pItems, convCashPaid, false, convDocNo, convDate);
    
    if (res.success) {
        await db.updatePurchaseOrderStatus(convOrder.id, 'COMPLETED');
        toast.success("تم تحويل الطلب لفاتورة شراء فعلية بنجاح");
        setOrders(db.getPurchaseOrders());
        setIsConvModalOpen(false);
    } else {
        if (res.message === 'CONFLICT_DETECTED') {
            toast.error("حدث تعارض في رقم الفاتورة المولد تلقائياً (409 Conflict). جاري تحديث البيانات، يرجى المحاولة مرة أخرى.");
            // Force re-sync to get latest invoice numbers
            await db.syncFromCloud();
            setOrders(db.getPurchaseOrders());
        } else {
            toast.error(res.message);
        }
    }
    setIsSubmittingConv(false);
  };

  const convTotal = useMemo(() => convItems.reduce((a, b) => a + (b.quantity * b.cost_price), 0), [convItems]);

  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone })), [suppliers]);
  const productOptions = useMemo(() => products.map(p => ({ value: p.id, label: p.name, subLabel: p.code })), [products]);

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/inventory')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <ShoppingBag className="w-8 h-8 text-purple-600" />
                    طلبات الشراء (المسودة)
                </h1>
            </div>
            <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <button 
                    onClick={() => setActiveTab('NEW')} 
                    className={`px-6 py-2.5 rounded-lg text-sm font-black transition-all ${activeTab === 'NEW' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Plus className="w-4 h-4 inline ltr:mr-2 rtl:ml-2" />
                    طلب جديد
                </button>
                <button 
                    onClick={() => setActiveTab('LOG')} 
                    className={`px-6 py-2.5 rounded-lg text-sm font-black transition-all ${activeTab === 'LOG' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Clock className="w-4 h-4 inline ltr:mr-2 rtl:ml-2" />
                    سجل الطلبات
                </button>
            </div>
        </div>

        {activeTab === 'NEW' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100">
                        <h3 className="font-black text-slate-700 mb-4 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-blue-500" /> اختيار المورد
                        </h3>
                        <SearchableSelect options={supplierOptions} value={selectedSupplier} onChange={setSelectedSupplier} placeholder="ابحث عن المورد..." />
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-700 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-purple-500" /> إضافة أصناف للطلب
                            </h3>
                        </div>
                        <div className="flex flex-wrap md:flex-nowrap gap-4 items-end mb-6">
                            <div className="flex-1 min-w-[200px]">
                                <SearchableSelect options={productOptions} value={selProd} onChange={setSelProd} placeholder="ابحث عن الصنف..." label="الصنف" />
                            </div>
                            <div className="w-24">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">سعر الشراء</label>
                                <input type="number" className="w-full border p-2.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={cost || ''} onChange={e => setCost(Number(e.target.value))} />
                            </div>
                            <div className="w-24">
                                <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">ربح %</label>
                                <input type="number" className="w-full border border-blue-200 p-2.5 rounded-xl font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" value={margin || ''} onChange={e => setMargin(Number(e.target.value))} />
                            </div>
                            <div className="w-24">
                                <label className="block text-[10px] font-black text-emerald-400 uppercase mb-1">سعر البيع</label>
                                <input type="number" className="w-full border-2 border-emerald-100 p-2.5 rounded-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500" value={sellingPrice || ''} onChange={e => setSellingPrice(Number(e.target.value))} />
                            </div>
                            <div className="w-20">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">الكمية</label>
                                <input type="number" className="w-full border p-2.5 rounded-xl font-black text-center" value={qty || ''} onChange={e => setQty(Number(e.target.value))} min="1" />
                            </div>
                            <button onClick={handleAddItem} disabled={!selProd || qty <= 0} className="bg-purple-600 text-white px-5 py-3 rounded-xl font-black hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg active:scale-95">
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>
                        {prodStats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-700 animate-in zoom-in duration-300">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-yellow-500" /> أفضل سعر شراء سابق</h4>
                                    {prodStats.bestPrice ? ( <div className="flex justify-between items-center"><div><div className="text-3xl font-black text-white">{currency}{prodStats.bestPrice.price.toLocaleString()}</div><div className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center gap-1"><Truck className="w-3 h-3" /> {prodStats.bestPrice.supplier}</div></div><div className="p-3 bg-white/10 rounded-xl"><Tag className="w-6 h-6 text-emerald-400" /></div></div> ) : ( <div className="text-slate-500 text-xs italic">لا توجد مشتريات سابقة لهذا الصنف</div> )}
                                </div>
                                <div className="bg-white p-4 rounded-2xl border-2 border-slate-50">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> آخر 3 أسعار شراء</h4>
                                    <div className="space-y-2">{prodStats.lastPrices.length > 0 ? prodStats.lastPrices.map((p, i) => ( <div key={i} className="flex justify-between items-center text-xs border-b border-dashed border-slate-100 pb-1 last:border-0"><span className="font-black text-slate-700">{currency}{p.price.toLocaleString()}</span><span className="text-[10px] text-slate-400 font-bold">{p.supplier}</span></div> )) : <div className="text-slate-300 text-xs italic">لم يسبق شراؤه</div>}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100 h-full flex flex-col sticky top-6">
                        <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" /> ملخص طلب الشراء
                        </h3>
                        <div className="flex-1 overflow-y-auto min-h-[300px] space-y-3">
                            {cart.length === 0 ? ( 
                                <div className="text-center text-slate-300 py-20">
                                    <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                    <p className="font-black text-sm">الطلب فارغ حالياً</p>
                                </div> 
                            ) : ( 
                                cart.map((item, idx) => ( 
                                    <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center group animate-in slide-in-from-right-2">
                                        <div>
                                            <div className="font-black text-slate-800 text-sm">{item.product.name}</div>
                                            <div className="text-[10px] text-blue-600 font-black mb-1 mt-1">تكلفة: {currency}{item.cost_price}</div>
                                            <div className="text-[10px] text-slate-400 flex gap-3 font-bold">
                                                <span>الكمية: <b className="text-slate-700">{item.quantity}</b></span>
                                                <span className="text-emerald-600">البيع: {currency}{item.selling_price}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div> 
                                )) 
                            )}
                        </div>
                        <div className="pt-6 border-t mt-6 space-y-4">
                            <div className="flex justify-between items-center text-sm font-black text-slate-500">
                                <span>إجمالي قيمة الطلب:</span>
                                <span className="text-2xl font-black text-slate-900">{currency}{cart.reduce((a,b) => a + (b.quantity * b.cost_price), 0).toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={handleSaveOrder} 
                                disabled={cart.length === 0 || !selectedSupplier} 
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-purple-600 disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                <Save className="w-5 h-5" />
                                حفظ طلب الشراء في السجل
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'LOG' && (
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden animate-in fade-in duration-500">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-black text-slate-700 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-500" /> سجل طلبات الشراء المحفوظة
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                            <tr>
                                <th className="p-6">رقم الطلب</th>
                                <th className="p-6">التاريخ</th>
                                <th className="p-6">المورد</th>
                                <th className="p-6 text-center">الأصناف</th>
                                <th className="p-6 text-center">الحالة</th>
                                <th className="p-6 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-bold">
                            {orders.length > 0 ? (
                                orders.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-6 text-slate-500 font-mono text-xs">{order.order_number}</td>
                                        <td className="p-6 text-slate-600">{new Date(order.date).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-6 text-slate-800">{suppliers.find(s => s.id === order.supplier_id)?.name || 'غير معروف'}</td>
                                        <td className="p-6 text-center">
                                            <span className="bg-slate-100 px-2 py-1 rounded-lg text-[10px]">{order.items.length} أصناف</span>
                                        </td>
                                        <td className="p-6 text-center">
                                            {order.status === 'PENDING' ? (
                                                <span className="px-3 py-1 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-100">قيد الانتظار</span>
                                            ) : order.status === 'COMPLETED' ? (
                                                <span className="px-3 py-1 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100">مكتمل</span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-[10px] bg-red-50 text-red-700 border border-red-100">ملغى</span>
                                            )}
                                        </td>
                                        <td className="p-6 text-center">
                                            <div className="flex justify-center gap-3">
                                                <button 
                                                    onClick={() => handleOpenConversion(order)}
                                                    disabled={order.status !== 'PENDING'}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all disabled:opacity-30 shadow-md shadow-blue-100"
                                                >
                                                    <RefreshCcw className="w-3.5 h-3.5" />
                                                    تحويل لفاتورة
                                                </button>
                                                {order.status === 'PENDING' && (
                                                    <button 
                                                        onClick={() => db.updatePurchaseOrderStatus(order.id, 'CANCELLED').then(() => setOrders(db.getPurchaseOrders()))}
                                                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center text-slate-300 font-black">
                                        <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                        لا توجد طلبات شراء مسجلة حالياً
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- Conversion & Preview Modal --- */}
        {isConvModalOpen && convOrder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                    {/* Modal Header */}
                    <div className="px-8 py-6 bg-slate-50 border-b flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <RefreshCcw className="w-6 h-6 text-blue-600" />
                                مراجعة وتحويل طلب الشراء للفاتورة
                            </h3>
                            <p className="text-xs text-slate-500 font-bold mt-1">
                                المورد: <span className="text-blue-600">{suppliers.find(s => s.id === convOrder.supplier_id)?.name}</span> | المرجع: {convOrder.order_number}
                            </p>
                        </div>
                        <button onClick={() => setIsConvModalOpen(false)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-white grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Side: Items Table */}
                        <div className="lg:col-span-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-slate-700 flex items-center gap-2">
                                    <PackagePlus className="w-5 h-5 text-purple-500" /> محتويات الفاتورة المقترحة
                                </h4>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-black text-slate-400">توجيه للمخزن:</label>
                                    <select 
                                        className="text-xs font-bold border rounded-lg p-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                                        value={convWarehouse}
                                        onChange={e => setConvWarehouse(e.target.value)}
                                    >
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                                        <tr>
                                            <th className="p-4">الصنف</th>
                                            <th className="p-4 text-center">الكمية</th>
                                            <th className="p-4 text-center">سعر الشراء</th>
                                            <th className="p-4 text-center">سعر البيع</th>
                                            <th className="p-4 text-left">الإجمالي</th>
                                            <th className="p-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                                        {convItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="text-sm">{item.productName}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <input 
                                                        type="number" 
                                                        className="w-20 border border-slate-200 rounded-lg p-1.5 text-center font-black focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={item.quantity}
                                                        onChange={e => updateConvItem(idx, 'quantity', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="p-4 text-center">
                                                    <input 
                                                        type="number" 
                                                        className="w-24 border border-slate-200 rounded-lg p-1.5 text-center font-black text-red-600 focus:ring-2 focus:ring-red-500 outline-none"
                                                        value={item.cost_price}
                                                        onChange={e => updateConvItem(idx, 'cost_price', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="p-4 text-center">
                                                    <input 
                                                        type="number" 
                                                        className="w-24 border border-slate-200 rounded-lg p-1.5 text-center font-black text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                        value={item.selling_price}
                                                        onChange={e => updateConvItem(idx, 'selling_price', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="p-4 text-left font-black text-slate-900">
                                                    {currency}{(item.quantity * item.cost_price).toLocaleString()}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button onClick={() => removeConvItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right Side: Documentation & Financials */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4 shadow-inner">
                                <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                                    <Edit3 className="w-4 h-4 text-blue-600" /> بيانات الفاتورة النهائية
                                </h4>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> رقم المستند (فاتورة المورد)
                                    </label>
                                    <input 
                                        type="text" 
                                        className="w-full border-2 border-orange-100 p-3 rounded-2xl font-black text-orange-700 bg-white focus:ring-4 focus:ring-orange-50 outline-none transition-all"
                                        placeholder="الرقم الورقي للفاتورة..."
                                        value={convDocNo}
                                        onChange={e => setConvDocNo(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> تاريخ الفاتورة
                                    </label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-slate-200 p-3 rounded-2xl font-black bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        value={convDate}
                                        onChange={e => setConvDate(e.target.value)}
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-black text-slate-500">إجمالي الفاتورة:</span>
                                        <span className="text-2xl font-black text-slate-900">{currency}{convTotal.toLocaleString()}</span>
                                    </div>
                                    
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                                        <Wallet className="w-3 h-3 text-emerald-500" /> المبلغ المسدد (كاش)
                                    </label>
                                    <input 
                                        type="number" 
                                        className="w-full border-2 border-emerald-100 p-4 rounded-2xl font-black text-2xl text-emerald-700 bg-white focus:ring-4 focus:ring-emerald-50 outline-none transition-all"
                                        placeholder="0.00"
                                        value={convCashPaid || ''}
                                        onChange={e => setConvCashPaid(Number(e.target.value))}
                                    />
                                    <div className="mt-2 text-center text-[10px] font-black text-slate-400">
                                        المتبقي ذمة للمورد: <span className="text-red-500">{currency}{(convTotal - convCashPaid).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={executeConversion}
                                disabled={isSubmittingConv || convItems.length === 0}
                                className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-lg shadow-xl shadow-slate-200 hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:shadow-none"
                            >
                                {isSubmittingConv ? <span className="loader"></span> : <Save className="w-6 h-6 text-white" />}
                                اعتماد تحويل الفاتورة
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
