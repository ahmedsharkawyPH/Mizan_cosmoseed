import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseOrder } from '../types';
import { Plus, Save, ArrowLeft, Trash2, ShoppingBag, FileText, Search, Clock, TrendingUp, Truck, Check, X, ClipboardCheck } from 'lucide-react';
import { useHistory } from 'react-router-dom';
import SearchableSelect, { SearchableSelectRef } from '../components/SearchableSelect';

export default function PurchaseOrders() {
  const history = useHistory();
  const currency = db.getSettings().currency;
  
  const [activeTab, setActiveTab] = useState<'NEW' | 'LIST'>('NEW');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  
  // New Order State
  const [suppliers] = useState(db.getSuppliers());
  const [products] = useState(db.getProductsWithBatches());
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  
  const [selProd, setSelProd] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0); // Estimated Cost
  
  const productRef = useRef<SearchableSelectRef>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrders(db.getPurchaseOrders());
  }, [activeTab]);

  useEffect(() => {
    if (selProd) {
      const p = products.find(x => x.id === selProd);
      if (p && p.batches.length > 0) {
        const lastBatch = p.batches[p.batches.length-1];
        setCost(lastBatch.purchase_price);
      }
    }
  }, [selProd, products]);

  const addItem = () => {
    if (!selProd || qty <= 0) return;
    const product = products.find(p => p.id === selProd);
    
    setCart([...cart, {
      product_id: selProd,
      productName: product?.name,
      quantity: qty,
      cost_price: cost,
    }]);

    setSelProd('');
    setQty(1);
    setCost(0);
    setTimeout(() => productRef.current?.focus(), 100);
  };

  const handleSaveOrder = async () => {
      if (!selectedSupplier || cart.length === 0) return;
      const res = await db.createPurchaseOrder(selectedSupplier, cart);
      if (res.success) {
          alert("Order created successfully");
          setCart([]);
          setSelectedSupplier('');
          setActiveTab('LIST');
      }
  };

  const handleStatusUpdate = async (id: string, newStatus: 'PENDING' | 'COMPLETED' | 'CANCELLED') => {
      await db.updatePurchaseOrderStatus(id, newStatus);
      setOrders(db.getPurchaseOrders());
  };

  const calculateTotal = (items: any[]) => items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-purple-600" />
            {t('stock.order')}
        </h1>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button 
                onClick={() => setActiveTab('NEW')}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'NEW' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Plus className="w-4 h-4" /> {t('pur.new_order')}
            </button>
            <button 
                onClick={() => setActiveTab('LIST')}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'LIST' ? 'bg-white text-slate-800 border border-slate-100 shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Clock className="w-4 h-4" /> {t('stock.order_history')}
            </button>
        </div>
      </div>

      {activeTab === 'NEW' && (
          <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in">
              <div className="flex-1 space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100">
                      <SearchableSelect 
                          label={t('pur.select_supplier')} 
                          placeholder="Search Supplier..." 
                          options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))} 
                          value={selectedSupplier} 
                          onChange={setSelectedSupplier} 
                          autoFocus 
                      />
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-6 text-purple-800 font-bold border-b pb-2">
                          <Plus className="w-5 h-5" /> {t('pur.add_to_order')}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-6">
                              <SearchableSelect ref={productRef} label={t('inv.product')} placeholder="Search..." options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.code }))} value={selProd} onChange={setSelProd} />
                          </div>
                          <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('stock.qty')}</label>
                              <input ref={qtyRef} type="number" className="w-full border p-2.5 rounded-lg font-bold text-center bg-slate-50 focus:bg-white transition-colors" value={qty} onChange={e => setQty(+e.target.value)} onKeyDown={e => e.key === 'Enter' && costRef.current?.focus()} />
                          </div>
                          <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('pur.cost')} (Est.)</label>
                              <input ref={costRef} type="number" className="w-full border p-2.5 rounded-lg text-center" value={cost} onChange={e => setCost(+e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
                          </div>
                          <div className="md:col-span-2">
                              <button onClick={addItem} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all">{t('inv.add_btn')}</button>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="w-full lg:w-96 shrink-0 bg-white p-6 rounded-2xl shadow-card border border-slate-100 h-fit">
                  <h3 className="font-bold text-slate-700 text-lg border-b pb-4 mb-4 flex items-center justify-between">
                      {t('pur.order_summary')}
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">{cart.length} items</span>
                  </h3>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto mb-6 pr-1">
                      {cart.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 group hover:border-purple-200 transition-colors">
                              <div>
                                  <div className="font-bold text-sm text-slate-800">{item.productName}</div>
                                  <div className="text-xs text-slate-500 mt-1">
                                      {item.quantity} x {currency}{item.cost_price}
                                  </div>
                              </div>
                              <div className="flex items-center gap-3">
                                  <span className="font-bold text-slate-700">{currency}{item.quantity * item.cost_price}</span>
                                  <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          </div>
                      ))}
                      {cart.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                              {t('inv.empty_cart')}
                          </div>
                      )}
                  </div>

                  <div className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-4">
                          <span className="text-slate-500 font-medium">Estimated Total</span>
                          <span className="text-2xl font-bold text-purple-700">{currency}{calculateTotal(cart).toLocaleString()}</span>
                      </div>
                      <button 
                          onClick={handleSaveOrder} 
                          disabled={cart.length === 0 || !selectedSupplier}
                          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                          <Save className="w-5 h-5" /> {t('pur.save_order_log')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'LIST' && (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden animate-in fade-in">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left rtl:text-right min-w-[800px]">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                          <tr>
                              <th className="px-6 py-4">{t('pur.invoice_no')}</th>
                              <th className="px-6 py-4">{t('common.date')}</th>
                              <th className="px-6 py-4">{t('inv.supplier')}</th>
                              <th className="px-6 py-4 text-center">{t('pur.items_count')}</th>
                              <th className="px-6 py-4 text-center">{t('list.status')}</th>
                              <th className="px-6 py-4 text-center">{t('common.action')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {orders.map(order => {
                              const supplierName = suppliers.find(s => s.id === order.supplier_id)?.name || 'Unknown';
                              return (
                                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-6 py-4 font-mono font-medium text-slate-600">{order.order_number}</td>
                                      <td className="px-6 py-4 text-slate-500">{new Date(order.date).toLocaleDateString()}</td>
                                      <td className="px-6 py-4 font-bold text-slate-800">{supplierName}</td>
                                      <td className="px-6 py-4 text-center">
                                          <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold">{order.items.length} items</span>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                              order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                              order.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-100' :
                                              'bg-amber-50 text-amber-700 border-amber-100'
                                          }`}>
                                              {order.status}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          {order.status === 'PENDING' && (
                                              <div className="flex justify-center gap-2">
                                                  <button 
                                                      onClick={() => handleStatusUpdate(order.id, 'COMPLETED')}
                                                      className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                                                      title="Mark Completed"
                                                  >
                                                      <Check className="w-4 h-4" />
                                                  </button>
                                                  <button 
                                                      onClick={() => handleStatusUpdate(order.id, 'CANCELLED')}
                                                      className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-