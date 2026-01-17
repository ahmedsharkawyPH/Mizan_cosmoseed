
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { 
  PlusCircle, Search, Package, FileOutput, Loader2,
  X, Download, Upload, FileSpreadsheet, History, 
  DollarSign, AlertCircle, TrendingUp, Tag
} from 'lucide-react';
import { exportFilteredProductsToExcel, readExcelFile, downloadInventoryTemplate } from '../utils/excel';

const PERFORMANCE_CONFIG = {
  INITIAL_LOAD: 100,           
  SEARCH_DEBOUNCE: 300,        
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
  const [loadMoreLock, setLoadMoreLock] = useState(false);
  
  const [isIEOpen, setIsIEOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'totalStock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const settings = db.getSettings();
  const currency = settings.currency;
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // حساب الإحصائيات العامة للمخزون
  const inventoryStats = useMemo(() => {
    const allProducts = db.getProductsWithBatches();
    let totalValue = 0;
    let negativeCount = 0;
    
    allProducts.forEach(p => {
        const totalQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
        if (totalQty < 0) negativeCount++;
        
        p.batches.forEach(b => {
            if (b.quantity > 0) {
                totalValue += (b.quantity * b.purchase_price);
            }
        });
    });
    
    return {
        totalItems: allProducts.length,
        negativeCount,
        totalValue
    };
  }, [data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); 
    }, PERFORMANCE_CONFIG.SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchProducts = useCallback(async (isInitial = false) => {
    if (loadMoreLock && !isInitial) return;
    if (isInitial) setIsLoading(true);
    else setLoadMoreLock(true);

    try {
      const result = db.getProductsPaginated({
        page: isInitial ? 1 : page + 1,
        pageSize: PERFORMANCE_CONFIG.INITIAL_LOAD,
        search: debouncedSearch,
        filters: { lowStockOnly: showLowStock, outOfStockOnly: showOutOfStock },
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
    }
  }, [debouncedSearch, page, showLowStock, showOutOfStock, sortBy, sortOrder, loadMoreLock]);

  useEffect(() => {
    fetchProducts(true);
  }, [debouncedSearch, showLowStock, showOutOfStock, sortBy, sortOrder]);

  useEffect(() => {
    if (!loadMoreRef.current || isLoading || !data.hasMore) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadMoreLock) fetchProducts();
      },
      { threshold: 0.1 }
    );
    observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [isLoading, loadMoreLock, data.hasMore, fetchProducts]);

  const handleExport = () => {
    const fullResult = db.getProductsPaginated({
        page: 1, pageSize: 100000, search: debouncedSearch,
        filters: { lowStockOnly: showLowStock, outOfStockOnly: showOutOfStock }
    });
    exportFilteredProductsToExcel(fullResult.products);
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
      fetchProducts(true);
    } catch (error) {
      alert("خطأ أثناء الاستيراد");
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-32 animate-in fade-in duration-500">
      {/* رأس الصفحة والبطاقات الإحصائية */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" /> 
              {t('stock.title')}
            </h1>
            <p className="text-slate-500 text-sm mt-1">إدارة الأصناف وتتبع الأرصدة والأسعار</p>
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

        {/* بطاقات الإحصاء الصغيرة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي الأصناف</p>
              <h4 className="text-lg font-black text-slate-800">{inventoryStats.totalItems}</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">أصناف سالبة</p>
              <h4 className="text-lg font-black text-red-600">{inventoryStats.negativeCount}</h4>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">قيمة المخزون (شراء)</p>
              <h4 className="text-lg font-black text-emerald-600">{currency}{inventoryStats.totalValue.toLocaleString()}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 sticky top-0 z-10 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-3.5 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="ابحث باسم الصنف أو الكود..."
            className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-all text-lg"
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button onClick={() => setShowLowStock(!showLowStock)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showLowStock ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>نواقص</button>
                <button onClick={() => setShowOutOfStock(!showOutOfStock)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showOutOfStock ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>منتهي</button>
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none font-bold text-sm">
                <option value="name">ترتيب بالاسم</option>
                <option value="code">بالكود</option>
                <option value="totalStock">بالرصيد</option>
            </select>
        </div>
      </div>

      {isLoading && data.products.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-700 font-bold">جاري تحميل البيانات...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data.products.map(product => {
            const totalQty = product.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
            // جلب أحدث أسعار من التشغيلات أو الأسعار الافتراضية
            const purchasePrice = product.batches.length > 0 ? product.batches[product.batches.length - 1].purchase_price : (product.purchase_price || 0);
            const sellingPrice = product.batches.length > 0 ? product.batches[product.batches.length - 1].selling_price : (product.selling_price || 0);

            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group">
                <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${totalQty <= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>{product.name.charAt(0)}</div>
                    <div>
                      <h3 className="font-black text-slate-800 text-lg">{product.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">{product.code}</p>
                    </div>
                  </div>

                  {/* قسم الأسعار المضاف */}
                  <div className="flex gap-8 px-4 border-r border-l border-slate-50">
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-black uppercase flex items-center gap-1 justify-center">
                           <TrendingUp className="w-3 h-3 text-emerald-500" /> سعر الشراء
                        </p>
                        <span className="text-sm font-black text-slate-600">{currency}{purchasePrice.toLocaleString()}</span>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-black uppercase flex items-center gap-1 justify-center">
                           <Tag className="w-3 h-3 text-blue-500" /> سعر البيع
                        </p>
                        <span className="text-sm font-black text-blue-600">{currency}{sellingPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-right min-w-[100px]">
                    <p className="text-[10px] text-slate-400 font-black uppercase">الرصيد الكلي</p>
                    <span className={`text-2xl font-black ${totalQty <= 0 ? 'text-red-500' : 'text-slate-800'}`}>{totalQty.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.hasMore && (
          <div className="flex justify-center py-8">
              <button ref={loadMoreRef} onClick={() => fetchProducts()} className="px-8 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all">
                  عرض المزيد
              </button>
          </div>
      )}

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
