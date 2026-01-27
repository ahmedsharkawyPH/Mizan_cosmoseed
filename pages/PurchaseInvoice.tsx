
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseItem } from '../types';
import { Plus, Save, ArrowLeft, Trash2, Percent, PackagePlus, X, TrendingUp, AlertCircle, FileText, Calendar } from 'lucide-react';
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
  const [manualInvoiceNo, setManualInvoiceNo] = useState(''); // حقل رقم فاتورة المورد
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]); // حقل تاريخ الفاتورة
  
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
      setTimeout(() => costRef.current?.focus(), 50);
    }
  }, [selProd, products]);

  const addItem = () => {
    if (!selProd) {
        toast.error("يرجى اختيار الصنف أولاً");
        return;
    }
    if (Number(qty) <= 0) {
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
      batch_number: `BATCH-${Date.now().toString().slice(-6)}`,
      quantity: Number(qty),
      cost_price: Number(cost),
      selling_price: Number(sell),
      expiry_date: '2099-12-31'
    };
    
    setCart(prev => [...prev, newItem]);
    setSelProd('');
    setQty(1);
    setCost(0);
    setMargin(0);
    setSell(0);
    
    toast.success("تمت الإضافة للفاتورة");
    setTimeout(() => productRef.current?.focus(), 100);
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
    
    const res = await db.createPurchaseInvoice(selectedSupplier, cart, cashPaid, isReturn, manualInvoiceNo, manualDate);
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
        <button id="btn_back_inventory" name="btn_back_inventory" onClick={() => navigate('/inventory')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className={`text-2xl font-bold ${isReturn ? 'text-red-600' : 'text-blue-600'}`}>
            {isReturn ? t('pur.return_title') : t('pur.title')}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                <div className="md:col-span-6">
                    <SearchableSelect 
                        id="pur_supplier_select"
                        name="supplier_id"
                        label={t('pur.select_supplier')} 
                        placeholder="ابحث عن المورد..." 
                        options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))} 
                        value={selectedSupplier} 
                        onChange={setSelectedSupplier} 
                    />
                </div>
                
                {/* حقول رقم الفاتورة والتاريخ التي تظهر بعد اختيار المورد */}
                {selectedSupplier && (
                    <>
                        <div className="md:col-span-3">
                            <label htmlFor="manual_invoice_no" className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" /> رقم فاتورة المورد
                            </label>
                            <input 
                                id="manual_invoice_no"
                                type="text"
                                className="w-full border p-2.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                                placeholder="اختياري (سجل رقم فاتورة المورد)"
                                value={manualInvoiceNo}
                                onChange={e => setManualInvoiceNo(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label htmlFor="manual_date" className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" /> تاريخ الشراء
                            </label>
                            <input 
                                id="manual_date"
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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> تفاصيل الصنف المشتراة
                </h3>
                <div className="flex items-center gap-3">
                    <button id="btn_quick_new_product" name="btn_quick_new_product" onClick={() => setIsAddModalOpen(true)} className="text-blue-600 hover:text-blue-700 text-sm font-bold flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-lg transition-colors border border-blue-100">
                        <PackagePlus className="w-4 h-4" /> صنف جديد
                    </button>
                    <select id="pur_warehouse_selector" name="warehouse_id" className="text-sm border p-1 rounded font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-6">
                    <SearchableSelect 
                        id="pur_product_selector"
                        name="product_id"
                        ref={productRef} 
                        label={t('inv.product')} 
                        placeholder="ابحث عن الصنف..." 
                        options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.code }))} 
                        value={selProd} 
                        onChange={setSelProd} 
                        disabled={!selectedSupplier}
                    />
                </div>
                <div>
                    <label htmlFor="pur_cost_input" className="text-[10px] font-bold text-gray-500 uppercase">{t('pur.cost')}</label>
                    <input id="pur_cost_input" name="cost_price" ref={costRef} type="number" className="w-full border p-2 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500" value={cost || ''} onChange={e => handleCostChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && marginRef.current?.focus()} disabled={!selProd} />
                </div>
                <div>
                    <label htmlFor="pur_margin_input" className="text-[10px] font-bold text-blue-500 uppercase">{t('pur.profit_margin')} %</label>
                    <input id="pur_margin_input" name="profit_margin" ref={marginRef} type="number" className="w-full border border-blue-200 p-2 rounded font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" value={margin || ''} onChange={e => handleMarginChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && qtyRef.current?.focus()} disabled={!selProd} />
                </div>
                <div>
                    <label htmlFor="pur_qty_input" className="text-[10px] font-bold text-gray-500 uppercase">{t('stock.qty')}</label>
                    <input id="pur_qty_input" name="quantity" ref={qtyRef} type="number" className="w-full border p-2 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500" value={qty || ''} onChange={e => setQty(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && sellRef.current?.focus()} disabled={!selProd} />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="pur_sell_input" className="text-[10px] font-bold text-emerald-600 uppercase">{t('pur.sell')} (البيع النهائي)</label>
                    <input id="pur_sell_input" name="selling_price" ref={sellRef} type="number" className="w-full border-2 border-emerald-100 p-2 rounded font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500" value={sell || ''} onChange={e => handleSellChange(Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && addItem()} disabled={!selProd} />
                </div>
                <div className="flex items-end">
                    <button id="btn_add_purchase_item" name="btn_add_purchase_item" onClick={addItem} type="button" className="w-full bg-blue-600 text-white h-[42px] rounded-lg font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50" disabled={!selProd}>
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
                        <div key={i} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{products.find(x => x.id === item.product_id)?.name}</span>
                                <span className="text-[10px] text-slate-400">الكمية: {item.quantity} | البيع: {currency}{item.selling_price}</span>
                            </div>
                            <button id={`btn_remove_pur_${i}`} name={`btn_remove_pur_${i}`} onClick={() => setCart(cart.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))
                )}
            </div>
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="text-xs text-blue-500 font-bold uppercase mb-1">إجمالي المشتريات</div>
                <div className="text-3xl font-black text-blue-700">{currency}{totalAmount.toLocaleString()}</div>
            </div>
            <div>
                <label htmlFor="pur_cash_paid_input" className="block text-xs font-bold text-gray-500 uppercase mb-1">{isReturn ? 'المبلغ المستلم' : 'المبلغ المدفوع كاش'}</label>
                <input id="pur_cash_paid_input" name="cash_paid" type="number" className="w-full border p-2.5 rounded-xl font-black text-xl text-emerald-600 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500 outline-none" value={cashPaid || ''} onChange={e => setCashPaid(Number(e.target.value))} placeholder="0.00" disabled={!selectedSupplier} />
            </div>
            <button id="btn_submit_purchase" name="btn_submit_purchase" onClick={save} disabled={cart.length === 0 || !selectedSupplier} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50">
                {t('pur.submit')}
            </button>
        </div>
      </div>
    </div>
  );
}
