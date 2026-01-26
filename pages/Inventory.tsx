import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Brain, Sparkles,
  Command, Hash, Tag, DollarSign, Percent, Star, PlusCircle,
  FileSpreadsheet, Loader2, Download, Upload, FileOutput, TrendingUp, AlertCircle, RefreshCw, Wifi, WifiOff, Award, Save, PackagePlus,
  Edit, Trash2, FileText, ChevronRight, LayoutList, History, ArrowRightLeft, Warehouse as WarehouseIcon, EyeOff
} from 'lucide-react';
import { exportFilteredProductsToExcel, readExcelFile, downloadInventoryTemplate } from '../utils/excel';
// @ts-ignore
import toast from 'react-hot-toast';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbFullLoaded, setDbFullLoaded] = useState(db.isFullyLoaded);
  const [isOffline, setIsOffline] = useState(db.isOffline);
  
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [hideZeroStock, setHideZeroStock] = useState(false);

  const [isIEOpen, setIsIEOpen] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });

  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [selectedCardProduct, setSelectedCardProduct] = useState<any>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const settings = db.getSettings();
  const warehouses = db.getWarehouses();
  const currency = settings.currency;

  const loadProducts = useCallback(async () => {
    const all = db.getProductsWithBatches();
    setProducts(all || []);
    setDbFullLoaded(db.isFullyLoaded);
    setIsOffline(db.isOffline);
  }, []);

  useEffect(() => {
    loadProducts();
    const checkLoad = setInterval(() => {
        if (db.isFullyLoaded !== dbFullLoaded || db.isOffline !== isOffline) loadProducts();
    }, 3000);
    return () => clearInterval(checkLoad);
  }, [loadProducts, dbFullLoaded, isOffline]);

  const bestSuppliersMap = useMemo(() => {
    const purchaseInvoices = db.getPurchaseInvoices() || [];
    const suppliers = db.getSuppliers() || [];
    const map: Record<string, string> = {};
    const bestPrices: Record<string, number> = {};
    purchaseInvoices.forEach(inv => {
      if (inv.type === 'PURCHASE') {
        const supplier = suppliers.find(s => s.id === inv.supplier_id);
        inv.items.forEach(item => {
          if (!bestPrices[item.product_id] || item.cost_price < bestPrices[item.product_id]) {
            bestPrices[item.product_id] = item.cost_price;
            map[item.product_id] = supplier?.name || '---';
          }
        });
      }
    });
    return map;
  }, [products]);

  const displayedProducts = useMemo(() => {
    if (!products) return [];
    let results = [...products];

    if (selectedWarehouseFilter !== 'ALL') {
        results = results.filter(p => p.batches?.some((b: any) => b.warehouse_id === selectedWarehouseFilter));
    }

    if (hideZeroStock) {
        results = results.filter(p => {
            const qty = selectedWarehouseFilter === 'ALL' 
                ? (p.batches?.reduce((s: number, b: any) => s + b.quantity, 0) || 0)
                : (p.batches?.find((b: any) => b.warehouse_id === selectedWarehouseFilter)?.quantity || 0);
            return qty > 0;
        });
    }

    if (searchQuery.trim()) {
        results = ArabicSmartSearch.smartSearch(results, searchQuery);
    }

    if (showLowStock) {
        const threshold = settings.lowStockThreshold || 10;
        results = results.filter(p => {
            const total = p.batches?.reduce((sum: any, b: any) => sum + b.quantity, 0) || 0;
            return total > 0 && total <= threshold;
        });
    }
    if (showOutOfStock) {
        results = results.filter(p => (p.batches?.reduce((sum: any, b: any) => sum + b.quantity, 0) || 0) === 0);
    }

    return results;
  }, [products, searchQuery, selectedWarehouseFilter, hideZeroStock, showLowStock, showOutOfStock, settings.lowStockThreshold]);

  const handleSaveProduct = async () => {
      if (!quickAddForm.name) return toast.error("اسم الصنف مطلوب");
      
      const pData = { name: quickAddForm.name, code: quickAddForm.code };
      const bData = { 
          quantity: quickAddForm.initial_qty, 
          purchase_price: quickAddForm.purchase_price, 
          selling_price: quickAddForm.selling_price,
          warehouse_id: quickAddForm.warehouse_id || warehouses[0]?.id
      };

      await db.addProduct(pData, bData);
      toast.success("تم حفظ الصنف بنجاح");
      setIsAddModalOpen(false);
      setQuickAddForm({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });
      loadProducts();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div><h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><Package className="w-8 h-8 text-blue-600" /> {t('stock.title')}</h1></div>
           <div className="flex flex-wrap gap-2">
             <button id="btn_import_export" name="btn_import_export" onClick={() => setIsIEOpen(true)} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all"><FileSpreadsheet className="w-5 h-5" /> استيراد وتصدير</button>
             <button id="btn_new_product" name="btn_new_product" onClick={() => { setEditingProduct(null); setIsAddModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><PlusCircle className="w-5 h-5" /> {t('stock.new')}</button>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
          <div className="relative group mb-4">
              <label htmlFor="inventory_main_search" className="sr-only">بحث في المخزون</label>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none"><Search className="h-6 w-6 text-slate-400" /></div>
              <input 
                id="inventory_main_search" 
                name="inventory_search" 
                ref={searchInputRef} 
                type="text" 
                autoComplete="off"
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="🔍 ابحث في كامل المخزون..." 
                className="w-full pl-4 pr-14 py-4 text-xl border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-slate-50 focus:bg-white shadow-inner" 
              />
          </div>
          
          <div className="flex flex-wrap gap-4 items-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                    <label htmlFor="warehouse_filter_select" className="text-xs font-black text-slate-400 uppercase">{t('stock.filter_warehouse')}:</label>
                    <select 
                      id="warehouse_filter_select" 
                      name="warehouse_filter" 
                      value={selectedWarehouseFilter} 
                      onChange={e => setSelectedWarehouseFilter(e.target.value)} 
                      className="text-sm font-bold p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">-- كل المخازن --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
                <button 
                  id="btn_toggle_zero_stock"
                  name="btn_toggle_zero_stock"
                  onClick={() => setHideZeroStock(!hideZeroStock)} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${hideZeroStock ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-500 border-slate-200'}`}
                >
                    {hideZeroStock ? <EyeOff className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                    {t('stock.only_available')}
                </button>
                <button 
                   id="btn_toggle_low_stock"
                   name="btn_toggle_low_stock"
                   onClick={() => setShowLowStock(!showLowStock)} 
                   className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showLowStock ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}
                >
                  نواقص المخزون
                </button>
                <button 
                   id="btn_toggle_out_of_stock"
                   name="btn_toggle_out_of_stock"
                   onClick={() => setShowOutOfStock(!showOutOfStock)} 
                   className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showOutOfStock ? 'bg-red-50 text-red-600' : 'bg-white text-slate-500 border-slate-200'}`}
                >
                  منتهي (رصيد 0)
                </button>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-right">الصنف</th>
                  <th className="px-6 py-4 text-center">كود</th>
                  <th className="px-6 py-4 text-center">أفضل مورد</th>
                  <th className="px-6 py-4 text-center">سعر البيع</th>
                  <th className="px-6 py-4 text-center">الرصيد {selectedWarehouseFilter !== 'ALL' && '(بالمخزن)'}</th>
                  <th className="px-6 py-4 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4"><div className="font-bold text-slate-800">{product.name}</div></td>
                    <td className="px-6 py-4 text-center"><code className="text-[11px] font-mono text-slate-400">{product.code || '---'}</code></td>
                    <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100"><Award className="w-3 h-3" />{bestSuppliersMap[product.id] || '---'}</span></td>
                    <td className="px-6 py-4 text-center"><span className="font-bold text-blue-600 font-mono">{currency}{(product.batches?.[0]?.selling_price || product.selling_price || 0).toLocaleString()}</span></td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg font-black text-sm ${(product.batches?.reduce((s:number, b:any) => s+b.quantity,0) || 0) <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {selectedWarehouseFilter === 'ALL' ? (product.batches?.reduce((s:number, b:any) => s+b.quantity, 0) || 0) : (product.batches?.find((b:any) => b.warehouse_id === selectedWarehouseFilter)?.quantity || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                            <button 
                               id={`btn_view_card_${product.id}`}
                               name={`btn_view_card_${product.id}`}
                               onClick={() => { setSelectedCardProduct(product); setIsCardModalOpen(true); }} 
                               className="p-2 text-slate-400 hover:text-indigo-600"
                            >
                               <FileText className="w-4 h-4" />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Add Modal */}
      {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                  <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><PlusCircle className="w-6 h-6 text-blue-600" /> إضافة صنف جديد</h3>
                      <button id="btn_close_add_modal" name="btn_close_add_modal" onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-8 grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                          <label htmlFor="prod_name_input" className="block text-sm font-bold text-slate-700 mb-1">اسم الصنف *</label>
                          <input id="prod_name_input" name="name" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={quickAddForm.name} onChange={e => setQuickAddForm({...quickAddForm, name: e.target.value})} autoFocus />
                      </div>
                      <div>
                          <label htmlFor="prod_code_input" className="block text-sm font-bold text-slate-700 mb-1">الكود</label>
                          <input id="prod_code_input" name="code" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono" value={quickAddForm.code} onChange={e => setQuickAddForm({...quickAddForm, code: e.target.value})} />
                      </div>
                      <div>
                          <label htmlFor="prod_qty_input" className="block text-sm font-bold text-slate-700 mb-1">الرصيد الافتتاحي</label>
                          <input id="prod_qty_input" name="initial_qty" type="number" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={quickAddForm.initial_qty} onChange={e => setQuickAddForm({...quickAddForm, initial_qty: parseInt(e.target.value) || 0})} />
                      </div>
                      <div>
                          <label htmlFor="prod_purchase_price_input" className="block text-sm font-bold text-slate-700 mb-1">سعر الشراء</label>
                          <input id="prod_purchase_price_input" name="purchase_price" type="number" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-red-600" value={quickAddForm.purchase_price} onChange={e => setQuickAddForm({...quickAddForm, purchase_price: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div>
                          <label htmlFor="prod_selling_price_input" className="block text-sm font-bold text-slate-700 mb-1">سعر البيع</label>
                          <input id="prod_selling_price_input" name="selling_price" type="number" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-emerald-600" value={quickAddForm.selling_price} onChange={e => setQuickAddForm({...quickAddForm, selling_price: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div className="col-span-2 pt-4">
                          <button id="btn_submit_save_prod" name="btn_submit_save_prod" onClick={handleSaveProduct} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all">حفظ البيانات</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Inventory;