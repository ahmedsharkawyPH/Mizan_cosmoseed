
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch, SEARCH_CONFIG } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Brain, Sparkles,
  Command, Hash, Tag, DollarSign, Percent, Star, PlusCircle,
  FileSpreadsheet, Loader2, Download, Upload, FileOutput, TrendingUp, AlertCircle
} from 'lucide-react';
import { exportFilteredProductsToExcel, readExcelFile, downloadInventoryTemplate } from '../utils/excel';
// Add missing toast import
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
  
  const [isIEOpen, setIsIEOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  // Fix NodeJS namespace error by using any for browser environment timeout type
  const searchTimeoutRef = useRef<any>();
  
  const settings = db.getSettings();
  const currency = settings.currency;

  // تحميل المنتجات
  const loadProducts = useCallback(async () => {
    const all = db.getProductsWithBatches();
    setProducts(all);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // البحث الذكي مع Debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
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
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, products, searchMode, showLowStock, showOutOfStock]);

  const performSearch = useCallback(() => {
    let results = [...products];

    // Filter by stocks if needed
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

    if (searchQuery.trim()) {
      switch(searchMode) {
        case 'smart':
          results = ArabicSmartSearch.smartSearch(results, searchQuery);
          break;
        case 'exact':
          results = results.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.code?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          break;
        case 'fuzzy':
          // Standard fuzzy matching
          results = ArabicSmartSearch.smartSearch(results, searchQuery);
          break;
      }
    } else if (!showLowStock && !showOutOfStock) {
      results = [];
    }
    
    setSearchResults(results);
    
    if (searchQuery.trim().length > 2 && results.length > 0 && !searchHistory.includes(searchQuery)) {
      setSearchHistory(prev => [searchQuery, ...prev.slice(0, 9)]);
    }
  }, [searchQuery, products, searchMode, showLowStock, showOutOfStock, settings.lowStockThreshold, searchHistory]);

  const handleExport = () => {
    exportFilteredProductsToExcel(searchResults.length > 0 ? searchResults : products);
  };

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
      // Fix missing toast name error
      toast.success("تم الاستيراد بنجاح");
    } catch (error) {
      // Fix missing toast name error
      toast.error("خطأ أثناء الاستيراد");
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  const searchExamples = [
    { query: 'سكر', desc: 'كل منتجات السكر' },
    { query: 'دقيق اسمر', desc: 'الدقيق الأسمر والأبيض' },
    { query: 'زيت 5', desc: 'الزيوت مع الرقم 5' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
              <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" /> 
                {t('stock.title')}
              </h1>
              <p className="text-slate-500 text-sm mt-1">نظام البحث الذكي والمتقدم للمخزون</p>
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
            
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-slate-400 font-medium flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />
                  جرب:
                </span>
                {searchExamples.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSearchQuery(example.query)}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors border border-blue-100 font-bold"
                  >
                    {example.query}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setShowLowStock(!showLowStock)} 
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${showLowStock ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  نواقص
                </button>
                <button 
                  onClick={() => setShowOutOfStock(!showOutOfStock)} 
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${showOutOfStock ? 'bg-red-500 text-white border-red-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  منتهي
                </button>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${showAdvanced ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  <Brain className="w-4 h-4" /> خيارات البحث
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                <h4 className="font-bold text-slate-700 mb-3 text-sm">نوع خوارزمية البحث:</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSearchMode('smart')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-2 transition-all ${
                      searchMode === 'smart' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <Brain className="w-4 h-4" /> ذكي (مُوصى به)
                  </button>
                  <button
                    onClick={() => setSearchMode('exact')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-2 transition-all ${
                      searchMode === 'exact' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <Command className="w-4 h-4" /> مطابقة تامة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Results Info */}
        {(searchQuery || showLowStock || showOutOfStock) && (
          <div className="flex items-center justify-between px-2">
             <h2 className="text-lg font-bold text-slate-700">
                {searchResults.length > 0 ? (
                  <>نتائج البحث: <span className="text-blue-600">{searchResults.length} صنف</span></>
                ) : (
                  <span className="text-slate-400">لا توجد نتائج مطابقة</span>
                )}
             </h2>
             {searchResults.length > 0 && (
                <button onClick={handleExport} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1">
                  <FileOutput className="w-4 h-4" /> تصدير النتائج
                </button>
             )}
          </div>
        )}

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.length > 0 ? (
            searchResults.map((product, idx) => (
              <ProductCard key={product.id} product={product} searchQuery={searchQuery} currency={currency} />
            ))
          ) : !searchQuery && !showLowStock && !showOutOfStock ? (
            // Default View when not searching
            products.slice(0, 15).map((product) => (
              <ProductCard key={product.id} product={product} searchQuery="" currency={currency} />
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <div className="p-4 bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-600">لم نجد ما تبحث عنه</h3>
              <p className="text-slate-400 mt-2">جرب كلمات بحث مختلفة أو تأكد من خيارات الفلترة</p>
            </div>
          )}
        </div>
      </div>

      {/* Import/Export Modal */}
      {isIEOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
              <h3 className="text-xl font-bold flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-400" /> إدارة البيانات عبر إكسيل</h3>
              <button onClick={() => setIsIEOpen(false)} className="hover:bg-white/10 p-2 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={downloadInventoryTemplate} className="p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 font-bold flex flex-col items-center gap-2">
                        <Download className="w-6 h-6" /> تحميل النموذج
                    </button>
                    <button onClick={handleExport} className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 font-bold flex flex-col items-center gap-2">
                        <FileOutput className="w-6 h-6" /> تصدير الحالي
                    </button>
                </div>
                <label className="w-full flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-white hover:border-blue-400 transition-all cursor-pointer">
                    <Upload className="w-10 h-10 text-slate-300 mb-2" />
                    <span className="text-sm font-bold text-slate-600">اختر ملف إكسيل للاستيراد</span>
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for product card
const ProductCard: React.FC<{ product: any; searchQuery: string; currency: string }> = ({ product, searchQuery, currency }) => {
  const totalQty = product.batches?.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0) || 0;
  const purchasePrice = product.batches?.length > 0 ? product.batches[product.batches.length - 1].purchase_price : (product.purchase_price || 0);
  const sellingPrice = product.batches?.length > 0 ? product.batches[product.batches.length - 1].selling_price : (product.selling_price || 0);

  const highlightMatch = (text: string, query: string) => {
    if (!text || !query) return text;
    const tokens = ArabicSmartSearch.tokenizeQuery(query);
    if (tokens.length === 0) return text;

    let highlighted = text;
    tokens.forEach(token => {
      if (token.length < 1) return;
      const regex = new RegExp(`(${token})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 text-slate-900 font-black rounded-sm">$1</mark>');
    });
    return highlighted;
  };

  return (
    <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
      <div className="p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${totalQty <= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
            {product.name.charAt(0)}
          </div>
          {product._searchScore && (
             <div className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-black border border-emerald-100 flex items-center gap-1">
                <Zap className="w-3 h-3" /> دقة {Math.min(product._searchScore * 10, 100)}%
             </div>
          )}
        </div>

        <h3 
          className="font-black text-slate-800 text-lg mb-1 leading-tight group-hover:text-blue-600 transition-colors"
          dangerouslySetInnerHTML={{ __html: highlightMatch(product.name, searchQuery) }}
        />
        
        <div className="flex items-center gap-2 mb-4">
          <Hash className="w-3.5 h-3.5 text-slate-300" />
          <code 
            className="text-xs font-mono text-slate-400"
            dangerouslySetInnerHTML={{ __html: highlightMatch(product.code || '---', searchQuery) }}
          />
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
             <div className="text-center flex-1">
                <p className="text-[10px] text-slate-400 font-black uppercase flex items-center gap-1 justify-center">
                   <TrendingUp className="w-3 h-3 text-emerald-500" /> شراء
                </p>
                <span className="text-sm font-black text-slate-600">{currency}{purchasePrice.toLocaleString()}</span>
             </div>
             <div className="w-px h-6 bg-slate-200"></div>
             <div className="text-center flex-1">
                <p className="text-[10px] text-slate-400 font-black uppercase flex items-center gap-1 justify-center">
                   <Tag className="w-3 h-3 text-blue-500" /> بيع
                </p>
                <span className="text-sm font-black text-blue-600">{currency}{sellingPrice.toLocaleString()}</span>
             </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-400">الرصيد المتوفر</span>
            <span className={`text-xl font-black ${totalQty <= 0 ? 'text-red-500' : 'text-slate-800'}`}>
              {totalQty.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      
      <div className={`h-1.5 w-full ${totalQty <= 0 ? 'bg-red-500' : totalQty < 10 ? 'bg-amber-500' : 'bg-blue-600'}`} />
    </div>
  );
};

export default Inventory;
