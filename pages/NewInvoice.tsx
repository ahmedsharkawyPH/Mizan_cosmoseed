
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { Customer, ProductWithBatches, CartItem, BatchStatus } from '../types';
import { Plus, Trash2, Save, Search, AlertCircle, Calculator, Package, Users, ArrowLeft, ChevronDown, Printer, Settings as SettingsIcon, Check, X, Eye, RotateCcw, ShieldAlert, Lock, Percent } from 'lucide-react';
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
  
  // Return Mode State
  const [isReturnMode, setIsReturnMode] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceSettings>(() => {
      const saved = localStorage.getItem('invoice_settings');
      return saved ? JSON.parse(saved) : { enableManualPrice: false, enableDiscount: true, showCostInfo: false };
  });

  // Admin Override Modal State
  const [overrideModal, setOverrideModal] = useState<{ isOpen: boolean; pendingItem: CartItem | null }>({ isOpen: false, pendingItem: null });
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Save settings when changed
  useEffect(() => {
      localStorage.setItem('invoice_settings', JSON.stringify(invoiceConfig));
  }, [invoiceConfig]);

  // Grid Column Calculation for Inputs Row
  const colSpans = useMemo(() => {
      const manual = invoiceConfig.enableManualPrice;
      const discount = invoiceConfig.enableDiscount;
      if (manual && discount) return { price: 'md:col-span-3', qty: 'md:col-span-2', bonus: 'md:col-span-2', disc: 'md:col-span-2', btn: 'md:col-span-3' };
      if (!manual && discount) return { price: '', qty: 'md:col-span-3', bonus: 'md:col-span-3', disc: 'md:col-span-3', btn: 'md:col-span-3' };
      if (manual && !discount) return { price: 'md:col-span-3', qty: 'md:col-span-3', bonus: 'md:col-span-3', disc: '', btn: 'md:col-span-3' };
      return { price: '', qty: 'md:col-span-4', bonus: 'md:col-span-4', disc: '', btn: 'md:col-span-4' };
  }, [invoiceConfig]);

  // Form states for adding item
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [bonus, setBonus] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [manualPrice, setManualPrice] = useState<number>(0);

  // Refs for Focus Management
  const customerRef = useRef<SearchableSelectRef>(null);
  const productRef = useRef<SearchableSelectRef>(null);
  const batchRef = useRef<HTMLSelectElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const bonusRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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
        if (invoice.items) {
           setCart(invoice.items);
        }
        if (invoice.type === 'RETURN') {
            setIsReturnMode(true);
        }
        // Load existing discount
        if (invoice.additional_discount) setAdditionalDiscount(invoice.additional_discount);
      }
    } else {
        setTimeout(() => {
            customerRef.current?.focus();
        }, 100);
    }
  }, [id]);

  // Auto-set discount percent when customer selected
  useEffect(() => {
      if (selectedCustomer && !id) {
          const cust = customers.find(c => c.id === selectedCustomer);
          if (cust && cust.default_discount_percent) {
              setAdditionalDiscountPercent(cust.default_discount_percent);
          } else {
              setAdditionalDiscountPercent(0);
          }
      }
  }, [selectedCustomer, customers, id]);

  // Auto focus password input when modal opens
  useEffect(() => {
      if (overrideModal.isOpen) {
          setTimeout(() => passwordRef.current?.focus(), 100);
      }
  }, [overrideModal.isOpen]);

  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if (e.key === '+' || e.key === 'Add') {
              e.preventDefault();
              productRef.current?.focus();
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const availableBatches = useMemo(() => {
    if (!selectedProduct || !selectedWarehouse) return [];
    const prod = products.find(p => p.id === selectedProduct);
    if (!prod) return [];
    return prod.batches.filter(b => {
      const isExpired = new Date(b.expiry_date) < new Date();
      // If Return Mode, we allow selecting any batch even if 0 qty (to return to it)
      return b.warehouse_id === selectedWarehouse && (isReturnMode || b.quantity > 0) && !isExpired && b.status === BatchStatus.ACTIVE;
    });
  }, [selectedProduct, selectedWarehouse, products, isReturnMode]);

  useEffect(() => {
      if (availableBatches.length > 0 && !selectedBatch) {
          if(availableBatches.length === 1) {
              setSelectedBatch(availableBatches[0].id);
              setManualPrice(availableBatches[0].selling_price);
              
              setTimeout(() => {
                  if (invoiceConfig.enableManualPrice) {
                      priceRef.current?.focus();
                      priceRef.current?.select();
                  } else {
                      qtyRef.current?.focus();
                      qtyRef.current?.select();
                  }
              }, 50);
          } else {
              batchRef.current?.focus();
          }
      }
  }, [availableBatches, selectedBatch, invoiceConfig.enableManualPrice]);

  const activeProduct = products.find(p => p.id === selectedProduct);
  const activeBatch = availableBatches.find(b => b.id === selectedBatch);

  const handleBatchChange = (batchId: string) => {
      setSelectedBatch(batchId);
      const b = availableBatches.find(x => x.id === batchId);
      if (b) setManualPrice(b.selling_price);
  };

  const addItemToCart = () => {
    if (!activeProduct || !activeBatch) return;
    
    const totalQty = qty + bonus;
    if (!isReturnMode && totalQty > activeBatch.quantity) {
      alert(`${t('inv.insufficient_stock')}! ${t('stock.total')}: ${activeBatch.quantity}`);
      return;
    }

    const finalPrice = invoiceConfig.enableManualPrice ? manualPrice : activeBatch.selling_price;
    const finalDiscount = invoiceConfig.enableDiscount ? discount : 0;

    const newItem: CartItem = {
      product: activeProduct,
      batch: activeBatch,
      quantity: qty,
      bonus_quantity: bonus,
      discount_percentage: finalDiscount,
      unit_price: finalPrice
    };

    if (!isReturnMode) {
        const netPrice = finalPrice * (1 - finalDiscount / 100);
        const costPrice = activeBatch.purchase_price;

        if (netPrice < costPrice) {
            setOverrideModal({ isOpen: true, pendingItem: newItem });
            setAdminPassword('');
            setPasswordError('');
            return; 
        }
    }

    finalizeAddItem(newItem);
  };

  const handleOverrideSubmit = () => {
      if (authService.verifyAdminPassword(adminPassword)) {
          if (overrideModal.pendingItem) {
              finalizeAddItem(overrideModal.pendingItem);
              setOverrideModal({ isOpen: false, pendingItem: null });
          }
      } else {
          setPasswordError(t('inv.wrong_pass'));
      }
  };

  const finalizeAddItem = (item: CartItem) => {
    setCart([...cart, item]);
    
    // Reset item form
    setSelectedProduct('');
    setSelectedBatch('');
    setQty(1);
    setBonus(0);
    setDiscount(0);
    setManualPrice(0);

    setTimeout(() => {
        productRef.current?.focus();
    }, 50);
  };

  const removeItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const totals = useMemo(() => {
    let totalGross = 0;
    let totalItemDiscount = 0;
    cart.forEach(item => {
      const price = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
      const gross = item.quantity * price;
      const disc = gross * (item.discount_percentage / 100);
      totalGross += gross;
      totalItemDiscount += disc;
    });
    
    const subtotal = totalGross - totalItemDiscount;
    
    // Calculate additional discount amount based on percent IF subtotal exists
    // We prioritize the percentage if it's set
    let finalAdditionalDiscount = additionalDiscount;
    if (additionalDiscountPercent > 0) {
        // If percentage is set, it drives the amount calculation
        // But we handle this reactively in useEffect below to sync state
    }

    const net = subtotal - additionalDiscount;

    return {
      gross: totalGross,
      itemDiscount: totalItemDiscount,
      subtotal,
      net: net > 0 ? net : 0
    };
  }, [cart, additionalDiscount, additionalDiscountPercent]); // Re-calc when cart changes

  // SYNC DISCOUNT PERCENT AND AMOUNT
  // Update Amount when Percent changes or Subtotal changes (if percent exists)
  useEffect(() => {
      let subtotal = 0;
      cart.forEach(item => {
          const price = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
          const gross = item.quantity * price;
          subtotal += (gross - (gross * (item.discount_percentage / 100)));
      });

      if (additionalDiscountPercent > 0) {
          const newAmount = subtotal * (additionalDiscountPercent / 100);
          if (Math.abs(newAmount - additionalDiscount) > 0.01) { // Avoid infinite loop
              setAdditionalDiscount(Number(newAmount.toFixed(2)));
          }
      } else if (additionalDiscountPercent === 0 && additionalDiscount === 0) {
          // Both zero, do nothing
      }
  }, [additionalDiscountPercent, cart]); // Trigger on percent change or cart change

  // Handler for manual amount change
  const handleAmountChange = (val: number) => {
      setAdditionalDiscount(val);
      if (totals.subtotal > 0) {
          const percent = (val / totals.subtotal) * 100;
          setAdditionalDiscountPercent(Number(percent.toFixed(2)));
      } else {
          setAdditionalDiscountPercent(0);
      }
  };

  const handleCheckout = async (print: boolean = false) => {
    if (!selectedCustomer) {
      setError(t('inv.select_customer'));
      customerRef.current?.focus();
      return;
    }
    if (cart.length === 0) {
      setError(t('inv.empty_cart'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    // Get Current User Info
    const user = authService.getCurrentUser();

    try {
      await new Promise(r => setTimeout(r, 600)); 
      let result;
      if (id) {
        result = await db.updateInvoice(id, selectedCustomer, cart, cashPayment);
      } else {
        result = await db.createInvoice(
            selectedCustomer, 
            cart, 
            cashPayment, 
            isReturnMode, 
            additionalDiscount,
            user ? { id: user.id, name: user.name } : undefined // PASS CREATOR
        );
      }
      
      if (result.success) {
        if (print && result.id) {
            navigate('/invoices', { state: { autoPrintId: result.id } });
        } else {
            navigate('/invoices');
        }
      } else {
        setError(result.message);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabToCash = (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
          e.preventDefault();
          cashRef.current?.focus();
          cashRef.current?.select();
      }
  };

  const customerOptions = customers.map(c => ({
      value: c.id,
      label: c.name,
      subLabel: `${c.phone}`
  }));

  const productOptions = products.map(p => {
      const stock = p.batches.reduce((a,b) => a+b.quantity, 0);
      return {
        value: p.id,
        label: p.name,
        subLabel: `${p.code} | Stock: ${stock}`
      };
  });

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1600px] mx-auto pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate('/invoices')} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
             </button>
             <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                 {id ? `${t('inv.update')} #${db.getInvoices().find(i => i.id === id)?.invoice_number}` : t('nav.new_invoice')}
                 {isReturnMode && <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-bold border border-red-200">{t('inv.return_mode')}</span>}
             </h1>
          </div>
          
          <div className="flex items-center gap-3">
              {!id && (
                  <button 
                    onClick={() => { setIsReturnMode(!isReturnMode); setCart([]); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border
                    ${isReturnMode ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                      <RotateCcw className="w-4 h-4" />
                      {isReturnMode ? t('inv.returns_active') : t('inv.sales_return')}
                  </button>
              )}

              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
              >
                  <SettingsIcon className="w-5 h-5" />
              </button>

              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                   <span className="text-xs font-bold text-slate-500 uppercase">{t('inv.total_items')}</span>
                   <span className="text-lg font-bold text-blue-600">{cart.length}</span>
              </div>
          </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 h-full items-start">
        
        {/* LEFT: Item Selection & Cart */}
        <div className="flex-1 flex flex-col space-y-6 w-full">
          
          {/* 1. Customer Selection Card */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100">
             <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs font-bold uppercase">
                 <Users className="w-4 h-4" />
                 {t('inv.customer')}
             </div>
             <SearchableSelect
                ref={customerRef}
                placeholder={t('cust.search')}
                options={customerOptions}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                autoFocus={!id}
                onComplete={() => productRef.current?.focus()}
             />
          </div>

          {/* 2. Item Adder Panel - Updated Grid Layout */}
          <div className={`bg-white p-6 rounded-2xl shadow-card border relative transition-colors ${isReturnMode ? 'border-red-100' : 'border-slate-100'}`}>
             <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full rounded-tr-2xl pointer-events-none ${isReturnMode ? 'bg-red-50' : 'bg-blue-50'}`}></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isReturnMode ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isReturnMode ? <RotateCcw className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    {isReturnMode ? t('inv.add_return_item') : t('inv.add_product')}
                 </h3>
                 <div className="relative">
                     <select 
                        className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8 font-medium cursor-pointer hover:bg-slate-100 transition-colors"
                        value={selectedWarehouse}
                        onChange={e => { setSelectedWarehouse(e.target.value); setSelectedBatch(''); }}
                      >
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                 </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 relative z-10">
              
              {/* Row 1: Product & Batch */}
              <div className="col-span-12 md:col-span-7">
                <SearchableSelect
                    ref={productRef}
                    label={t('inv.product')}
                    placeholder={t('cust.search')}
                    options={productOptions}
                    value={selectedProduct}
                    onChange={(val) => { setSelectedProduct(val); setSelectedBatch(''); }}
                />
              </div>

              <div className="col-span-12 md:col-span-5">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.batch')}</label>
                <select 
                  ref={batchRef}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
                  value={selectedBatch}
                  onChange={e => handleBatchChange(e.target.value)}
                  disabled={!selectedProduct}
                  onKeyDown={(e) => {
                      if(e.key === 'Enter') { 
                          e.preventDefault(); 
                          if(invoiceConfig.enableManualPrice) priceRef.current?.focus();
                          else qtyRef.current?.focus(); 
                      }
                  }}
                >
                  <option value="">{t('inv.select_batch')}</option>
                  {availableBatches.map(b => (
                    <option key={b.id} value={b.id}>
                    {b.batch_number} (Exp: {b.expiry_date.split('T')[0]})
                    </option>
                  ))}
                </select>
                {activeBatch && (
                    <div className="text-[10px] mt-1 text-slate-500 px-1">
                        <div className="flex justify-between items-center">
                            <span>Qty: <b>{activeBatch.quantity}</b></span>
                            {!invoiceConfig.enableManualPrice && !invoiceConfig.showCostInfo && (
                                <span>Price: <b>{currency}{activeBatch.selling_price}</b></span>
                            )}
                        </div>
                        {(invoiceConfig.enableManualPrice || invoiceConfig.showCostInfo) && (
                            <div className="flex flex-col border-t border-slate-100 mt-1 pt-1 gap-0.5 animate-in fade-in">
                                <div className="flex justify-between text-slate-400">
                                    <span>Public:</span>
                                    <span className={invoiceConfig.showCostInfo ? "line-through decoration-slate-400" : ""}>{currency}{activeBatch.selling_price}</span>
                                </div>
                                <div className="flex justify-between text-red-600 font-bold bg-red-50 px-1 rounded">
                                    <span>{t('pur.cost')}:</span>
                                    <span>{currency}{activeBatch.purchase_price}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
              </div>

              {/* Row 2: Inputs */}
              
              {invoiceConfig.enableManualPrice && (
                  <div className={`col-span-6 ${colSpans.price}`}>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        {invoiceConfig.showCostInfo ? t('inv.manual_price') : t('inv.price')}
                    </label>
                    <input 
                      ref={priceRef} type="number" min="0"
                      className="w-full bg-white border border-orange-300 text-orange-700 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 p-2.5 font-bold"
                      value={manualPrice}
                      onChange={e => setManualPrice(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                              e.preventDefault();
                              qtyRef.current?.focus();
                              qtyRef.current?.select();
                          } else {
                              handleTabToCash(e);
                          }
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                    {activeBatch && manualPrice < activeBatch.selling_price && manualPrice > 0 && (
                        <div className="text-[10px] text-emerald-600 mt-1 text-right font-medium">
                            {t('inv.save_off_public').replace('{percent}', ((1 - manualPrice/activeBatch.selling_price)*100).toFixed(0))}
                        </div>
                    )}
                  </div>
              )}

              <div className={`col-span-6 ${colSpans.qty}`}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.qty')}</label>
                <input 
                  ref={qtyRef} type="number" min="1"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 text-center font-bold"
                  value={qty}
                  onChange={e => setQty(parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === 'Enter' ? (e.preventDefault(), bonusRef.current?.focus(), bonusRef.current?.select()) : handleTabToCash(e)}
                  onFocus={(e) => e.target.select()}
                />
                {activeProduct && activeProduct.package_type && activeProduct.items_per_package && (
                    <div className="text-[10px] text-blue-600 mt-1 text-center font-bold bg-blue-50 rounded px-1 border border-blue-100">
                        {activeProduct.package_type} = {activeProduct.items_per_package} pcs
                    </div>
                )}
              </div>
              <div className={`col-span-6 ${colSpans.bonus}`}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.bonus')}</label>
                <input 
                  ref={bonusRef} type="number" min="0"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 text-center"
                  value={bonus}
                  onChange={e => setBonus(parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          e.preventDefault();
                          if (invoiceConfig.enableDiscount) {
                              discountRef.current?.focus();
                              discountRef.current?.select();
                          } else {
                              addItemToCart();
                          }
                      } else {
                          handleTabToCash(e);
                      }
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              
              {invoiceConfig.enableDiscount && (
               <div className={`col-span-6 ${colSpans.disc}`}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.disc_percent')}</label>
                <input 
                  ref={discountRef} type="number" min="0" max="100"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 text-center text-red-500"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === 'Enter' ? (e.preventDefault(), addItemToCart()) : handleTabToCash(e)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              )}

              <div className={`col-span-12 ${colSpans.btn} flex items-end`}>
                  <button 
                    onClick={addItemToCart}
                    disabled={!selectedBatch || qty <= 0}
                    className={`w-full h-[42px] text-white rounded-lg flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95
                    ${isReturnMode ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    title="Add to Cart (Enter)"
                   >
                     {isReturnMode ? <RotateCcw className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                   </button>
              </div>
            </div>
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">{t('inv.product')}</th>
                    <th className="px-4 py-3">{t('stock.batch')}</th>
                    <th className="px-4 py-3 text-center">{t('inv.qty')}</th>
                    <th className="px-4 py-3 text-center">{t('inv.price')}</th>
                    <th className="px-4 py-3 text-center">{t('inv.discount')}</th>
                    <th className="px-4 py-3 text-right rtl:text-left">{t('inv.total')}</th>
                    <th className="px-4 py-3 text-center">{t('inv.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.map((item, idx) => {
                    const price = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
                    const gross = item.quantity * price;
                    const val = gross - (gross * (item.discount_percentage / 100));
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.product.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.batch.batch_number}</td>
                        <td className="px-4 py-3 text-center">
                            <span className="font-bold">{item.quantity}</span>
                            {item.bonus_quantity > 0 && <span className="text-[10px] text-green-600 block">+{item.bonus_quantity} Bonus</span>}
                        </td>
                        <td className="px-4 py-3 text-center">{currency}{price}</td>
                        <td className="px-4 py-3 text-center text-red-500">{item.discount_percentage > 0 ? `${item.discount_percentage}%` : '-'}</td>
                        <td className="px-4 py-3 text-right rtl:text-left font-bold text-slate-900">{currency}{val.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {cart.length === 0 && (
                      <tr>
                          <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                              {t('inv.empty_cart')}
                          </td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Summary & Checkout */}
        <div className="w-full xl:w-96 flex flex-col gap-6 shrink-0">
            <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 flex flex-col gap-4 sticky top-6">
                <h3 className="font-bold text-slate-700 text-lg border-b pb-4 mb-2">{t('inv.details')}</h3>
                
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                        <span>{t('inv.subtotal')}</span>
                        <span className="font-bold text-slate-800">{currency}{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {additionalDiscount > 0 && (
                        <div className="flex justify-between text-red-500">
                            <span>{t('inv.additional_discount')} ({additionalDiscountPercent}%)</span>
                            <span className="font-bold">-{currency}{additionalDiscount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200">
                        <span className="text-lg font-bold text-slate-800">{t('inv.net_total')}</span>
                        <span className="text-2xl font-bold text-blue-600">{currency}{totals.net.toFixed(2)}</span>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100 mt-2">
                    {/* Additional Discount Input (Percent & Amount) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.additional_discount')}</label>
                        <div className="flex gap-2">
                            <div className="w-20 relative">
                                <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-red-600 font-bold focus:ring-2 focus:ring-red-200 outline-none text-center"
                                    value={additionalDiscountPercent}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setAdditionalDiscountPercent(val);
                                        // Amount will update via useEffect
                                    }}
                                    placeholder="%"
                                />
                                <span className="absolute right-1 top-2 text-xs text-gray-400 font-bold pointer-events-none">%</span>
                            </div>
                            <div className="flex-1">
                                <input 
                                    type="number" 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-red-600 font-bold focus:ring-2 focus:ring-red-200 outline-none"
                                    value={additionalDiscount}
                                    onChange={e => handleAmountChange(parseFloat(e.target.value) || 0)}
                                    placeholder="Amount"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.cash_paid')}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">$</span>
                            <input 
                                ref={cashRef}
                                type="number" 
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 pl-8 text-lg font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none"
                                value={cashPayment}
                                onChange={e => setCashPayment(parseFloat(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    </div>
                    
                    {selectedCustomer && (
                        <div className="pt-2 border-t border-slate-200">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>{t('inv.prev_balance')}</span>
                                <span>{currency}{customers.find(c => c.id === selectedCustomer)?.current_balance.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-slate-700">
                                <span>{t('inv.new_balance')}</span>
                                <span>
                                    {currency}{((customers.find(c => c.id === selectedCustomer)?.current_balance || 0) + (isReturnMode ? -(totals.net - cashPayment) : (totals.net - cashPayment))).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={() => handleCheckout(true)}
                    disabled={isSubmitting || !selectedCustomer || cart.length === 0}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Printer className="w-5 h-5" />
                    {isSubmitting ? t('inv.processing') : t('inv.save_print')}
                </button>
                
                <button 
                    onClick={() => handleCheckout(false)}
                    disabled={isSubmitting || !selectedCustomer || cart.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="w-5 h-5" />
                    {t('inv.finalize')}
                </button>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Admin Override Modal */}
      {overrideModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                      <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{t('inv.security_warning')}</h3>
                  <p className="text-sm text-gray-500 mb-6">{t('inv.below_cost_desc')}</p>
                  
                  {overrideModal.pendingItem && (
                      <div className="bg-slate-50 p-3 rounded-lg mb-4 text-sm text-left border border-slate-200">
                          <div className="font-bold text-slate-700">{overrideModal.pendingItem.product.name}</div>
                          <div className="flex justify-between mt-1">
                              <span>{t('pur.cost')}: {currency}{overrideModal.pendingItem.batch.purchase_price}</span>
                              <span className="text-red-600 font-bold">{t('inv.selling_net')}: {currency}{(overrideModal.pendingItem.unit_price || 0) * (1 - overrideModal.pendingItem.discount_percentage/100)}</span>
                          </div>
                      </div>
                  )}

                  <div className="relative mb-4">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input 
                        ref={passwordRef}
                        type="password" 
                        className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-red-500 outline-none"
                        placeholder={t('inv.admin_pass_prompt')}
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleOverrideSubmit()}
                      />
                  </div>
                  {passwordError && <p className="text-xs text-red-500 mb-4 font-bold">{passwordError}</p>}

                  <div className="flex gap-2">
                      <button onClick={() => setOverrideModal({isOpen: false, pendingItem: null})} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                          {t('common.cancel')}
                      </button>
                      <button onClick={handleOverrideSubmit} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-colors">
                          {t('inv.approve')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">{t('inv.settings')}</h3>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-4 space-y-3">
                      {/* Toggle: Enable Manual Price */}
                      <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                          <span className="text-sm font-medium text-slate-700">{t('inv.manual_price')}</span>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                            checked={invoiceConfig.enableManualPrice}
                            onChange={e => setInvoiceConfig({...invoiceConfig, enableManualPrice: e.target.checked})}
                          />
                      </label>

                      {/* Toggle: Enable Discount */}
                      <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                          <span className="text-sm font-medium text-slate-700">{t('inv.discount')}</span>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                            checked={invoiceConfig.enableDiscount}
                            onChange={e => setInvoiceConfig({...invoiceConfig, enableDiscount: e.target.checked})}
                          />
                      </label>

                      {/* Toggle: Show Cost/Public Info (Profit View) */}
                      <label className="flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                          <span className="text-sm font-medium text-slate-700">{t('inv.profit_view')}</span>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                            checked={invoiceConfig.showCostInfo}
                            onChange={e => setInvoiceConfig({...invoiceConfig, showCostInfo: e.target.checked})}
                          />
                      </label>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
