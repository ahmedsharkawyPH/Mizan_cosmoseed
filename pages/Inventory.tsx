
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch, SEARCH_CONFIG } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Brain, Sparkles,
  Command, Hash, Tag, DollarSign, Percent, Star, PlusCircle,
  FileSpreadsheet, Loader2, Download, Upload, FileOutput, TrendingUp, AlertCircle, RefreshCw, Wifi, WifiOff
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
  const searchTimeoutRef = useRef<any>();
  
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(searchResults.length > 0 ? searchResults : (!searchQuery && !showLowStock && !showOutOfStock ? products.slice(0, 50) : [])).map((product) => (
            <ProductCard key={product.id} product={product} searchQuery={searchQuery} />
          ))}
          
          {(searchResults.length === 0 && (searchQuery || showLowStock || showOutOfStock)) && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-600">لم يتم العثور على نتائج</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// استخدام React.memo لمنع إعادة رسم البطاقة إلا عند تغير البيانات
const ProductCard = React.memo(({ product, searchQuery }: { product: any; searchQuery: string }) => {
  const totalQty = product.batches?.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0) || 0;
  
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
    <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
      <div className="p-4 flex flex-col h-full">
        <h3 className="font-bold text-slate-800 text-base mb-1 leading-tight group-hover:text-blue-600 transition-colors h-10 overflow-hidden" dangerouslySetInnerHTML={{ __html: highlightMatch(product.name, searchQuery) }} />
        <div className="flex items-center gap-1 mb-4">
          <code className="text-[10px] font-mono text-slate-400" dangerouslySetInnerHTML={{ __html: highlightMatch(product.code || '---', searchQuery) }} />
        </div>
        <div className="mt-auto flex justify-between items-center bg-slate-50 p-2 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400">الرصيد</span>
            <span className={`text-lg font-black ${totalQty <= 0 ? 'text-red-500' : totalQty < 10 ? 'text-amber-500' : 'text-slate-800'}`}>{totalQty}</span>
        </div>
      </div>
      <div className={`h-1 w-full ${totalQty <= 0 ? 'bg-red-500' : totalQty < 10 ? 'bg-amber-500' : 'bg-blue-600'}`} />
    </div>
  );
});

export default Inventory;
