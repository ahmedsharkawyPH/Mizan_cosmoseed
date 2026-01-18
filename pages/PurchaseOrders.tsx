
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseOrder, PurchaseItem } from '../types';
import { Plus, Save, ArrowLeft, Trash2, ShoppingBag, FileText, Search, Clock, TrendingUp, Truck, Check, X, ClipboardCheck, PackagePlus, Info, Tag, Award, BarChart4 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const currency = db.getSettings().currency;
  
  const [activeTab, setActiveTab] = useState<'NEW' | 'LOG'>('NEW');
  const [suppliers] = useState(db.getSuppliers());
  const [products, setProducts] = useState(db.getProductsWithBatches());
  const [warehouses] = useState(db.getWarehouses());
  const [orders, setOrders] = useState<PurchaseOrder[]>(db.getPurchaseOrders());

  // --- NEW ORDER STATE ---
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  
  // Item Entry State
  const [selProd, setSelProd] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0); 
  const [sellingPrice, setSellingPrice] = useState(0); 
  const [prodStats, setProdStats] = useState<{
      lastPrices: {price: number, supplier: string}[], 
      monthlyAvg: number, 
      currentStock: number,
      bestPrice: {price: number, supplier: string} | null
  } | null>(null);

  // --- QUICK ADD PRODUCT STATE ---
  const [isAddProdModalOpen, setIsAddProdModalOpen] = useState(false);
  const [newProdForm, setNewProdForm] = useState({ code: '', name: '' });

  // --- REVIEW MODAL STATE ---
  const [reviewOrder, setReviewOrder] = useState<PurchaseOrder | null>(null);
  const [reviewItems, setReviewItems] = useState<PurchaseItem[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('');

  useEffect(() => {
      const def = warehouses.find(w => w.is_default);
      setDefaultWarehouseId(def ? def.id : warehouses[0]?.id);
  }, [warehouses]);

  // --- HELPERS ---
  const getPriceIntelligence = (prodId: string) => {
      const history = db.getPurchaseInvoices() || [];
      const allPrices: {price: number, supplier: string, date: string}[] = [];
      
      history.forEach((inv) => {
          if (inv.type === 'PURCHASE') {
              const item = inv.items.find((i) => i.product_id === prodId);
              if(item) {
                  const supplier = suppliers.find(s => s.id === inv.supplier_id)?.name || 'Unknown';
                  allPrices.push({ price: item.cost_price, supplier, date: inv.date });
              }
          }
      });

      // Sort by date to get last prices
      const sortedByDate = [...allPrices].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Find best price (lowest)
      let bestPrice = null;
      if (allPrices.length > 0) {
          bestPrice = allPrices.reduce((min, p) => p.price < min.price ? p : min, allPrices[0]);
      }

      return {
          lastPrices: sortedByDate.slice(0, 3), // Get up to last 3 entries
          bestPrice
      };
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

  // --- EFFECTS ---
  useEffect(() => {
      if (selProd) {
          const p = products.find(x => x.id === selProd);
          if (p) {
              const currentStock = p.batches.reduce((sum, b) => sum + b.quantity, 0);
              const intelligence = getPriceIntelligence(selProd);
              const monthlyAvg = getMonthlyAvg(selProd);
              
              setProdStats({ 
                  lastPrices: intelligence.lastPrices, 
                  monthlyAvg, 
                  currentStock,
                  bestPrice: intelligence.bestPrice 
              });
              
              // Auto-set cost to last purchase price or stock cost
              const latestPrice = intelligence.lastPrices[0]?.price;
              if (latestPrice !== undefined) {
                  setCost(latestPrice);
              } else if (p.batches.length > 0) {
                  setCost(p.batches[p.batches.length - 1].purchase_price);
              } else {
                  setCost(0);
              }
              
              if (p.batches.length > 0) {
                  setSellingPrice(p.batches[p.batches.length - 1].selling_price);
              } else {
                  setSellingPrice(p.selling_price || 0);
              }
          }
      } else {
          setProdStats(null);
          setCost(0);
          setSellingPrice(0);
      }
  }, [selProd, products]);

  const handleAddItem = () => {
      if (!selProd || qty <= 0) return;
      const p = products.find(x => x.id === selProd);
      if (!p) return;

      setCart([...cart, {
          product: p,
          quantity: qty,
          cost_price: cost,
          selling_price: sellingPrice,
          last_cost: prodStats?.lastPrices[0]?.price || 0,
          current_stock: prodStats?.currentStock || 0,
          monthly_avg: prodStats?.monthlyAvg || 0
      }]);

      setSelProd('');
      setQty(1);
      setCost(0);
      setSellingPrice(0);
      setProdStats(null);
  };

  const handleRemoveItem = (idx: number) => {
      setCart(cart.filter((_, i) => i !== idx));
  };

  const handleSaveOrder = async () => {
      if (!selectedSupplier || cart.length === 0) return;
      
      const itemsPayload = cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          cost_price: item.cost_price,
          selling_price: item.selling_price,
          last_cost: item.last_cost,
          current_stock: item.current_stock,
          monthly_avg: item.monthly_avg
      }));

      const res = await db.createPurchaseOrder(selectedSupplier, itemsPayload);
      if (res.success) {
          setOrders(db.getPurchaseOrders());
          setCart([]);
          setSelectedSupplier('');
          setActiveTab('LOG');
      }
  };

  const handleQuickProductSave = async () => {
      if (!newProdForm.name || !newProdForm.code) return alert("Please fill all fields");
      const pid = await db.addProduct({ code: newProdForm.code, name: newProdForm.name });
      if (pid) {
          setProducts(db.getProductsWithBatches());
          setIsAddProdModalOpen(false);
          setNewProdForm({ code: '', name: '' });
          setSelProd(pid); 
      }
  };

  const handleOpenReview = (order: PurchaseOrder) => {
      setReviewOrder(order);
      const mappedItems: PurchaseItem[] = order.items.map(item => {
          const p = products.find(prod => prod.id === item.product_id);
          let sellingPrice = item.selling_price || 0;
          if (!sellingPrice && p && p.batches.length > 0) {
              sellingPrice = p.batches[p.batches.length - 1].selling_price;
          }

          return {
              product_id: item.product_id,
              warehouse_id: defaultWarehouseId,
              batch_number: `BATCH-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*100)}`,
              quantity: item.quantity,
              cost_price: item.cost_price || item.last_cost || 0,
              selling_price: sellingPrice,
              expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
          };
      });
      setReviewItems(mappedItems);
  };

  const updateReviewItem = (idx: number, field: keyof PurchaseItem, value: any) => {
      const updated = [...reviewItems];
      updated[idx] = { ...updated[idx], [field]: value };
      setReviewItems(updated);
  };

  const removeReviewItem = (idx: number) => {
      setReviewItems(reviewItems.filter((_, i) => i !== idx));
  };

  const handleConvert = async () => {
      if (!reviewOrder) return;
      if (reviewItems.length === 0) return;
      
      const res = await db.createPurchaseInvoice(reviewOrder.supplier_id, reviewItems, 0, false);
      if (res.success) {
          db.updatePurchaseOrderStatus(reviewOrder.id, 'COMPLETED');
          setOrders(db.getPurchaseOrders());
          setReviewOrder(null);
      }
  };

  const supplierOptions = useMemo(() => suppliers.map(s => ({
    value: s.id,
    label: s.name,
    subLabel: s.phone
  })), [suppliers]);

  const productOptions = useMemo(() => products.map(p => ({
    value: p.id,
    label: p.name,
    subLabel: p.code
  })), [products]);

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/inventory')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6 text-purple-600" />
                    {t('stock.order')}
                </h1>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('NEW')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'NEW' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Plus className="w-4 h-4 inline ltr:mr-2 rtl:ml-2" />
                    {t('pur.new_order')}
                </button>
                <button 
                    onClick={() => setActiveTab('LOG')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'LOG' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Clock className="w-4 h-4 inline ltr:mr-2 rtl:ml-2" />
                    {t('stock.order_history')}
                </button>
            </div>
        </div>

        {activeTab === 'NEW' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-700 mb-4">{t('pur.select_supplier')}</h3>
                        <SearchableSelect 
                            options={supplierOptions}
                            value={selectedSupplier}
                            onChange={setSelectedSupplier}
                            placeholder={t('cust.search')}
                        />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-700">{t('pur.add_item')}</h3>
                            <button 
                                onClick={() => setIsAddProdModalOpen(true)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-bold flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-lg transition-colors"
                            >
                                <PackagePlus className="w-4 h-4" />
                                إضافة صنف جديد
                            </button>
                        </div>
                        <div className="flex flex-wrap md:flex-nowrap gap-4 items-end mb-6">
                            <div className="flex-1 min-w-[200px]">
                                <SearchableSelect 
                                    options={productOptions}
                                    value={selProd}
                                    onChange={setSelProd}
                                    placeholder={t('inv.select_product')}
                                    label={t('inv.product')}
                                />
                            </div>
                            <div className="w-32">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pur.cost')}</label>
                                <input 
                                    type="number" 
                                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold"
                                    value={cost}
                                    onChange={e => setCost(Number(e.target.value))}
                                />
                            </div>
                            <div className="w-32">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('stock.qty')}</label>
                                <input 
                                    type="number" 
                                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={qty}
                                    onChange={e => setQty(Number(e.target.value))}
                                    min="1"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                />
                            </div>
                            <button 
                                onClick={handleAddItem}
                                disabled={!selProd || qty <= 0}
                                className="bg-purple-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        {prodStats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-700 animate-in zoom-in duration-300">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                        <Award className="w-4 h-4 text-yellow-500" /> أقل سعر شراء مسجل
                                    </h4>
                                    {prodStats.bestPrice ? (
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="text-3xl font-black text-white">{currency}{prodStats.bestPrice.price.toLocaleString()}</div>
                                                <div className="text-xs text-emerald-400 font-bold mt-1 flex items-center gap-1">
                                                    <Truck className="w-3 h-3" /> {prodStats.bestPrice.supplier}
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white/10 rounded-xl">
                                                <Tag className="w-6 h-6 text-emerald-400" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm italic">لا توجد بيانات سابقة</div>
                                    )}
                                </div>

                                <div className="bg-white p-4 rounded-xl border-2 border-slate-100 animate-in slide-in-from-left-4 duration-300">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-500" /> آخر 3 أسعار شراء
                                    </h4>
                                    <div className="space-y-2">
                                        {prodStats.lastPrices.length > 0 ? prodStats.lastPrices.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm border-b border-dashed border-slate-100 pb-1 last:border-0">
                                                <span className="font-bold text-slate-700">{currency}{p.price.toLocaleString()}</span>
                                                <span className="text-[10px] text-slate-400">{p.supplier}</span>
                                            </div>
                                        )) : <div className="text-slate-300 text-xs italic">لا توجد مشتريات سابقة</div>}
                                    </div>
                                </div>

                                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        <p className="text-[10px] font-bold text-blue-400 uppercase">المخزون الحالي</p>
                                        <p className="text-lg font-black text-blue-700">{prodStats.currentStock}</p>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                                        <p className="text-[10px] font-bold text-orange-400 uppercase">معدل البيع (30يوم)</p>
                                        <p className="text-lg font-black text-orange-700">{prodStats.monthlyAvg}</p>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 col-span-2">
                                        <p className="text-[10px] font-bold text-purple-400 uppercase">سعر البيع المقترح</p>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                className="bg-transparent text-lg font-black text-purple-700 outline-none w-full"
                                                value={sellingPrice}
                                                onChange={e => setSellingPrice(Number(e.target.value))}
                                            />
                                            <TrendingUp className="w-4 h-4 text-purple-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 h-full flex flex-col sticky top-6">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" />
                            {t('pur.order_summary')}
                        </h3>
                        
                        <div className="flex-1 overflow-y-auto min-h-[300px] space-y-3">
                            {cart.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">
                                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                    {t('pur.add_to_order')}
                                </div>
                            ) : (
                                cart.map((item, idx) => (
                                    <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center group animate-in slide-in-from-right-2">
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">{item.product.name}</div>
                                            <div className="text-xs text-blue-600 font-bold mb-1">شراء: {currency}{item.cost_price}</div>
                                            <div className="text-[10px] text-gray-500 flex gap-2">
                                                <span>{t('stock.qty')}: <b>{item.quantity}</b></span>
                                                <span className="text-emerald-600">بيع: {currency}{item.selling_price}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-4 border-t mt-4 space-y-3">
                            <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                                <span>إجمالي الفاتورة:</span>
                                <span className="text-xl font-black text-slate-900">{currency}{cart.reduce((a,b) => a + (b.quantity * b.cost_price), 0).toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={handleSaveOrder}
                                disabled={cart.length === 0 || !selectedSupplier}
                                className="w-full bg-purple-600 text-white py-4 rounded-xl font-black shadow-lg shadow-purple-200 hover:bg-purple-700 disabled:bg-gray-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {t('pur.save_order_log')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'LOG' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right min-w-[700px]">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="p-4">Order #</th>
                                <th className="p-4">{t('common.date')}</th>
                                <th className="p-4">{t('inv.supplier')}</th>
                                <th className="p-4 text-center">{t('pur.items_count')}</th>
                                <th className="p-4 text-center">{t('list.status')}</th>
                                <th className="p-4 text-center">{t('common.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map(order => {
                                const supplierName = suppliers.find(s => s.id === order.supplier_id)?.name || 'Unknown';
                                return (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-mono font-bold text-purple-700">{order.order_number}</td>
                                        <td className="p-4 text-gray-500">{new Date(order.date).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-gray-800">{supplierName}</td>
                                        <td className="p-4 text-center font-bold">{order.items.length}</td>
                                        <td className="p-4 text-center">
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {order.status === 'PENDING' && (
                                                <button 
                                                    onClick={() => handleOpenReview(order)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto shadow-sm"
                                                >
                                                    <Truck className="w-3 h-3" />
                                                    {t('pur.receive')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {isAddProdModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><PackagePlus className="w-5 h-5 text-blue-600" /> إضافة صنف جديد</h3>
                        <button onClick={() => setIsAddProdModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('prod.name')} *</label>
                            <input 
                                className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                value={newProdForm.name}
                                onChange={e => setNewProdForm({...newProdForm, name: e.target.value})}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('prod.code')} *</label>
                            <input 
                                className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                value={newProdForm.code}
                                onChange={e => setNewProdForm({...newProdForm, code: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={handleQuickProductSave}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
                        >
                            حفظ الصنف
                        </button>
                    </div>
                </div>
            </div>
        )}

        {reviewOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <ClipboardCheck className="w-6 h-6 text-purple-600" />
                                {t('pur.review_order')}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Order #{reviewOrder.order_number} - {suppliers.find(s => s.id === reviewOrder.supplier_id)?.name}</p>
                        </div>
                        <button onClick={() => setReviewOrder(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[700px]">
                                    <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="px-4 py-3 text-left rtl:text-right">{t('inv.product')}</th>
                                            <th className="px-4 py-3 w-32">{t('stock.warehouse')}</th>
                                            <th className="px-4 py-3 w-32">{t('stock.batch')}</th>
                                            <th className="px-4 py-3 w-32">{t('stock.expiry')}</th>
                                            <th className="px-4 py-3 w-24 text-center">{t('stock.qty')}</th>
                                            <th className="px-4 py-3 w-28 text-center">{t('pur.cost')}</th>
                                            <th className="px-4 py-3 w-28 text-center">{t('pur.sell')}</th>
                                            <th className="px-4 py-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reviewItems.map((item, idx) => {
                                            const prodName = products.find(p => p.id === item.product_id)?.name || 'Unknown Product';
                                            return (
                                                <tr key={idx} className="hover:bg-blue-50/30">
                                                    <td className="px-4 py-3 font-medium text-slate-800">
                                                        {prodName}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select 
                                                            className="w-full border rounded p-1 bg-white"
                                                            value={item.warehouse_id}
                                                            onChange={(e) => updateReviewItem(idx, 'warehouse_id', e.target.value)}
                                                        >
                                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            className="w-full border rounded p-1"
                                                            value={item.batch_number}
                                                            onChange={(e) => updateReviewItem(idx, 'batch_number', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="date"
                                                            className="w-full border rounded p-1"
                                                            value={item.expiry_date}
                                                            onChange={(e) => updateReviewItem(idx, 'expiry_date', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="number"
                                                            className="w-full border rounded p-1 text-center font-bold"
                                                            value={item.quantity}
                                                            onChange={(e) => updateReviewItem(idx, 'quantity', Number(e.target.value))}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="number"
                                                            className="w-full border rounded p-1 text-center"
                                                            value={item.cost_price}
                                                            onChange={(e) => updateReviewItem(idx, 'cost_price', Number(e.target.value))}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input 
                                                            type="number"
                                                            className="w-full border rounded p-1 text-center text-blue-600 font-bold"
                                                            value={item.selling_price}
                                                            onChange={(e) => updateReviewItem(idx, 'selling_price', Number(e.target.value))}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button onClick={() => removeReviewItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-white border-t flex justify-between items-center">
                        <div className="text-sm text-slate-500 font-bold uppercase">
                            إجمالي القيمة: <span className="font-black text-slate-900 text-lg ml-2">{currency}{reviewItems.reduce((a,b) => a + (b.quantity * b.cost_price), 0).toLocaleString()}</span>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setReviewOrder(null)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleConvert} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 flex items-center gap-2 transition-all">
                                <Save className="w-5 h-5" />
                                {t('pur.convert_invoice')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
