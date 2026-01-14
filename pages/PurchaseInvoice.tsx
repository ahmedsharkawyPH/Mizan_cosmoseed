
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseItem } from '../types';
import { Plus, Save, ArrowLeft, Trash2, Percent, PackagePlus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect, { SearchableSelectRef } from '../components/SearchableSelect';

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
  const [sell, setSell] = useState(0);

  const productRef = useRef<SearchableSelectRef>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const sellRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const def = warehouses.find(w => w.is_default);
    if(def) setSelectedWarehouse(def.id);
  }, [warehouses]);

  useEffect(() => {
    if (selProd) {
      const p = products.find(x => x.id === selProd);
      if (p && p.batches.length > 0) {
        const lastBatch = p.batches[p.batches.length-1];
        setCost(lastBatch.purchase_price);
        setSell(lastBatch.selling_price);
      }
    }
  }, [selProd, products]);

  const addItem = () => {
    if (!selProd || qty <= 0 || !selectedWarehouse) return;
    
    setCart([...cart, {
      product_id: selProd,
      warehouse_id: selectedWarehouse,
      batch_number: 'AUTO',
      quantity: qty,
      cost_price: cost,
      selling_price: sell,
      expiry_date: '2099-12-31'
    }]);

    setSelProd('');
    setQty(1);
    setCost(0);
    setSell(0);
    setTimeout(() => productRef.current?.focus(), 100);
  };

  const save = async () => {
    if (!selectedSupplier || cart.length === 0) return;
    const res = await db.createPurchaseInvoice(selectedSupplier, cart, cashPaid, isReturn);
    if (res.success) navigate('/inventory');
    else alert(res.message);
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
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <SearchableSelect label={t('pur.select_supplier')} placeholder="Search Supplier..." options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))} value={selectedSupplier} onChange={setSelectedSupplier} autoFocus={!isReturn} />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold">{t('pur.add_item')}</h3>
                <select className="text-sm border p-1 rounded" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-4">
                    <SearchableSelect ref={productRef} label={t('inv.add')} placeholder="Search Product..." options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.code }))} value={selProd} onChange={setSelProd} />
                </div>
                <div><label className="text-xs font-bold text-gray-500">{t('pur.cost')}</label><input ref={costRef} type="number" className="w-full border p-2 rounded" value={cost} onChange={e => setCost(+e.target.value)} onKeyDown={e => e.key === 'Enter' && qtyRef.current?.focus()} /></div>
                <div><label className="text-xs font-bold text-gray-500">{t('stock.qty')}</label><input ref={qtyRef} type="number" className="w-full border p-2 rounded" value={qty} onChange={e => setQty(+e.target.value)} onKeyDown={e => e.key === 'Enter' && sellRef.current?.focus()} /></div>
                <div><label className="text-xs font-bold text-gray-500">{t('pur.sell')}</label><input ref={sellRef} type="number" className="w-full border p-2 rounded" value={sell} onChange={e => setSell(+e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} /></div>
                <div className="flex items-end"><button onClick={addItem} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 shadow-sm">+ {t('inv.add_btn')}</button></div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 bg-white p-6 rounded-xl shadow-sm border h-fit space-y-4">
            <h3 className="font-bold border-b pb-2">{t('inv.total')}</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
                {cart.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                        <span>{products.find(x => x.id === item.product_id)?.name} (x{item.quantity})</span>
                        <button onClick={() => setCart(cart.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>
            <div className="text-2xl font-bold text-blue-600 text-center">{currency}{totalAmount.toLocaleString()}</div>
            <div><label className="text-sm font-bold text-gray-700">{isReturn ? 'Received' : 'Paid'}</label><input type="number" className="w-full border p-2 rounded font-bold text-lg" value={cashPaid} onChange={e => setCashPaid(+e.target.value)} /></div>
            <button onClick={save} disabled={cart.length === 0 || !selectedSupplier} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold shadow-md hover:bg-emerald-700 transition-all">{t('pur.submit')}</button>
        </div>
      </div>
    </div>
  );
}
