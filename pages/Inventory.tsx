


import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch, SEARCH_CONFIG } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Brain, Sparkles,
  Command, Hash, Tag, DollarSign, Percent, Star, PlusCircle,
  FileSpreadsheet, Loader2, Download, Upload, FileOutput, TrendingUp, AlertCircle, RefreshCw, Wifi, WifiOff, Award
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
  
  const [isIEOpen, setIsIEOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  // Initializing searchTimeoutRef with null to satisfy TypeScript requirement for useRef arguments.
  const searchTimeoutRef = useRef<any>(null);
  
  const settings = db.getSettings();
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
        if (db.isFullyLoaded !== dbFullLoaded || db.isOffline !== isOffline) {
            loadProducts();
        }
    }, 3000);
    return () => clearInterval(checkLoad);
  }, [loadProducts, dbFullLoaded, isOffline]);

  // حساب أفضل مورد لكل صنف بناءً على تاريخ المشتريات
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

  useEffect(() => {
    if (searchTimeoutRef.current) { clearTimeout(searchTimeoutRef.current); }
    if (searchQuery.trim().length === 0 && !showLowStock && !showOutOfStock) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch();
      setIsSearching(false);
    }, SEARCH_CONFIG.DEBOUNCE_TIME);
    return () => { if (searchTimeoutRef.current) { clearTimeout(searchTimeoutRef.current); } };
  }, [searchQuery, products, showLowStock, showOutOfStock]);

  const performSearch = useCallback(() => {
    let results = [...products];
    if (showLowStock) {
      const threshold = settings.lowStockThreshold || 10;
      results = results.filter(p => {
        const total = p.batches.reduce((sum: any, b: any) => sum + b.quantity, 0);
        return total > 0 && total <= threshold;
      });
    }
    if (showOutOfStock) { results = results.filter(p => p.batches.reduce((sum: any, b: any) => sum + b.quantity, 0) === 0); }
    if (searchQuery.trim()) {
      results = ArabicSmartSearch.smartSearch(results, searchQuery);
    } else if (!showLowStock && !showOutOfStock) { 
      results = []; 
    }
    setSearchResults(results);
  }, [searchQuery, products, showLowStock, showOutOfStock, settings.lowStockThreshold]);

  const handleExport = () => { exportFilteredProductsToExcel(searchResults.length > 0 ? searchResults : products); };

  const displayedProducts = useMemo(() => {
    if (searchResults.length > 0) return searchResults;
    if (searchQuery || showLowStock || showOutOfStock) return [];
    return products.slice(0, 100);
  }, [searchResults, searchQuery, showLowStock, showOutOfStock, products]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
              <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" /> 
                {t('stock.title')}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {!dbFullLoaded && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span className="text-[10px] font-bold">جاري مزامنة باقي الأصناف...</span>
                    </div>
                )}
                {isOffline && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                        <WifiOff className="w-3 h-3" />
                        <span className="text-[10px] font-bold">تعمل محلياً (أوفلاين)</span>
                    </div>
                )}
              </div>
           </div>
           
           <div className="flex flex-wrap gap-2">
             <button onClick={() => setIsIEOpen(true)} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all">
               <FileSpreadsheet className="w-5 h-5" /> استيراد وتصدير
             </button>
             <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
               <PlusCircle className="w-5 h-5" /> {t('stock.new')}
             </button>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
          <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                {isSearching ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div> : <Search className="h-6 w-6 text-slate-400" />}
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 ابحث عن أي منتج... النتائج تظهر لحظياً"
                className="w-full pl-4 pr-14 py-4 text-xl border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-slate-50 focus:bg-white shadow-inner"
              />
          </div>
          
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setShowLowStock(!showLowStock)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${showLowStock ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}>نواقص المخزون</button>
                <button onClick={() => setShowOutOfStock(!showOutOfStock)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${showOutOfStock ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200'}`}>منتهي (رصيد 0)</button>
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
                  <th className="px-6 py-4 text-center">سعر التكلفة</th>
                  <th className="px-6 py-4 text-center">سعر البيع</th>
                  <th className="px-6 py-4 text-center">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayedProducts.map((product) => (
                  <ProductRow 
                    key={product.id} 
                    product={product} 
                    searchQuery={searchQuery} 
                    currency={currency} 
                    bestSupplier={bestSuppliersMap[product.id] || '---'}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          {displayedProducts.length === 0 && (
            <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 m-4">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-600">لم يتم العثور على نتائج</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProductRow = React.memo(({ product, searchQuery, currency, bestSupplier }: { product: any; searchQuery: string; currency: string; bestSupplier: string }) => {
  const totalQty = product.batches?.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0) || 0;
  
  // جلب الأسعار من آخر تشغيلة أو من بيانات المنتج الأساسية
  const costPrice = product.batches && product.batches.length > 0 
    ? product.batches[product.batches.length - 1].purchase_price 
    : (product.purchase_price || 0);
    
  const sellingPrice = product.batches && product.batches.length > 0 
    ? product.batches[product.batches.length - 1].selling_price 
    : (product.selling_price || 0);

  const highlightMatch = (text: string, query: string) => {
    if (!text || !query) return text;
    const tokens = ArabicSmartSearch.tokenizeQuery(query);
    let highlighted = text;
    tokens.forEach(token => {
      const regex = new RegExp(`(${token})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 text-slate-900 font-bold rounded-sm">$1</mark>');
    });
    return highlighted;
  };

  return (
    <tr className="hover:bg-blue-50/50 transition-colors group">
      <td className="px-6 py-4">
        <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors" dangerouslySetInnerHTML={{ __html: highlightMatch(product.name, searchQuery) }} />
      </td>
      <td className="px-6 py-4 text-center">
        <code className="text-[11px] font-mono text-slate-400" dangerouslySetInnerHTML={{ __html: highlightMatch(product.code || '---', searchQuery) }} />
      </td>
      <td className="px-6 py-4 text-center">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
           <Award className="w-3 h-3" />
           {bestSupplier}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="font-mono text-slate-600">{currency}{costPrice.toLocaleString()}</span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="font-bold text-blue-600 font-mono">{currency}{sellingPrice.toLocaleString()}</span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg font-black text-sm ${totalQty <= 0 ? 'bg-red-50 text-red-600 border border-red-100' : totalQty < 10 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {totalQty}
        </span>
      </td>
    </tr>
  );
});

export default Inventory;
