
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
  
  // Item Form
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selProd, setSelProd] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [sell, setSell] = useState(0);
  const [profitMargin, setProfitMargin] = useState<string>('');
  const [expiry, setExpiry] = useState('');

  // Quick Add Product State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ name: '', code: '', package_type: '', items_per_package: 0 });

  // Refs for navigation
  const productRef = useRef<SearchableSelectRef>(null);
  const batchRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const marginRef = useRef<HTMLInputElement>(null);
  const sellRef = useRef<HTMLInputElement>(null);

  // Initial Warehouse
  useEffect(() => {
    const def = warehouses.find(w => w.is_default);
    if(def) setSelectedWarehouse(def.id);
  }, [warehouses]);

  // Focus product on mount
  useEffect(() => {
      setTimeout(() => {
          productRef.current?.focus();
      }, 100);
  }, [type]);

  // Auto-fill product data on select
  useEffect(() => {
    if (selProd) {
      const p = products.find(x => x.id === selProd);
      if (p && p.batches.length > 0) {
        const lastBatch = p.batches[p.batches.length-1];
        setCost(lastBatch.purchase_price);
        setSell(lastBatch.selling_price);
        
        if (lastBatch.purchase_price > 0) {
            const margin = ((lastBatch.selling_price - lastBatch.purchase_price) / lastBatch.purchase_price) * 100;
            setProfitMargin(margin.toFixed(2));
        }

        if (isReturn) {
            setBatchNo(lastBatch.batch_number);
        }
      } else {
          setCost(0);
          setSell(0);
          setProfitMargin('');
      }
    }
  }, [selProd, products, isReturn]);

  // --- Calculation Handlers ---

  const handleCostChange = (val: number) => {
      setCost(val);
      if (profitMargin && !isNaN(parseFloat(profitMargin))) {
          const margin = parseFloat(profitMargin);
          const newSell = val * (1 + margin / 100);
          setSell(Number(newSell.toFixed(2)));
      }
  };

  const handleMarginChange = (val: string) => {
      setProfitMargin(val);
      const margin = parseFloat(val);
      if (!isNaN(margin) && cost > 0) {
          const newSell = cost * (1 + margin / 100);
          setSell(Number(newSell.toFixed(2)));
      }
  };

  const handleSellChange = (val: number) => {
      setSell(val);
      if (cost > 0 && val > 0) {
          const margin = ((val - cost) / cost) * 100;
          setProfitMargin(margin.toFixed(2));
      }
  };

  // --- Navigation Handlers ---
  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement>, action?: () => void) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (action) action();
          else if (nextRef && nextRef.current) {
              nextRef.current.focus();
              // @ts-ignore
              if (nextRef.current.select) nextRef.current.select();
          }
      }
  };

  // --- Quick Add Product Handler ---
  const handleSaveNewProduct = async () => {
      if (!newProductForm.name || !newProductForm.code) {
          alert("Name and Code are required");
          return;
      }
      
      const newId = await db.addProduct({
          name: newProductForm.name,
          code: newProductForm.code,
          package_type: newProductForm.package_type,
          items_per_package: newProductForm.items_per_package
      }); // Note: No batch added yet, will be added when item is added to invoice

      // Refresh products list
      setProducts(db.getProductsWithBatches());
      
      // Select the new product
      setSelProd(newId);
      
      // Close modal & reset
      setIsAddProductOpen(false);
      setNewProductForm({ name: '', code: '', package_type: '', items_per_package: 0 });

      // Focus Batch input to continue flow
      setTimeout(() => {
          // @ts-ignore
          batchRef.current?.focus();
      }, 100);
  };

  // ----------------------------

  const addItem = () => {
    if (!selProd || !batchNo || qty <= 0 || cost < 0 || !selectedWarehouse) return;
    
    if (isReturn) {
        const p = products.find(x => x.id === selProd);
        const b = p?.batches.find(x => x.batch_number === batchNo && x.warehouse_id === selectedWarehouse);
        if (!b) {
            alert("Batch not found for this product in the selected warehouse!");
            return;
        }
        if (qty > b.quantity) {
            alert(`Cannot return more than stock! Available: ${b.quantity}`);
            return;
        }
    }

    setCart([...cart, {
      product_id: selProd,
      warehouse_id: selectedWarehouse,
      batch_number: batchNo,
      quantity: qty,
      cost_price: cost,
      selling_price: sell,
      expiry_date: expiry || new Date().toISOString()
    }]);

    // Reset form
    setSelProd('');
    setBatchNo('');
    setQty(1);
    setCost(0);
    setSell(0);
    setProfitMargin('');
    
    // Return focus to product search
    setTimeout(() => {
        productRef.current?.focus();
    }, 100);
  };

  const removeItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!selectedSupplier || cart.length === 0) return;
    const res = await db.createPurchaseInvoice(selectedSupplier, cart, cashPaid, isReturn);
    if (res.success) {
      alert(res.message);
      navigate('/inventory');
    } else {
      alert(res.message);
    }
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);

  // Prepare Options
  const supplierOptions = useMemo(() => suppliers.map(s => ({
    value: s.id,
    label: s.name,
    subLabel: `${currency}${s.current_balance}`
  })), [suppliers, currency]);

  const productOptions = useMemo(() => products.map(p => ({
    value: p.id,
    label: p.name,
    subLabel: p.code
  })), [products]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/inventory')} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className={`text-2xl font-bold ${isReturn ? 'text-red-600' : 'text-blue-600'}`}>
            {isReturn ? t('pur.return_title') : t('pur.title')}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Form */}
        <div className="flex-1 space-y-6">
          
          {/* Supplier Selection */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <SearchableSelect 
                label={t('pur.select_supplier')}
                placeholder="Search Supplier Name..."
                options={supplierOptions}
                value={selectedSupplier}
                onChange={setSelectedSupplier}
                autoFocus={!isReturn}
            />
          </div>

          {/* Item Entry */}
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold">{t('pur.add_item')}</h3>
                <select className="text-sm border p-1 rounded" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 flex items-end gap-2">
                    <div className="flex-1">
                        <SearchableSelect 
                            ref={productRef}
                            label={t('inv.add')}
                            placeholder="Search Product Name or Code..."
                            options={productOptions}
                            value={selProd}
                            onChange={setSelProd}
                            onComplete={() => {
                                // Focus batch after selection
                                // @ts-ignore
                                batchRef.current?.focus();
                            }}
                        />
                    </div>
                    {/* Add Product Button */}
                    <button 
                        onClick={() => setIsAddProductOpen(true)}
                        className="bg-blue-100 text-blue-600 p-2.5 rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors mb-0.5"
                        title={t('stock.new')}
                    >
                        <PackagePlus className="w-5 h-5" />
                    </button>
                </div>
                
                <div>
                    <label className="text-xs text-gray-500">{t('pur.batch')}</label>
                    {isReturn ? (
                         <select 
                            ref={batchRef as any}
                            className="w-full border p-2 rounded" 
                            value={batchNo} 
                            onChange={e => setBatchNo(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, qtyRef)} // Skip others in return
                         >
                             <option value="">Select Batch</option>
                             {products.find(p => p.id === selProd)?.batches.filter(b => b.warehouse_id === selectedWarehouse).map(b => (
                                 <option key={b.id} value={b.batch_number}>{b.batch_number} (Qty: {b.quantity})</option>
                             ))}
                         </select>
                    ) : (
                        <input 
                            ref={batchRef as any}
                            className="w-full border p-2 rounded" 
                            placeholder="Batch No" 
                            value={batchNo} 
                            onChange={e => setBatchNo(e.target.value)} 
                            onKeyDown={(e) => handleKeyDown(e, expiryRef)}
                        />
                    )}
                </div>

                {!isReturn && (
                <div>
                    <label className="text-xs text-gray-500">{t('pur.expiry')}</label>
                    <input 
                        ref={expiryRef}
                        type="date" 
                        className="w-full border p-2 rounded" 
                        value={expiry} 
                        onChange={e => setExpiry(e.target.value)} 
                        onKeyDown={(e) => handleKeyDown(e, costRef)}
                    />
                </div>
                )}

                {/* Updated Grid for Cost, Qty, Margin, Sell */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                        <label className="text-xs text-gray-500 font-bold">{t('pur.cost')}</label>
                        <input 
                            ref={costRef}
                            type="number" 
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={cost} 
                            onChange={e => handleCostChange(+e.target.value)} 
                            disabled={isReturn} 
                            onKeyDown={(e) => handleKeyDown(e, qtyRef)}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold">{t('stock.qty')}</label>
                        <input 
                            ref={qtyRef}
                            type="number" 
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                            value={qty} 
                            onChange={e => setQty(+e.target.value)} 
                            onKeyDown={(e) => {
                                if (isReturn) {
                                    if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                                } else {
                                    handleKeyDown(e, marginRef);
                                }
                            }}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold flex items-center gap-1">
                            {t('inv.profit')} %
                        </label>
                        <div className="relative">
                            <input 
                                ref={marginRef}
                                type="number" 
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-emerald-600 font-bold" 
                                value={profitMargin} 
                                onChange={e => handleMarginChange(e.target.value)} 
                                disabled={isReturn}
                                placeholder="%"
                                onKeyDown={(e) => handleKeyDown(e, sellRef)}
                                onFocus={(e) => e.target.select()}
                            />
                            <Percent className="absolute right-2 top-2.5 w-3 h-3 text-gray-400" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold">{t('pur.sell')}</label>
                        <input 
                            ref={sellRef}
                            type="number" 
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700" 
                            value={sell} 
                            onChange={e => handleSellChange(+e.target.value)} 
                            disabled={isReturn} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addItem();
                                }
                            }}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                </div>
            </div>
            <button onClick={addItem} className="w-full bg-blue-50 text-blue-600 py-2 rounded font-medium hover:bg-blue-100">
                + {t('pur.add_item')}
            </button>
          </div>
        </div>

        {/* Right: Cart Summary */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
             <div className="bg-white p-6 rounded-xl shadow-sm border flex-1 flex flex-col">
                <h3 className="font-bold mb-4">{t('inv.total')}</h3>
                <div className="flex-1 overflow-y-auto max-h-96 space-y-2">
                    {cart.map((item, i) => {
                        const wName = warehouses.find(w => w.id === item.warehouse_id)?.name;
                        // Calculate item margin for display
                        const itemMargin = item.cost_price > 0 
                            ? (((item.selling_price - item.cost_price) / item.cost_price) * 100).toFixed(1) 
                            : '0';

                        return (
                            <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded text-sm group">
                                <div>
                                    <div className="font-medium">{products.find(x => x.id === item.product_id)?.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {item.batch_number} ({wName}) x {item.quantity}
                                    </div>
                                    <div className="text-[10px] text-emerald-600 font-medium">
                                        Margin: {itemMargin}% | Sell: {item.selling_price}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="font-bold">{currency}{item.quantity * item.cost_price}</div>
                                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    {cart.length === 0 && <div className="text-center text-gray-400 py-8">Empty</div>}
                </div>

                <div className="border-t pt-4 mt-4 space-y-3">
                    <div className="flex justify-between text-xl font-bold">
                        <span>{t('inv.total')}</span>
                        <span>{currency}{totalAmount.toLocaleString()}</span>
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium">{isReturn ? 'Cash Received' : 'Cash Paid'}</label>
                        <input 
                            type="number" 
                            className="w-full border p-2 rounded font-bold" 
                            value={cashPaid} 
                            onChange={e => setCashPaid(+e.target.value)} 
                        />
                    </div>

                    <button 
                        onClick={save} 
                        disabled={!selectedSupplier || cart.length === 0}
                        className={`w-full py-3 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 ${
                            !selectedSupplier || cart.length === 0 ? 'bg-gray-300' : isReturn ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                    >
                        <Save className="w-5 h-5" />
                        {isReturn ? t('pur.return_submit') : t('pur.submit')}
                    </button>
                </div>
             </div>
        </div>
      </div>

      {/* QUICK ADD PRODUCT MODAL */}
      {isAddProductOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center p-5 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          <PackagePlus className="w-5 h-5 text-blue-500" />
                          {t('prod.new_title')}
                      </h3>
                      <button onClick={() => setIsAddProductOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">{t('prod.name')}</label>
                          <input 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Panadol Extra"
                            value={newProductForm.name}
                            onChange={e => setNewProductForm({...newProductForm, name: e.target.value})}
                            autoFocus
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">{t('prod.code')}</label>
                          <input 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            placeholder="e.g. 1001"
                            value={newProductForm.code}
                            onChange={e => setNewProductForm({...newProductForm, code: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('prod.pkg_type')}</label>
                              <input 
                                className="w-full border border-slate-200 p-3 rounded-xl text-sm"
                                placeholder="e.g. Box"
                                value={newProductForm.package_type}
                                onChange={e => setNewProductForm({...newProductForm, package_type: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('prod.pkg_items')}</label>
                              <input 
                                type="number"
                                className="w-full border border-slate-200 p-3 rounded-xl text-sm"
                                placeholder="e.g. 10"
                                value={newProductForm.items_per_package || ''}
                                onChange={e => setNewProductForm({...newProductForm, items_per_package: +e.target.value})}
                              />
                          </div>
                      </div>
                      
                      <div className="pt-2 flex justify-end gap-3">
                          <button 
                            onClick={() => setIsAddProductOpen(false)}
                            className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={handleSaveNewProduct}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                          >
                              {t('set.save')}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
