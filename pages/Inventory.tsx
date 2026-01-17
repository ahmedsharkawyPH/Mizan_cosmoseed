
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { 
  PlusCircle, Search, Package, FileOutput, ChevronDown, Loader2,
  Filter, X, AlertCircle, Database, ChevronUp, Download, Upload, FileSpreadsheet, CheckCircle2
} from 'lucide-react';
import { exportFilteredProductsToExcel, readExcelFile, downloadInventoryTemplate } from '../utils/excel';

// إعدادات الأداء الاحترافية
const PERFORMANCE_CONFIG = {
  INITIAL_LOAD: 100,           // تحميل أولي 100 منتج
  LOAD_MORE_INCREMENT: 200,    // تحميل 200 منتج إضافي عند الحاجة
  SEARCH_DEBOUNCE: 300,        // تأخير البحث 300ms لراحة المعالج
  MAX_BATCHES_DISPLAY: 5,      // عرض 5 تشغيلات فقط لتوفير موارد المتصفح
};

interface PaginatedResult {
  products: any[];
  total: number;
  hasMore: boolean;
}

const Inventory: React.FC = () => {
  const [data, setData] = useState<PaginatedResult>({ products: [], total: 0, hasMore: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [loadMoreLock, setLoadMoreLock] = useState(false);
  
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
      setPage(1); // إعادة التعيين عند البحث الجديد
    }, PERFORMANCE_CONFIG.SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. تحميل البيانات (تجزئة)
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

  // 3. التمرير التلقائي (Intersection Observer)
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

  // 4. إحصائيات سريعة للمخزون
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

  const resetFilters = () => {
    setSearchTerm('');
    setShowLowStock(false);
    setShowOutOfStock(false);
    setSortBy('name');
    setSortOrder('asc');
  };

  const handleExport = () => {
    // تصدير كافة البيانات التي تطابق البحث الحالي أو الكل
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
        // محاكاة معالجة كل صنف
        await db.addProduct(
          { code: item.code, name: item.name, selling_price: item.selling_price, purchase_price: item.purchase_price },
          { quantity: item.quantity, batch_number: item.batch_number, expiry_date: item.expiry_date }
        );
        
        // تحديث شريط التقدم كل 10 أصناف لتقليل عمليات الريندر
        if (i % 10 === 0 || i === totalItems - 1) {
          setImportProgress(Math.round(((i + 1) / totalItems) * 100));
        }
      }
      
      setImportSuccess(true);
      fetchProducts(true); // تحديث القائمة
    } catch (error) {
      alert("خطأ أثناء استيراد الملف. يرجى التأكد من توافق البيانات مع النموذج.");
      console.error(error);
    } finally {
      setIsImporting(false);
      // مسح المدخل للسماح برفع نفس الملف مرة أخرى إذا لزم الأمر
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-32 animate-in fade-in duration-500">
      {/* رأس الصفحة */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" /> 
            {t('stock.title')}
            {isSearching && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-slate-500 text-sm">
              معروض <span className="font-bold text-blue-600">{data.products.length.toLocaleString()}</span> من 
              <span className="font-bold text-slate-700"> {data.total.toLocaleString()}</span> صنف
            </p>
            <div className="flex gap-1">
                {quickStats.low && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⚠️ {quickStats.low} نواقص</span>}
                {quickStats.out && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">⛔ {quickStats.out} منتهي</span>}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button onClick={() => setShowLowStock(!showLowStock)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showLowStock ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>نواقص</button>
              <button onClick={() => setShowOutOfStock(!showOutOfStock)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showOutOfStock ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>منتهي</button>
          </div>
          
          <button 
            onClick={() => setIsIEOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all"
          >
            <FileSpreadsheet className="w-5 h-5" /> 
            استيراد وتصدير
          </button>
          
          <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
            <PlusCircle className="w-5 h-5" /> {t('stock.new')}
          </button>
        </div>
      </div>

      {/* شريط البحث المطور */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 sticky top-0 z-10 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-3.5 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="ابحث باسم الصنف أو الكود (سريع جداً)..." 
            className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-all text-lg"
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
            <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
            >
                <option value="name">ترتيب بالاسم</option>
                <option value="code">ترتيب بالكود</option>
                <option value="totalStock">ترتيب بالرصيد</option>
            </select>
            <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white font-bold text-sm"
            >
                {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
        </div>
      </div>

      {/* الحالة: تحميل */}
      {isLoading && data.products.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Database className="w-16 h-16 text-blue-100" />
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin absolute inset-0 m-auto" />
          </div>
          <div className="text-center">
            <p className="text-slate-700 font-bold text-lg">جاري معالجة قاعدة البيانات...</p>
            <p className="text-slate-400 text-sm">يتم تحميل الأصناف على دفعات لضمان أداء المتصفح</p>
          </div>
        </div>
      ) : (
        <>
          {/* قائمة الأصناف */}
          <div className="grid gap-4">
            {data.products.map(product => {
              const totalQty = product.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
              const batchesToShow = product.batches.slice(0, PERFORMANCE_CONFIG.MAX_BATCHES_DISPLAY);
              const hasMoreBatches = product.batches.length > PERFORMANCE_CONFIG.MAX_BATCHES_DISPLAY;
              
              return (
                <div 
                  key={product.id} 
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-inner ${
                        totalQty === 0 ? 'bg-red-50 text-red-500' : totalQty <= 10 ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {product.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-800 text-lg group-hover:text-blue-700 transition-colors">{product.name}</h3>
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg uppercase">{product.code}</span>
                        </div>
                        <div className="flex gap-4 mt-1">
                            <div className="text-xs text-slate-500">بيع: <span className="font-bold text-slate-700">{currency}{product.selling_price?.toLocaleString()}</span></div>
                            <div className="text-xs text-slate-500">تكلفة: <span className="font-bold text-slate-700">{currency}{product.purchase_price?.toLocaleString()}</span></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center md:items-end min-w-[120px]">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">إجمالي الرصيد</p>
                        <span className={`text-3xl font-black ${totalQty === 0 ? 'text-red-500' : totalQty <= 10 ? 'text-amber-500' : 'text-slate-800'}`}>
                          {totalQty.toLocaleString()}
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold">({product.batches.length} تشغيلات)</p>
                    </div>
                  </div>

                  {/* تشغيلات سريعة مصغرة */}
                  <div className="px-6 pb-4 flex flex-wrap gap-2 border-t border-slate-50 pt-3 bg-slate-50/30">
                      {batchesToShow.map((b: any) => (
                          <div key={b.id} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[11px] flex flex-col items-center hover:border-blue-300 transition-colors">
                              <span className="text-slate-400 font-mono">{b.batch_number}</span>
                              <span className="font-black text-blue-600">ك: {b.quantity}</span>
                          </div>
                      ))}
                      {hasMoreBatches && (
                          <div className="bg-slate-100 text-slate-400 px-3 py-1.5 rounded-xl text-[10px] flex items-center justify-center font-bold">
                              +{product.batches.length - PERFORMANCE_CONFIG.MAX_BATCHES_DISPLAY} أخرى
                          </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* زر تحميل المزيد (مؤشر التمرير التلقائي) */}
          <div className="flex flex-col items-center gap-4 py-12">
            {data.hasMore && (
                <button
                    ref={loadMoreRef}
                    onClick={() => fetchProducts()}
                    disabled={loadMoreLock}
                    className="px-10 py-4 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                >
                    {loadMoreLock ? (
                        <div className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...</div>
                    ) : (
                        <div className="flex items-center gap-2"><ChevronDown className="w-6 h-6 animate-bounce" /> عرض المزيد من الأصناف</div>
                    )}
                </button>
            )}
          </div>
        </>
      )}

      {/* نافذة الاستيراد والتصدير المنبثقة */}
      {isIEOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                <h3 className="text-xl font-bold">إدارة البيانات عبر إكسيل</h3>
              </div>
              {!isImporting && (
                <button onClick={() => { setIsIEOpen(false); setImportSuccess(false); setImportProgress(0); }} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>

            <div className="p-8 space-y-8">
              {!isImporting && !importSuccess ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* قسم التصدير والنموذج */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b pb-2">التصدير والتحميل</h4>
                    <button 
                      onClick={downloadInventoryTemplate}
                      className="w-full flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Download className="w-5 h-5" />
                        <span className="font-bold">تحميل النموذج</span>
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -rotate-90" />
                    </button>

                    <button 
                      onClick={handleExport}
                      className="w-full flex items-center justify-between p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 hover:bg-emerald-100 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <FileOutput className="w-5 h-5" />
                        <span className="font-bold">تصدير الحالي</span>
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -rotate-90" />
                    </button>
                  </div>

                  {/* قسم الاستيراد */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b pb-2">الاستيراد</h4>
                    <label className="w-full flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-white hover:border-blue-400 transition-all cursor-pointer group">
                      <Upload className="w-10 h-10 text-slate-300 group-hover:text-blue-500 mb-2 transition-colors" />
                      <span className="text-sm font-bold text-slate-600 group-hover:text-blue-600">اختر ملف إكسيل</span>
                      <p className="text-[10px] text-slate-400 mt-1">.xlsx, .xls</p>
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                    </label>
                  </div>
                </div>
              ) : isImporting ? (
                <div className="py-10 space-y-6 text-center animate-in fade-in">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                    <div 
                      className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center font-black text-blue-600">
                      {importProgress}%
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-slate-800">جاري استيراد المنتجات...</h4>
                    <p className="text-sm text-slate-500">يرجى عدم إغلاق المتصفح حتى انتهاء العملية</p>
                  </div>
                  {/* شريط التقدم الأفقي */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="py-10 space-y-6 text-center animate-in zoom-in">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black text-slate-800">تمت العملية بنجاح!</h4>
                    <p className="text-slate-500 font-medium">تمت إضافة كافة الأصناف الجديدة وتحديث المخزون.</p>
                  </div>
                  <button 
                    onClick={() => { setIsIEOpen(false); setImportSuccess(false); }}
                    className="px-10 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all shadow-xl"
                  >
                    العودة للمخزن
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-center gap-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Mizan Pro Data Service</span>
              <span>Secure Import/Export</span>
            </div>
          </div>
        </div>
      )}

      {/* ذيل معلومات النظام */}
      <div className="mt-8 pt-8 border-t border-slate-200 text-center space-y-2 opacity-50">
        <p className="text-sm font-bold text-slate-600">نظام ميزان أونلاين برو • إدارة المخزون المتقدمة</p>
        <p className="text-[10px] text-slate-400">تم تحسين واجهة العرض لخدمة قواعد البيانات الضخمة (23K+)</p>
      </div>
    </div>
  );
};

export default Inventory;
