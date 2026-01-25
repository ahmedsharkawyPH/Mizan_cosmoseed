import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch, SEARCH_CONFIG } from '../utils/search';
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dbFullLoaded, setDbFullLoaded] = useState(db.isFullyLoaded);
  const [isOffline, setIsOffline] = useState(db.isOffline);
  
  // Advanced Filtering
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [hideZeroStock, setHideZeroStock] = useState(false);

  const [isIEOpen, setIsIEOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });

  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [selectedCardProduct, setSelectedCardProduct] = useState<any>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<any>(null);
  
  const settings = db.getSettings();
  const warehouses = db.getWarehouses();
  const currency = settings.currency;

  const loadProducts = useCallback(async () => {
    const all = db.getProductsWithBatches();
    setProducts(all);
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
    const purchaseInvoices = db.getPurchaseInvoices();
    const suppliers = db.getSuppliers();
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
    let results = [...products];

    // 1. Warehouse Filter
    if (selectedWarehouseFilter !== 'ALL') {
        results = results.filter(p => p.batches.some((b: any) => b.warehouse_id === selectedWarehouseFilter));
    }

    // 2. Hide Zero Stock
    if (hideZeroStock) {
        results = results.filter(p => {
            const qty = selectedWarehouseFilter === 'ALL' 
                ? p.batches.reduce((s: number, b: any) => s + b.quantity, 0)
                : p.batches.find((b: any) => b.warehouse_id === selectedWarehouseFilter)?.quantity || 0;
            return qty > 0;
        });
    }

    // 3. Search Query
    if (searchQuery.trim()) {
        results = ArabicSmartSearch.smartSearch(results, searchQuery);
    }

    // 4. Existing Quick Filters
    if (showLowStock) {
        const threshold = settings.lowStockThreshold || 10;
        results = results.filter(p => {
            const total = p.batches.reduce((sum: any, b: any) => sum + b.quantity, 0);
            return total > 0 && total <= threshold;
        });
    }
    if (showOutOfStock) {
        results = results.filter(p => p.batches.reduce((sum: any, b: any) => sum + b.quantity, 0) === 0);
    }

    return results;
  }, [products, searchQuery, selectedWarehouseFilter, hideZeroStock, showLowStock, showOutOfStock, settings.lowStockThreshold]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div><h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><Package className="w-8 h-8 text-blue-600" /> {t('stock.title')}</h1></div>
           <div className="flex flex-wrap gap-2">
             <button onClick={() => setIsIEOpen(true)} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all"><FileSpreadsheet className="w-5 h-5" /> استيراد وتصدير</button>
             <button onClick={() => { setEditingProduct(null); setIsAddModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><PlusCircle className="w-5 h-5" /> {t('stock.new')}</button>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
          <div className="relative group mb-4">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none"><Search className="h-6 w-6 text-slate-400" /></div>
              <input id="inventory_main_search" name="inventory_search" ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 ابحث في كامل المخزون..." className="w-full pl-4 pr-14 py-4 text-xl border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-slate-50 focus:bg-white shadow-inner" />
          </div>
          
          <div className="flex flex-wrap gap-4 items-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-400 uppercase">{t('stock.filter_warehouse')}:</label>
                    <select value={selectedWarehouseFilter} onChange={e => setSelectedWarehouseFilter(e.target.value)} className="text-sm font-bold p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="ALL">-- كل المخازن --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
                <button onClick={() => setHideZeroStock(!hideZeroStock)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${hideZeroStock ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-500 border-slate-200'}`}>
                    {hideZeroStock ? <EyeOff className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                    {t('stock.only_available')}
                </button>
                <button onClick={() => setShowLowStock(!showLowStock)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showLowStock ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}>نواقص المخزون</button>
                <button onClick={() => setShowOutOfStock(!showOutOfStock)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showOutOfStock ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200'}`}>منتهي (رصيد 0)</button>
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
                      <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg font-black text-sm ${product.batches?.reduce((s:number, b:any) => s+b.quantity,0) <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {selectedWarehouseFilter === 'ALL' ? product.batches?.reduce((s:number, b:any) => s+b.quantity, 0) : product.batches?.find((b:any) => b.warehouse_id === selectedWarehouseFilter)?.quantity || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                            <button onClick={() => { setSelectedCardProduct(product); setIsCardModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><FileText className="w-4 h-4" /></button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;