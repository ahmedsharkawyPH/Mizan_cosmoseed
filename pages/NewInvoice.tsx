
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { Customer, ProductWithBatches, CartItem, BatchStatus } from '../types';
import { Plus, Trash2, Save, Search, AlertCircle, Calculator, Package, Users, ArrowLeft, ChevronDown, Printer, Settings as SettingsIcon, Check, X, Eye, RotateCcw, ShieldAlert, Lock, Percent, Info, Tag, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const { id } = useParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [warehouses] = useState(db.getWarehouses());
  const [isDbFullyLoaded, setIsDbFullyLoaded] = useState(db.isFullyLoaded);
  
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashPayment, setCashPayment] = useState<number>(0);
  const [additionalDiscount, setAdditionalDiscount] = useState<number>(0);
  const [additionalDiscountPercent, setAdditionalDiscountPercent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [showLastCost, setShowLastCost] = useState(false);

  // States for price warning
  const [showPriceWarning, setShowPriceWarning] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');

  // States for in-table editing
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'qty' | 'price' | null>(null);
  const [tempVal, setTempVal] = useState<number>(0);

  const [showSettings, setShowSettings] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceSettings>(() => {
      const saved = localStorage.getItem('invoice_settings');
      return saved ? JSON.parse(saved) : { enableManualPrice: false, enableDiscount: true, showCostInfo: false };
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
    setProducts(db.getProductsWithBatches());
    const def = db.getWarehouses().find(w => w.is_default);
    if(def) setSelectedWarehouse(def.id);
    
    if (id) {
      const invoices = db.getInvoices();
      const invoice = invoices.find(i => i.id === id);
      if (invoice) {
        setSelectedCustomer(invoice.customer_id);
        if (invoice.items) setCart(invoice.items);
        if (invoice.type === 'RETURN') setIsReturnMode(true);
        if (invoice.additional_discount) setAdditionalDiscount(invoice.additional_discount);
      }
    } else {
        setTimeout(() => customerRef.current?.focus(), 100);
    }
  }, [id]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (db.isFullyLoaded !== isDbFullyLoaded) {
        setIsDbFullyLoaded(db.isFullyLoaded);
        setProducts(db.getProductsWithBatches()); 
        setCustomers(db.getCustomers());
      }
    }, 2000);
    return () => clearInterval(checkInterval);
  }, [isDbFullyLoaded]);

  const customerOptions = useMemo(() => 
    customers.map(c => ({ value: c.id, label: c.name, subLabel: c.phone })), 
  [customers]);

  const productOptions = useMemo(() => 
    products.map(p => {
        const batchInWarehouse = p.batches.find(b => b.warehouse_id === selectedWarehouse);
        const qtyInWarehouse = batchInWarehouse ? batchInWarehouse.quantity : 0;
        const price = batchInWarehouse ? batchInWarehouse.selling_price : (p.selling_price || 0);
        
        return { 
            value: p.id, 
            label: p.name, 
            subLabel: `سعر: ${price} ${currency} | رصيد: ${qtyInWarehouse} | كود: ${p.code || '---'}`
        };
    }), 
  [products, selectedWarehouse, currency]);

  useEffect(() => {
      if (selectedCustomer && !id) {
          const customer = customers.find(c => c.id === selectedCustomer);
          if (customer?.default_discount_percent) {
              setAdditionalDiscountPercent(customer.default_discount_percent);
          } else {
              setAdditionalDiscountPercent(0);
          }
          setTimeout(() => {
            productRef.current?.focus();
          }, 100);
      }
  }, [selectedCustomer, customers, id]);

  const currentProduct = useMemo(() => {
    return products.find(p => p.id === selectedProduct);
  }, [selectedProduct, products]);

  const availableBatch = useMemo(() => {
    if (!currentProduct || !selectedWarehouse) return null;
    const warehouseBatches = currentProduct.batches.filter(b => b.warehouse_id === selectedWarehouse);
    if (warehouseBatches.length === 0) return null;
    return warehouseBatches.sort((a, b) => b.id.localeCompare(a.id))[0];
  }, [currentProduct, selectedWarehouse]);

  const currentSellingPrice = useMemo(() => {
      if (availableBatch) return availableBatch.selling_price;
      if (currentProduct) return currentProduct.selling_price || 0;
      return 0;
  }, [availableBatch, currentProduct]);

  const lastPurchasePrice = useMemo(() => {
    if (!selectedProduct) return 0;
    if (availableBatch) return availableBatch.purchase_price;
    if (currentProduct?.purchase_price) return currentProduct.purchase_price;
    
    const history = db.getPurchaseInvoices();
    let latestCost = 0;
    for (const inv of history) {
        if (inv.type === 'PURCHASE') {
            const item = inv.items.find(i => i.product_id === selectedProduct);
            if (item) {
                latestCost = item.cost_price;
                break;
            }
        }
    }
    return latestCost;
  }, [selectedProduct, availableBatch, currentProduct]);

  useEffect(() => {
      if (currentProduct) {
          setManualPrice(currentSellingPrice);
          setShowLastCost(false);
          setTimeout(() => {
              if (invoiceConfig.enableManualPrice) priceRef.current?.focus();
              else qtyRef.current?.focus();
          }, 50);
      }
  }, [currentProduct, currentSellingPrice, invoiceConfig.enableManualPrice]);

  const addItemToCart = () => {
    if (!currentProduct) return;
    const finalPrice = invoiceConfig.enableManualPrice ? Number(manualPrice) : Number(currentSellingPrice);
    
    // Check for Price Warning
    if (!isReturnMode && finalPrice < lastPurchasePrice) {
        setShowPriceWarning(true);
        setConfirmationInput('');
        return;
    }

    proceedToAddItem();
  };

  const proceedToAddItem = () => {
    if (!currentProduct) return;
    const finalPrice = invoiceConfig.enableManualPrice ? Number(manualPrice) : Number(currentSellingPrice);
    const finalDiscount = invoiceConfig.enableDiscount ? Number(discount) : 0;
    const newItem: CartItem = {
      product: currentProduct,
      batch: availableBatch || undefined,
      quantity: Number(qty),
      bonus_quantity: Number(bonus),
      discount_percentage: finalDiscount,
      unit_price: finalPrice
    };
    setCart([...cart, newItem]);
    setSelectedProduct('');
    setQty(1);
    setBonus(0);
    setDiscount(0);
    setManualPrice(0);
    setShowLastCost(false);
    setShowPriceWarning(false);
    setTimeout(() => productRef.current?.focus(), 50);
  };

  const updateCartItemValue = (idx: number, field: 'qty' | 'price', newVal: number) => {
    const newCart = [...cart];
    if (field === 'qty') {
        newCart[idx] = { ...newCart[idx], quantity: newVal };
    } else {
        newCart[idx] = { ...newCart[idx], unit_price: newVal };
    }
    setCart(newCart);
    setEditingIdx(null);
    setEditingField(null);
    setTimeout(() => productRef.current?.focus(), 50);
  };

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
    const totalAdditionalDiscountValue = discountFromPercent + additionalDiscount;
    return { 
      gross: totalGross, 
      itemDiscount: totalItemDiscount, 
      subtotal, 
      totalAdditionalDiscount: totalAdditionalDiscountValue,
      net: Math.max(0, subtotal - totalAdditionalDiscountValue) 
    };
  }, [cart, additionalDiscount, additionalDiscountPercent]);

  const handleCheckout = async (print: boolean = false) => {
    if (!selectedCustomer || cart.length === 0) {
      toast.error(t('inv.select_customer'));
      return;
    }
    setIsSubmitting(true);
    const user = authService.getCurrentUser();
    try {
      const result = id 
        ? await db.updateInvoice(id, selectedCustomer, cart, cashPayment)
        : await db.createInvoice(selectedCustomer, cart, cashPayment, isReturnMode, totals.totalAdditionalDiscount, user ? { id: user.id, name: user.name } : undefined);
      if (result.success) navigate('/invoices', result.id ? { state: { autoPrintId: result.id } } : undefined);
      else toast.error(result.message);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const liveCustomerBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    const customer = db.getCustomers().find(c => c.id === selectedCustomer);
    return customer?.current_balance || 0;
  }, [selectedCustomer, customers]);

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1600px] mx-auto pb-6">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate('/invoices')} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
             </button>
             <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                 {id ? `${t('inv.update')} #${db.getInvoices().find(i => i.id === id)?.invoice_number}` : t('nav.new_invoice')}
                 {isReturnMode && <span className="ml-2 bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-bold">{t('inv.return_mode')}</span>}
             </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isDbFullyLoaded && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 text-[10px] font-bold animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                جاري جلب كامل الأصناف...
              </div>
            )}
            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-500 hover:text-blue-600"><SettingsIcon className="w-5 h-5" /></button>
          </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 flex flex-col space-y-6 w-full">
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100">
             <SearchableSelect 
                id="inv_customer_select"
                name="customer_id"
                ref={customerRef} 
                label={t('inv.customer')} 
                placeholder={t('cust.search')} 
                options={customerOptions} 
                value={selectedCustomer} 
                onChange={setSelectedCustomer} 
             />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 relative">
            <div className="flex justify-between items-center mb-6">
                 <h3 className={`font-bold flex items-center gap-2 ${!selectedCustomer ? 'text-slate-400' : 'text-slate-700'}`}>
                    <Package className={`w-5 h-5 ${!selectedCustomer ? 'text-slate-300' : 'text-blue-600'}`} /> {isReturnMode ? t('inv.add_return_item') : t('inv.add_product')}
                 </h3>
                 <div className="flex items-center gap-2">
                    <label htmlFor="inv_warehouse_selector" className="text-xs font-bold text-slate-400 uppercase tracking-wider">المخزن:</label>
                    <select id="inv_warehouse_selector" name="warehouse_id" disabled={!selectedCustomer} className="bg-slate-50 border border-slate-200 text-sm rounded-lg p-2 font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-50" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                 </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-9">
                <SearchableSelect 
                    id="inv_product_select"
                    name="product_id"
                    ref={productRef} 
                    label={t('inv.product')} 
                    placeholder={t('cust.search')} 
                    options={productOptions} 
                    value={selectedProduct} 
                    onChange={setSelectedProduct} 
                    minSearchChars={1} 
                    disabled={!selectedCustomer} 
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <div className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    <span>{t('stock.total')}</span>
                    {selectedProduct && (
                        <button type="button" id="btn_cost_info" name="btn_cost_info" onClick={() => setShowLastCost(!showLastCost)} className={`p-1 rounded-full transition-colors ${showLastCost ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`} title="آخر سعر شراء">
                            <Info className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <div id="inv_stock_display" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 flex justify-between items-center min-h-[46px]">
                        <span>{availableBatch ? availableBatch.quantity : "0"}</span>
                        {showLastCost && (
                            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full animate-in fade-in slide-in-from-top-1 flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" /> {currency}{lastPurchasePrice.toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>
              </div>

              {invoiceConfig.enableManualPrice && (
                  <div className="col-span-6 md:col-span-3">
                    <label htmlFor="inv_manual_price_input" className="block text-sm font-bold text-slate-500 uppercase mb-1">{t('inv.price')}</label>
                    <input id="inv_manual_price_input" disabled={!selectedProduct} name="unit_price" ref={priceRef} type="number" className="w-full bg-white border border-orange-300 text-orange-700 rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50" value={manualPrice} onChange={e => setManualPrice(parseFloat(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && qtyRef.current?.focus()} />
                  </div>
              )}
              <div className="col-span-6 md:col-span-2">
                <label htmlFor="inv_qty_input" className="block text-sm font-bold text-slate-500 uppercase mb-1">{t('inv.qty')}</label>
                <input id="inv_qty_input" disabled={!selectedProduct} name="quantity" ref={qtyRef} type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" value={qty} onChange={e => setQty(parseInt(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && bonusRef.current?.focus()} />
              </div>
              <div className="col-span-6 md:col-span-2">
                <label htmlFor="inv_bonus_input" className="block text-sm font-bold text-slate-500 uppercase mb-1">{t('inv.bonus')}</label>
                <input id="inv_bonus_input" disabled={!selectedProduct} name="bonus" ref={bonusRef} type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" value={bonus} onChange={e => setBonus(parseInt(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && (invoiceConfig.enableDiscount ? discountRef.current?.focus() : addItemToCart())} />
              </div>
              {invoiceConfig.enableDiscount && (
               <div className="col-span-6 md:col-span-2">
                <label htmlFor="inv_discount_percent_input" className="block text-sm font-bold text-slate-500 uppercase mb-1">{t('inv.disc_percent')}</label>
                <input id="inv_discount_percent_input" disabled={!selectedProduct} name="discount_percent" ref={discountRef} type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center text-red-500 font-bold focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && addItemToCart()} />
              </div>
              )}
              <div className="col-span-12 md:col-span-3 flex items-end">
                  <button id="btn_add_to_cart" name="btn_add_to_cart" onClick={addItemToCart} disabled={!selectedProduct} className="w-full h-[46px] bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all flex items-center justify-center disabled:opacity-50">
                    <Plus className="w-5 h-5 mr-2" /> {t('inv.add_btn')}
                  </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex-1">
            <table className="w-full text-sm text-right">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3 text-right">{t('inv.product')}</th>
                  <th className="px-4 py-3 text-center">{t('inv.qty')}</th>
                  <th className="px-4 py-3 text-center">{t('inv.price')}</th>
                  <th className="px-4 py-3 text-left">{t('inv.total')}</th>
                  <th className="px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cart.map((item, idx) => {
                  const price = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || item.product.selling_price || 0);
                  const total = (item.quantity * price) * (1 - item.discount_percentage / 100);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{item.product.name}</td>
                      <td className="px-4 py-3 text-center">
                        {editingIdx === idx && editingField === 'qty' ? (
                          <input 
                            id={`inv_editing_qty_${idx}`}
                            name={`editing_qty_${idx}`}
                            autoFocus
                            type="number"
                            className="w-20 border-2 border-blue-500 rounded p-1 text-center font-bold"
                            value={tempVal}
                            onChange={(e) => setTempVal(parseInt(e.target.value) || 0)}
                            onBlur={() => { setEditingIdx(null); setEditingField(null); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateCartItemValue(idx, 'qty', tempVal);
                              if (e.key === 'Escape') { setEditingIdx(null); setEditingField(null); }
                            }}
                          />
                        ) : (
                          <button id={`btn_edit_qty_${idx}`} name={`btn_edit_qty_${idx}`} onClick={() => { setEditingIdx(idx); setEditingField('qty'); setTempVal(item.quantity); }} className="font-bold text-slate-700 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50">
                            {item.quantity}{item.bonus_quantity > 0 && <span className="text-xs text-green-600 ml-1">+{item.bonus_quantity}</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingIdx === idx && editingField === 'price' ? (
                           <input 
                             id={`inv_editing_price_${idx}`}
                             name={`editing_price_${idx}`}
                             autoFocus
                             type="number"
                             className="w-24 border-2 border-orange-500 rounded p-1 text-center font-bold text-orange-700"
                             value={tempVal}
                             onChange={(e) => setTempVal(parseFloat(e.target.value) || 0)}
                             onBlur={() => { setEditingIdx(null); setEditingField(null); }}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') updateCartItemValue(idx, 'price', tempVal);
                               if (e.key === 'Escape') { setEditingIdx(null); setEditingField(null); }
                             }}
                           />
                        ) : (
                           <button id={`btn_edit_price_${idx}`} name={`btn_edit_price_${idx}`} onClick={() => { setEditingIdx(idx); setEditingField('price'); setTempVal(price); }} className="font-black text-blue-600 hover:bg-blue-50 px-3 py-1 rounded transition-colors">
                              {currency}{price.toLocaleString()}
                           </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left font-bold text-slate-900">{currency}{total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center"><button id={`btn_remove_item_${idx}`} name={`btn_remove_item_${idx}`} onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-full xl:w-96 shrink-0 bg-white p-6 rounded-2xl shadow-card border border-slate-100 sticky top-6 space-y-4">
            <h3 className="font-bold text-slate-700 text-lg border-b pb-4">{t('inv.details')}</h3>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span>{t('inv.subtotal')}</span><span className="font-bold">{currency}{totals.subtotal.toFixed(2)}</span></div>
                <div className="space-y-3 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                        <label htmlFor="inv_customer_disc_percent" className="text-[10px] font-black text-slate-400 uppercase flex-1">خصم العميل (%)</label>
                        <div className="relative w-24">
                            <input id="inv_customer_disc_percent" disabled={!selectedCustomer} name="customer_discount_percent" type="number" className="w-full border border-slate-200 rounded-lg p-1.5 text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" value={additionalDiscountPercent} onChange={e => setAdditionalDiscountPercent(parseFloat(e.target.value) || 0)} />
                            <Percent className="absolute right-2 top-2 w-3 h-3 text-slate-300" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="inv_extra_disc_value" className="text-[10px] font-black text-slate-400 uppercase flex-1">{t('inv.additional_discount')} (مبلغ)</label>
                        <input id="inv_extra_disc_value" disabled={!selectedCustomer} name="extra_discount_value" type="number" className="w-24 border border-slate-200 rounded-lg p-1.5 text-center font-bold text-red-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" value={additionalDiscount} onChange={e => setAdditionalDiscount(parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
                <div className="flex justify-between text-red-500 font-bold border-t pt-2 mt-2"><span>إجمالي الخصم</span><span>-{currency}{totals.totalAdditionalDiscount.toFixed(2)}</span></div>
                <div className="flex justify-between text-2xl font-black border-t-2 border-slate-100 pt-3 mt-2"><span className="text-slate-800">{t('inv.net_total')}</span><span className="text-blue-600">{currency}{totals.net.toFixed(2)}</span></div>
                {selectedCustomer && (
                    <div className="flex justify-between items-center text-sm font-bold text-slate-500 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 mt-3 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5 text-amber-600" /><span>{t('inv.prev_balance')}</span></div>
                        <span className={liveCustomerBalance > 0 ? 'text-red-600' : liveCustomerBalance < 0 ? 'text-blue-600' : 'text-emerald-600'}>{currency}{liveCustomerBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <label htmlFor="inv_cash_paid_final" className="block text-sm font-bold text-slate-500 uppercase mb-1.5">{t('inv.cash_paid')}</label>
                  <input id="inv_cash_paid_final" disabled={!selectedCustomer} name="cash_paid" ref={cashRef} type="number" className="w-full border border-slate-200 rounded-xl p-3 text-xl font-black text-emerald-600 bg-emerald-50/30 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50" value={cashPayment} onChange={e => setCashPayment(parseFloat(e.target.value) || 0)} />
                </div>
                <button id="btn_save_print" name="btn_save_print" onClick={() => handleCheckout(true)} disabled={isSubmitting || cart.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"><Printer className="w-5 h-5" /> {t('inv.save_print')}</button>
                <button id="btn_finalize" name="btn_finalize" onClick={() => handleCheckout(false)} disabled={isSubmitting || cart.length === 0} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"><Save className="w-5 h-5" /> {t('inv.finalize')}</button>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 animate-in fade-in shake"><AlertCircle className="w-5 h-5" />{error}</div>}
        </div>
      </div>

      {showSettings && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-slate-50 p-5 border-b flex justify-between items-center"><h3 className="font-black text-slate-800">{t('inv.settings')}</h3><button id="btn_close_settings" name="btn_close_settings" onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button></div>
                  <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
                        <label htmlFor="set_manual_price" className="text-sm font-bold text-slate-700 flex-1 cursor-pointer">{t('inv.manual_price')}</label>
                        <input id="set_manual_price" name="setting_manual_price" type="checkbox" className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500 cursor-pointer" checked={invoiceConfig.enableManualPrice} onChange={e => setInvoiceConfig({...invoiceConfig, enableManualPrice: e.target.checked})} />
                      </div>
                      <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
                        <label htmlFor="set_discount_enabled" className="text-sm font-bold text-slate-700 flex-1 cursor-pointer">{t('inv.discount')}</label>
                        <input id="set_discount_enabled" name="setting_discount" type="checkbox" className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500 cursor-pointer" checked={invoiceConfig.enableDiscount} onChange={e => setInvoiceConfig({...invoiceConfig, enableDiscount: e.target.checked})} />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- Price Warning Persistent Modal --- */}
      {showPriceWarning && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-red-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border-4 border-red-500 animate-in zoom-in duration-300">
                  <div className="bg-red-500 p-8 text-center text-white">
                      <AlertTriangle className="w-16 h-16 mx-auto mb-4 animate-bounce" />
                      <h2 className="text-2xl font-black mb-2">تحذير: بيع بأقل من التكلفة!</h2>
                      <p className="text-red-100 font-bold">
                          سعر البيع المحدد ({manualPrice} {currency}) أقل من سعر التكلفة ({lastPurchasePrice} {currency}).
                      </p>
                  </div>
                  
                  <div className="p-8 space-y-6">
                      <div className="text-center space-y-2">
                          <p className="text-slate-600 font-bold">للمتابعة بهذا السعر، يرجى كتابة كلمة <span className="text-red-600 font-black underline">موافق</span> في الحقل أدناه:</p>
                          <input 
                            type="text" 
                            className="w-full border-2 border-slate-200 p-4 rounded-2xl text-center font-black text-xl focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition-all"
                            placeholder="اكتب موافق هنا..."
                            value={confirmationInput}
                            onChange={(e) => setConfirmationInput(e.target.value)}
                            autoFocus
                          />
                      </div>

                      <div className="flex gap-4">
                          <button 
                            onClick={() => setShowPriceWarning(false)} 
                            className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all"
                          >
                              تراجع (تعديل السعر)
                          </button>
                          <button 
                            onClick={proceedToAddItem}
                            disabled={confirmationInput !== 'موافق'}
                            className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-20 disabled:shadow-none"
                          >
                              تأكيد الإضافة
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
