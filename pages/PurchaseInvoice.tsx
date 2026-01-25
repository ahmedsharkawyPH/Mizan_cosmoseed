import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseItem } from '../types';
import { Plus, Save, ArrowLeft, Trash2, Percent, PackagePlus, X, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect, { SearchableSelectRef } from '../components/SearchableSelect';
// @ts-ignore
import toast from 'react-hot-toast';

interface Props {
  type: 'PURCHASE' | 'RETURN';
}

export default function PurchaseInvoice({ type }: Props) {
  const navigate = useNavigate();
  const currency = db.getSettings().currency;
  const isReturn = type === 'RETURN';
  
  const [suppliers] = useState(db.getSuppliers());
  const [products, setProducts] = useState(db.getProductsWithBatches());
  const [warehouses] = useState(db.getWarehouses());
  
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [cashPaid, setCashPaid] = useState<number>(0);
  
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selProd, setSelProd] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [margin, setMargin] = useState(0); 
  const [sell, setSell] = useState(0);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProdForm, setNewProdForm] = useState({ name: '', sellingPrice: 0 });

  const productRef = useRef<SearchableSelectRef>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const marginRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const sellRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const def = warehouses.find(w => w.is_default);
    if(def) setSelectedWarehouse(def.id);
  }, [warehouses]);

  // Handle Cost Change: Update Margin based on current Sell, or Sell based on current Margin
  const handleCostChange = (val: number) => {
    setCost(val);
    if (val > 0 && margin > 0) {
      const calculatedSell = val * (1 + margin / 100);
      setSell(parseFloat(calculatedSell.toFixed(2)));
    }
  };

  // Handle Margin Change: Update Sell Price
  const handleMarginChange = (val: number) => {
    setMargin(val);
    if (cost > 0) {
      const calculatedSell = cost * (1 + val / 100);
      setSell(parseFloat(calculatedSell.toFixed(2)));
    }
  };

  // Handle Sell Price Change: Update Margin %
  const handleSellChange = (val: number) => {
    setSell(val);
    if (cost > 0 && val > 0) {
      const calculatedMargin = ((val / cost) - 1) * 100;
      setMargin(parseFloat(calculatedMargin.toFixed(1)));
    }
  };

  useEffect(() => {
    if (selProd) {
      const p = products.find(x => x.id === selProd);
      if (p && p.batches.length > 0) {
        const lastBatch = p.batches[p.batches.length-1];
        setCost(lastBatch.purchase_price);
        setSell(lastBatch.selling_price);
        if (lastBatch.purchase_price > 0) {
            const currentMargin = ((lastBatch.selling_price / lastBatch.purchase_price) - 1) * 100;
            setMargin(parseFloat(currentMargin.toFixed(1)));
        }
      } else {
        setCost(0);
        setSell(0);
        setMargin(0);
      }
    }
  }, [selProd, products]);

  const addItem = () => {
    if (!selProd) {
        toast.error("يرجى اختيار الصنف أولاً");
        return;
    }
    if (qty <= 0) {
        toast.error("الكمية يجب أن تكون أكبر من صفر");
        return;
    }
    if (!selectedWarehouse) {
        toast.error("يرجى اختيار المستودع");
        return;
    }

    const newItem: PurchaseItem = {
      product_id: selProd,
      warehouse_id: selectedWarehouse,
      batch_number: `AUTO-${Date.now().toString().slice(-4)}`,
      quantity: Number(qty),
      cost_price: Number(cost),
      selling_price: Number(sell),
      expiry_date: '2099-12-31'
    };
    
    setCart(prev => [...prev, newItem]);

    // Reset fields for next item
    setSelProd('');
    setQty(1);
    setCost(0);
    setMargin(0);
    setSell(0);
    
    toast.success("تمت الإضافة للمسودة");
    setTimeout(() => productRef.current?.focus(), 100);
  };

  const handleQuickAddProduct = async () => {
    if (!newProdForm.name) return alert("يرجى إدخال اسم الصنف");
    const allProds = db.getProductsWithBatches();
    const codes = allProds.map(p => parseInt(p.code || '0')).filter(c => !isNaN(c));
    const nextCode = (codes.length > 0 ? Math.max(...codes) + 1 : 1001).toString();
    const pid = await db.addProduct(
        { code: nextCode, name: newProdForm.name },
        { quantity: 0, purchase_price: 0, selling_price: newProdForm.sellingPrice, batch_number: 'AUTO', expiry_date: '2099-12-31' }
    );
    if (pid) {
        setProducts(db.getProductsWithBatches());
        setSelProd(pid);
        setIsAddModalOpen(false);
        setNewProdForm({ name: '', sellingPrice: 0 });
        setTimeout(() => costRef.current?.focus(), 100);
    }
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
    
    const res = await db.createPurchaseInvoice(selectedSupplier, cart, cashPaid, isReturn);
    if (res.success) {
        toast.success("تم حفظ الفاتورة بنجاح");
        navigate('/purchases/list');
    } else {
        toast.error(res.message);
    }
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/inventory')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className={`text-2xl font-bold ${isReturn ? 'text-red-600' : 'text-blue-600'}`}>
            {isReturn ? t('pur.return_title') : t('pur.title')}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <SearchableSelect 
                label={t('pur.select_supplier')} 
                placeholder="ابحث عن المورد..." 
                options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))} 
                value={selectedSupplier} 
                onChange={setSelectedSupplier} 
                autoFocus={!isReturn} 
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> تفاصيل الصنف
                </h3>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsAddModalOpen(true)} className="text-blue-600 hover:text-blue-700 text-sm font-bold flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-lg transition-colors border border-blue-100">
                        <PackagePlus className="w-4 h-4" /> صنف جديد
                    </button>
                    <select className="text-sm border p-1 rounded font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-6">
                    <SearchableSelect ref={productRef} label={t('inv.product')} placeholder="ابحث عن الصنف..." options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.code }))} value={selProd} onChange={setSelProd} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">{t('pur.cost')}</label>
                    <input ref={costRef} type="number" className="w-full border p-2 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500" value={cost || ''} onChange={e => handleCostChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && marginRef.current?.focus()} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-blue-500 uppercase">{t('pur.profit_margin')} %</label>
                    <input ref={marginRef} type="number" className="w-full border border-blue-200 p-2 rounded font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" value={margin || ''} onChange={e => handleMarginChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && qtyRef.current?.focus()} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">{t('stock.qty')}</label>
                    <input ref={qtyRef} type="number" className="w-full border p-2 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500" value={qty || ''} onChange={e => setQty(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && sellRef.current?.focus()} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-emerald-600 uppercase">{t('pur.sell')} (سعر البيع النهائي)</label>
                    <input ref={sellRef} type="number" className="w-full border-2 border-emerald-100 p-2 rounded font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500" value={sell || ''} onChange={e => handleSellChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && addItem()} />
                </div>
                <div className="flex items-end">
                    <button onClick={addItem} type="button" className="w-full bg-blue-600 text-white h-[42px] rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> {t('inv.add_btn')}
                    </button>
                </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 bg-white p-6 rounded-2xl shadow-card border border-slate-100 h-fit space-y-4">
            <h3 className="font-bold border-b pb-2 text-slate-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-500" /> ملخص الفاتورة
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">لا توجد أصناف مضافة حالياً</div>
                ) : (
                    cart.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-right-2">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{products.find(x => x.id === item.product_id)?.name}</span>
                                <span className="text-[10px] text-slate-400">الكمية: {item.quantity} | البيع: {currency}{item.selling_price}</span>
                            </div>
                            <button onClick={() => setCart(cart.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))
                )}
            </div>
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="text-xs text-blue-500 font-bold uppercase mb-1">إجمالي المشتريات</div>
                <div className="text-3xl font-black text-blue-700">{currency}{totalAmount.toLocaleString()}</div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{isReturn ? 'المبلغ المستلم' : 'المبلغ المدفوع'}</label>
                <input type="number" className="w-full border p-2.5 rounded-xl font-black text-xl text-emerald-600 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500 outline-none" value={cashPaid || ''} onChange={e => setCashPaid(Number(e.target.value))} placeholder="0.00" />
            </div>
            <button onClick={save} disabled={cart.length === 0 || !selectedSupplier} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50">
                {t('pur.submit')}
            </button>
        </div>
      </div>

      {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2 text-slate-800"><PackagePlus className="w-5 h-5 text-blue-600" /> إضافة صنف سريع</h3>
                      <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div><label className="block text-sm font-bold text-gray-700 mb-1">اسم الصنف *</label><input className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={newProdForm.name} onChange={e => setNewProdForm({...newProdForm, name: e.target.value})} placeholder="أدخل اسم المنتج" autoFocus /></div>
                      <div><label className="block text-sm font-bold text-gray-700 mb-1">سعر البيع الافتراضي</label><input type="number" className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={newProdForm.sellingPrice || ''} onChange={e => setNewProdForm({...newProdForm, sellingPrice: parseFloat(e.target.value) || 0})} placeholder="0.00" /></div>
                      <button onClick={handleQuickAddProduct} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">حفظ الصنف</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}