
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { 
  PlusCircle, Search, Package, FileOutput, ChevronDown, Loader2,
  Filter, X, AlertCircle, Database, ChevronUp, Download, Upload, 
  FileSpreadsheet, CheckCircle2, ClipboardCheck, History, Save, RotateCcw
} from 'lucide-react';
import { exportFilteredProductsToExcel, readExcelFile, downloadInventoryTemplate } from '../utils/excel';

// إعدادات الأداء الاحترافية
const PERFORMANCE_CONFIG = {
  INITIAL_LOAD: 100,           
  LOAD_MORE_INCREMENT: 200,    
  SEARCH_DEBOUNCE: 300,        
  MAX_BATCHES_DISPLAY: 5,      
};

interface PaginatedResult {
  products: any[];
  total: number;
  hasMore: boolean;
}

const Inventory: React.FC = () => {
  // حالة التبويب النشط
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STOCKTAKE'>('OVERVIEW');
  
  const [data, setData] = useState<PaginatedResult>({ products: [], total: 0, hasMore: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [loadMoreLock, setLoadMoreLock] = useState(false);
  
  // حالة الجرد الفعلي
  const [actualCounts, setActualCounts] = useState<Record<string, number>>({});
  
  // حالة نافذة الاستيراد والتصدير
  const [isIEOpen, setIsIEOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  
  // حالة التصفية المتقدمة
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'totalStock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const settings = db.getSettings();
  const currency = settings.currency;
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 1. محرك البحث (Debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); 
    }, PERFORMANCE_CONFIG.SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. تحميل البيانات
  const fetchProducts = useCallback(async (isInitial = false) => {
    if (loadMoreLock && !isInitial) return;
    
    if (isInitial) setIsLoading(true);
    else setLoadMoreLock(true);

    try {
      const result = db.getProductsPaginated({
        page: isInitial ? 1 : page + 1,
        pageSize: PERFORMANCE_CONFIG.INITIAL_LOAD,
        search: debouncedSearch,
        filters: {
          lowStockOnly: showLowStock,
          outOfStockOnly: showOutOfStock
        },
        sortBy,
        sortOrder
      });

      setData(result);
      if (!isInitial) setPage(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setIsLoading(false);
      setLoadMoreLock(false);
      setIsSearching(false);
    }
  }, [debouncedSearch, page, showLowStock, showOutOfStock, sortBy, sortOrder, loadMoreLock]);

  useEffect(() => {
    fetchProducts(true);
  }, [debouncedSearch, showLowStock, showOutOfStock, sortBy, sortOrder]);

  // 3. التمرير التلقائي
  useEffect(() => {
    if (!loadMoreRef.current || isLoading || !data.hasMore) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadMoreLock) {
          fetchProducts();
        }
      },
      { threshold: 0.1 }
    );
    
    observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [isLoading, loadMoreLock, data.hasMore, fetchProducts]);

  const quickStats = useMemo(() => {
    const all = db.getProductsWithBatches();
    const threshold = settings.lowStockThreshold || 10;
    let low = 0;
    let out = 0;
    
    all.forEach(p => {
      const qty = p.batches.reduce((s, b) => s + b.quantity, 0);
      if (qty === 0) out++;
      else if (qty <= threshold) low++;
    });
    
    return { low, out, total: all.length };
  }, [settings.lowStockThreshold]);

  const handleExport = () => {
    const fullResult = db.getProductsPaginated({
        page: 1,
        pageSize: 100000,
        search: debouncedSearch,
        filters: { lowStockOnly: showLowStock, outOfStockOnly: showOutOfStock }
    });
    exportFilteredProductsToExcel(fullResult.products);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsImporting(true);
    setImportProgress(5);
    setImportSuccess(false);
    try {
      const importedData = await readExcelFile<any>(file);
      const totalItems = importedData.length;
      for (let i = 0; i < totalItems; i++) {
        const item = importedData[i];
        await db.addProduct(
          { code: item.code, name: item.name, selling_price: item.selling_price, purchase_price: item.purchase_price },
          { quantity: item.quantity, batch_number: item.batch_number, expiry_date: item.expiry_date }
        );
        if (i % 10 === 0 || i === totalItems - 1) {
          setImportProgress(Math.round(((i + 1) / totalItems) * 100));
        }
      }
      setImportSuccess(true);
      fetchProducts(true);
    } catch (error) {
      alert("خطأ أثناء الاستيراد");
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleStockTakeChange = (id: string, val: string) => {
      const num = parseInt(val);
      setActualCounts(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const saveAdjustments = () => {
      const changesCount = Object.keys(actualCounts).length;
      if (changesCount === 0) {
          alert(t('stock.no_changes'));
          return;
      }
      if (confirm(`هل أنت متأكد من حفظ تسوية الجرد لعدد ${changesCount} صنف؟ سيتم تعديل الأرصدة دفترياً لتطابق الجرد الفعلي.`)) {
          // هنا يتم استدعاء دالة التسوية في db.ts مستقبلاً
          alert("تم حفظ تسويات الجرد بنجاح (محاكاة)");
          setActualCounts({});
          fetchProducts(true);
      }
  };

  return (
    <div className="space-y-6 pb-32 animate-in fade-in duration-500">
      {/* رأس الصفحة الرئيسي */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" /> 
            {t('stock.title')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
             إدارة الأصناف، تتبع الأرصدة، وإجراء الجرد الدوري
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setIsIEOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all"
          >
            <FileSpreadsheet className="w-5 h-5" /> استيراد وتصدير
          </button>
          
          <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
            <PlusCircle className="w-5 h-5" /> {t('stock.new')}
          </button>
        </div>
      </div>

      {/* التبويبات الثانوية */}
      <div className="flex p-1 bg-slate-200/50 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'OVERVIEW' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <History className="w-4 h-4" /> {t('stock.tab_overview')}
          </button>
          <button 
            onClick={() => setActiveTab('STOCKTAKE')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'STOCKTAKE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <ClipboardCheck className="w-4 h-4" /> {t('stock.tab_take')}
          </button>
      </div>

      {/* شريط البحث والتصفية المتغير حسب التبويب */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 sticky top-0 z-10 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-3.5 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder={activeTab === 'OVERVIEW' ? "ابحث باسم الصنف أو الكود..." : "ابحث عن صنف لجرده..."}
            className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-all text-lg"
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {activeTab === 'OVERVIEW' && (
            <div className="flex gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button onClick={() => setShowLowStock(!showLowStock)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showLowStock ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>نواقص</button>
                    <button onClick={() => setShowOutOfStock(!showOutOfStock)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showOutOfStock ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>منتهي</button>
                </div>
                <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none font-bold text-sm"
                >
                    <option value="name">ترتيب بالاسم</option>
                    <option value="code">بالكود</option>
                    <option value="totalStock">بالرصيد</option>
                </select>
            </div>
        )}

        {activeTab === 'STOCKTAKE' && (
            <button 
                onClick={saveAdjustments}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
                <Save className="w-5 h-5 text-blue-400" /> {t('stock.save_adjustments')}
            </button>
        )}
      </div>

      {/* عرض المحتوى حسب التبويب */}
      {isLoading && data.products.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-700 font-bold">جاري تحميل البيانات...</p>
        </div>
      ) : activeTab === 'OVERVIEW' ? (
        <div className="grid gap-4">
          {data.products.map(product => {
            const totalQty = product.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group">
                <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${totalQty === 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>{product.name.charAt(0)}</div>
                    <div>
                      <h3 className="font-black text-slate-800 text-lg">{product.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">{product.code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-black uppercase">الرصيد</p>
                    <span className={`text-2xl font-black ${totalQty === 0 ? 'text-red-500' : 'text-slate-800'}`}>{totalQty.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* واجهة الجرد الفعلي */
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-xs border-b">
                    <tr>
                        <th className="px-6 py-4">الصنف</th>
                        <th className="px-6 py-4 text-center">الرصيد دفترياً</th>
                        <th className="px-6 py-4 text-center">الرصيد الفعلي (الجرد)</th>
                        <th className="px-6 py-4 text-center">الفرق</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.products.map(product => {
                        const systemQty = product.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
                        const actualQty = actualCounts[product.id] ?? systemQty;
                        const diff = actualQty - systemQty;
                        
                        return (
                            <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{product.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{product.code}</div>
                                </td>
                                <td className="px-6 py-4 text-center font-black text-slate-600 bg-slate-50/50">
                                    {systemQty}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <input 
                                        type="number"
                                        className="w-24 border-2 border-slate-200 rounded-xl p-2 text-center font-black focus:border-blue-500 outline-none transition-all"
                                        value={actualCounts[product.id] ?? ''}
                                        placeholder={systemQty.toString()}
                                        onChange={(e) => handleStockTakeChange(product.id, e.target.value)}
                                    />
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {diff !== 0 ? (
                                        <span className={`px-3 py-1 rounded-full font-black text-xs ${diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {diff > 0 ? `+${diff}` : diff}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 font-bold">-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      )}

      {/* زر تحميل المزيد */}
      {data.hasMore && (
          <div className="flex justify-center py-8">
              <button ref={loadMoreRef} onClick={() => fetchProducts()} className="px-8 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all">
                  عرض المزيد
              </button>
          </div>
      )}

      {/* مودال الاستيراد والتصدير */}
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

export default Inventory;
