
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { Customer, ProductWithBatches, CartItem, BatchStatus } from '../types';
import { Plus, Trash2, Save, Search, AlertCircle, Calculator, Package, Users, ArrowLeft, ChevronDown, Printer, Settings as SettingsIcon, Check, X, Eye, RotateCcw, ShieldAlert, Lock, Percent, Info, Tag } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../utils/t';
import SearchableSelect, { SearchableSelectRef } from '../components/SearchableSelect';

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
  
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashPayment, setCashPayment] = useState<number>(0);
  const [additionalDiscount, setAdditionalDiscount] = useState<number>(0);
  const [additionalDiscountPercent, setAdditionalDiscountPercent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [showLastCost, setShowLastCost] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceSettings>(() => {
      const saved = localStorage.getItem('invoice_settings');
      return saved ? JSON.parse(saved) : { enableManualPrice: false, enableDiscount: true, showCostInfo: false };
  });

  const [overrideModal, setOverrideModal] = useState<{ isOpen: boolean; pendingItem: CartItem | null }>({ isOpen: false, pendingItem: null });

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
      if (selectedCustomer && !id) {
          const customer = customers.find(c => c.id === selectedCustomer);
          if (customer?.default_discount_percent) {
              setAdditionalDiscountPercent(customer.default_discount_percent);
          } else {
              setAdditionalDiscountPercent(0);
          }
      }
  }, [selectedCustomer, customers, id]);

  const currentProduct = useMemo(() => {
    return products.find(p => p.id === selectedProduct);
  }, [selectedProduct, products]);

  const availableBatch = useMemo(() => {
    if (!currentProduct || !selectedWarehouse) return null;
    return currentProduct.batches.find(b => b.warehouse_id === selectedWarehouse) || null;
  }, [currentProduct, selectedWarehouse]);

  const currentSellingPrice = useMemo(() => {
      if (availableBatch) return availableBatch.selling_price;
      if (currentProduct) return currentProduct.selling_price || 0;
      return 0;
  }, [availableBatch, currentProduct]);

  const lastPurchasePrice = useMemo(() => {
    if (!selectedProduct) return 0;
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
    return latestCost || (availableBatch?.purchase_price || currentProduct?.purchase_price || 0);
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

    const finalPrice = invoiceConfig.enableManualPrice ? manualPrice : currentSellingPrice;
    const finalDiscount = invoiceConfig.enableDiscount ? discount : 0;

    const newItem: CartItem = {
      product: currentProduct,
      batch: availableBatch || undefined,
      quantity: qty,
      bonus_quantity: bonus,
      discount_percentage: finalDiscount,
      unit_price: finalPrice
    };

    if (!isReturnMode && finalPrice * (1 - finalDiscount / 100) < lastPurchasePrice) {
        setOverrideModal({ isOpen: true, pendingItem: newItem });
        return;
    }

    finalizeAddItem(newItem);
  };

  const finalizeAddItem = (item: CartItem) => {
    setCart([...cart, item]);
    setSelectedProduct('');
    setQty(1);
    setBonus(0);
    setDiscount(0);
    setManualPrice(0);
    setShowLastCost(false);
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
      setError(t('inv.select_customer'));
      return;
    }
    setIsSubmitting(true);
    const user = authService.getCurrentUser();
    try {
      const result = id 
        ? await db.updateInvoice(id, selectedCustomer, cart, cashPayment)
        : await db.createInvoice(selectedCustomer, cart, cashPayment, isReturnMode, totals.totalAdditionalDiscount, user ? { id: user.id, name: user.name } : undefined);
      
      if (result.success) navigate('/invoices', result.id ? { state: { autoPrintId: result.id } } : undefined);
      else setError(result.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-500 hover:text-blue-600"><SettingsIcon className="w-5 h-5" /></button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 flex flex-col space-y-6 w-full">
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100">
             <SearchableSelect ref={customerRef} label={t('inv.customer')} placeholder={t('cust.search')} options={customers.map(c => ({ value: c.id, label: c.name, subLabel: c.phone }))} value={selectedCustomer} onChange={setSelectedCustomer} onComplete={() => productRef.current?.focus()} />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 relative">
            <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" /> {isReturnMode ? t('inv.add_return_item') : t('inv.add_product')}
                 </h3>
                 <select className="bg-slate-50 border border-slate-200 text-sm rounded-lg p-2 font-medium" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                 </select>
            </div>
            
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-9">
                <SearchableSelect ref={productRef} label={t('inv.product')} placeholder={t('cust.search')} options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.code }))} value={selectedProduct} onChange={setSelectedProduct} />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    {t('stock.total')}
                    {selectedProduct && (
                        <button 
                            type="button"
                            onClick={() => setShowLastCost(!showLastCost)}
                            className={`p-1 rounded-full transition-colors ${showLastCost ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}
                            title="آخر سعر شراء"
                        >
                            <Info className="w-3.5 h-3.5" />
                        </button>
                    )}
                </label>
                <div className="relative">
                    <div className="w-full bg-slate-50 border rounded-lg p-2.5 font-bold text-slate-800 flex justify-between items-center min-h-[45px]">
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
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.price')}</label>
                    <input ref={priceRef} type="number" className="w-full bg-white border border-orange-300 text-orange-700 rounded-lg p-2.5 font-bold" value={manualPrice} onChange={e => setManualPrice(parseFloat(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && qtyRef.current?.focus()} />
                  </div>
              )}
              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.qty')}</label>
                <input ref={qtyRef} type="number" className="w-full bg-slate-50 border rounded-lg p-2.5 text-center font-bold" value={qty} onChange={e => setQty(parseInt(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && bonusRef.current?.focus()} />
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.bonus')}</label>
                <input ref={bonusRef} type="number" className="w-full bg-slate-50 border rounded-lg p-2.5 text-center" value={bonus} onChange={e => setBonus(parseInt(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && (invoiceConfig.enableDiscount ? discountRef.current?.focus() : addItemToCart())} />
              </div>
              {invoiceConfig.enableDiscount && (
               <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.disc_percent')}</label>
                <input ref={discountRef} type="number" className="w-full bg-slate-50 border rounded-lg p-2.5 text-center text-red-500 font-bold" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} onKeyDown={e => e.key === 'Enter' && addItemToCart()} />
              </div>
              )}
              <div className="col-span-12 md:col-span-3 flex items-end">
                  <button onClick={addItemToCart} disabled={!selectedProduct} className="w-full h-[45px] bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all flex items-center justify-center">
                    <Plus className="w-5 h-5 mr-2" /> {t('inv.add_btn')}
                  </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex-1">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">{t('inv.product')}</th>
                  <th className="px-4 py-3 text-center">{t('inv.qty')}</th>
                  <th className="px-4 py-3 text-center">{t('inv.price')}</th>
                  <th className="px-4 py-3 text-right">{t('inv.total')}</th>
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
                      <td className="px-4 py-3 font-medium text-slate-800">{item.product.name}</td>
                      <td className="px-4 py-3 text-center font-bold">{item.quantity}{item.bonus_quantity > 0 && <span className="text-xs text-green-600 ml-1">+{item.bonus_quantity}</span>}</td>
                      <td className="px-4 py-3 text-center">{currency}{price}</td>
                      <td className="px-4 py-3 text-right font-bold">{currency}{total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center"><button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-full xl:w-96 shrink-0 bg-white p-6 rounded-2xl shadow-card border border-slate-100 sticky top-6 space-y-4">
            <h3 className="font-bold text-slate-700 text-lg border-b pb-4">{t('inv.details')}</h3>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>{t('inv.subtotal')}</span><span className="font-bold">{currency}{totals.subtotal.toFixed(2)}</span></div>
                
                <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex-1">خصم العميل (%)</label>
                        <div className="relative w-24">
                            <input 
                                type="number" 
                                className="w-full border rounded-lg p-1.5 text-center font-bold text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none" 
                                value={additionalDiscountPercent} 
                                onChange={e => setAdditionalDiscountPercent(parseFloat(e.target.value) || 0)} 
                            />
                            <Percent className="absolute right-2 top-2 w-3 h-3 text-slate-400" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex-1">{t('inv.additional_discount')} (مبلغ)</label>
                        <input 
                            type="number" 
                            className="w-24 border rounded-lg p-1.5 text-center font-bold text-red-600 focus:ring-1 focus:ring-blue-500 outline-none" 
                            value={additionalDiscount} 
                            onChange={e => setAdditionalDiscount(parseFloat(e.target.value) || 0)} 
                        />
                    </div>
                </div>

                <div className="flex justify-between text-red-500 font-bold border-t pt-2 mt-2">
                    <span>إجمالي الخصم</span>
                    <span>-{currency}{totals.totalAdditionalDiscount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-xl font-bold border-t-2 border-slate-100 pt-2 mt-2">
                    <span>{t('inv.net_total')}</span>
                    <span className="text-blue-600">{currency}{totals.net.toFixed(2)}</span>
                </div>
            </div>

            <div className="space-y-4 pt-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.cash_paid')}</label><input ref={cashRef} type="number" className="w-full border rounded-lg p-2.5 text-lg font-bold text-emerald-600" value={cashPayment} onChange={e => setCashPayment(parseFloat(e.target.value) || 0)} /></div>
                <button onClick={() => { handleCheckout(true); }} disabled={isSubmitting || cart.length === 0} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Printer className="w-5 h-5" /> {t('inv.save_print')}</button>
                <button onClick={() => { handleCheckout(false); }} disabled={isSubmitting || cart.length === 0} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Save className="w-5 h-5" /> {t('inv.finalize')}</button>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        </div>
      </div>

      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center"><h3 className="font-bold">{t('inv.settings')}</h3><button onClick={() => setShowSettings(false)}><X className="w-5 h-5" /></button></div>
                  <div className="p-4 space-y-3">
                      <label className="flex items-center justify-between p-3 border rounded-xl"><span className="text-sm">{t('inv.manual_price')}</span><input type="checkbox" checked={invoiceConfig.enableManualPrice} onChange={e => setInvoiceConfig({...invoiceConfig, enableManualPrice: e.target.checked})} /></label>
                      <label className="flex items-center justify-between p-3 border rounded-xl"><span className="text-sm">{t('inv.discount')}</span><input type="checkbox" checked={invoiceConfig.enableDiscount} onChange={e => setInvoiceConfig({...invoiceConfig, enableDiscount: e.target.checked})} /></label>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
