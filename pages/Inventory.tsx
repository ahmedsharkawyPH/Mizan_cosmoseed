
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch, SEARCH_CONFIG } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Brain, Sparkles,
  Command, Hash, Tag, DollarSign, Percent, Star, PlusCircle,
  FileSpreadsheet, Loader2, Download, Upload, FileOutput, TrendingUp, AlertCircle, RefreshCw
} from 'lucide-react';
import { exportFilteredProductsToExcel, readExcelFile, downloadInventoryTemplate } from '../utils/excel';
// @ts-ignore
import toast from 'react-hot-toast';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchMode, setSearchMode] = useState<'smart' | 'exact' | 'fuzzy'>('smart');
  const [dbFullLoaded, setDbFullLoaded] = useState(db.isFullyLoaded);
  
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
  }, []);

  useEffect(() => {
    loadProducts();
    // تحديث القائمة تلقائياً عند انتهاء التحميل الخلفي
    const checkLoad = setInterval(() => {
        if (db.isFullyLoaded && !dbFullLoaded) {
            loadProducts();
            clearInterval(checkLoad);
        }
    }, 3000);
    return () => clearInterval(checkLoad);
  }, [loadProducts, dbFullLoaded]);

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
  }, [searchQuery, products, searchMode, showLowStock, showOutOfStock]);

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
      switch(searchMode) {
        case 'smart': results = ArabicSmartSearch.smartSearch(results, searchQuery); break;
        case 'exact': results = results.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code?.toLowerCase().includes(searchQuery.toLowerCase())); break;
        case 'fuzzy': results = ArabicSmartSearch.smartSearch(results, searchQuery); break;
      }
    } else if (!showLowStock && !showOutOfStock) { results = []; }
    setSearchResults(results);
    if (searchQuery.trim().length > 2 && results.length > 0 && !searchHistory.includes(searchQuery)) {
      setSearchHistory(prev => [searchQuery, ...prev.slice(0, 9)]);
    }
  }, [searchQuery, products, searchMode, showLowStock, showOutOfStock, settings.lowStockThreshold, searchHistory]);

  const handleExport = () => { exportFilteredProductsToExcel(searchResults.length > 0 ? searchResults : products); };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsImporting(true);
    try {
      const importedData = await readExcelFile<any>(file);
      for (const item of importedData) {
        await db.addProduct(
          { code: item.code, name: item.name, selling_price: item.selling_price, purchase_price: item.purchase_price },
          { quantity: item.quantity, batch_number: item.batch_number, expiry_date: item.expiry_date }
        );
      }
      loadProducts();
      toast.success("تم الاستيراد بنجاح");
    } catch (error) { toast.error("خطأ أثناء الاستيراد"); } finally { setIsImporting(false); e.target.value = ''; }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
              <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" /> 
                {t('stock.title')}
              </h1>
              {!dbFullLoaded && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 w-fit">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span className="text-[10px] font-bold">جاري تحميل كافة الأصناف في الخلفية... النتائج قد تكون غير كاملة حالياً</span>
                  </div>
              )}
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

        {/* Search Bar Component */}
        <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
          <div className="relative group">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                {isSearching ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                ) : (
                  <Search className="h-6 w-6 text-slate-400" />
                )}
              </div>
              
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 ابحث عن أي منتج... جرب 'فات حمام' أو 'سكر' أو 'زيتون'"
                className="w-full pl-4 pr-14 py-4 text-xl border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-slate-50 focus:bg-white shadow-inner"
                autoComplete="off"
              />
              
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.length > 0 ? (
            searchResults.map((product) => (
              <ProductCard key={product.id} product={product} searchQuery={searchQuery} currency={currency} />
            ))
          ) : !searchQuery && !showLowStock && !showOutOfStock ? (
            products.slice(0, 15).map((product) => (
              <ProductCard key={product.id} product={product} searchQuery="" currency={currency} />
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <div className="p-4 bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-600">لم نجد ما تبحث عنه</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-component remains similar but uses the highlight utility
const ProductCard: React.FC<{ product: any; searchQuery: string; currency: string }> = ({ product, searchQuery, currency }) => {
  const totalQty = product.batches?.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0) || 0;
  const purchasePrice = product.batches?.length > 0 ? product.batches[product.batches.length - 1].purchase_price : (product.purchase_price || 0);
  const sellingPrice = product.batches?.length > 0 ? product.batches[product.batches.length - 1].selling_price : (product.selling_price || 0);

  const highlightMatch = (text: string, query: string) => {
    if (!text || !query) return text;
    const tokens = ArabicSmartSearch.tokenizeQuery(query);
    let highlighted = text;
    tokens.forEach(token => {
      const regex = new RegExp(`(${token})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 text-slate-900 font-black rounded-sm">$1</mark>');
    });
    return highlighted;
  };

  return (
    <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
      <div className="p-5 flex flex-col h-full">
        <h3 className="font-black text-slate-800 text-lg mb-1 leading-tight" dangerouslySetInnerHTML={{ __html: highlightMatch(product.name, searchQuery) }} />
        <div className="flex items-center gap-2 mb-4">
          <Hash className="w-3.5 h-3.5 text-slate-300" />
          <code className="text-xs font-mono text-slate-400" dangerouslySetInnerHTML={{ __html: highlightMatch(product.code || '---', searchQuery) }} />
        </div>
        <div className="mt-auto flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-400">الرصيد</span>
            <span className={`text-xl font-black ${totalQty <= 0 ? 'text-red-500' : 'text-slate-800'}`}>{totalQty}</span>
        </div>
      </div>
      <div className={`h-1.5 w-full ${totalQty <= 0 ? 'bg-red-500' : totalQty < 10 ? 'bg-amber-500' : 'bg-blue-600'}`} />
    </div>
  );
};

export default Inventory;
