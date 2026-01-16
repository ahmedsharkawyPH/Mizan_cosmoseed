
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { 
  PlusCircle, Search, Package, FileOutput, ChevronDown, Loader2
} from 'lucide-react';
import { exportAllProductsToExcel } from '../utils/excel';

const PAGE_SIZE = 50; 

const Inventory: React.FC = () => {
  const [products, setProducts] = useState(db.getProductsWithBatches());
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  
  const settings = db.getSettings();
  const currency = settings.currency;

  useEffect(() => {
    const load = async () => {
        setIsLoading(true);
        // محاكاة تحميل بسيط لضمان سلاسة الواجهة
        setProducts(db.getProductsWithBatches());
        setIsLoading(false);
    };
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  // الأصناف التي ستظهر فعلياً في الصفحة (تجزئة لضمان أداء المتصفح)
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setVisibleCount(PAGE_SIZE); // إعادة تصفير العداد عند البحث الجديد
  };

  const loadMore = () => {
      setVisibleCount(prev => prev + PAGE_SIZE);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" /> {t('stock.title')}
            </h1>
            <p className="text-slate-500 text-sm mt-1">إجمالي الأصناف المتوفرة: <span className="font-bold text-blue-600">{products.length.toLocaleString()}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button onClick={() => exportAllProductsToExcel(products)} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
                <FileOutput className="w-4 h-4" /> تصدير
            </button>
            <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
                <PlusCircle className="w-5 h-5" />{t('stock.new')}
            </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 sticky top-0 z-10">
          <div className="relative w-full max-w-2xl">
             <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
             <input 
                type="text" 
                placeholder="بحث سريع في كافة الأصناف (بالاسم أو الكود)..." 
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition-all text-lg" 
                value={searchTerm} 
                onChange={handleSearchChange} 
             />
          </div>
      </div>

      {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 font-bold">جاري معالجة قاعدة البيانات...</p>
          </div>
      ) : (
          <div className="grid gap-4 md:grid-cols-1">
            {displayedProducts.map(product => {
              const totalQty = product.batches.reduce((sum, b) => sum + b.quantity, 0);
              return (
                <div key={product.id} className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden hover:border-blue-200 transition-all group">
                    <div className="px-6 py-4 flex justify-between items-center bg-slate-50/50 border-b group-hover:bg-blue-50/30 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center font-black text-xl shadow-sm">
                                {product.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">{product.name}</h3>
                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{product.code}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">إجمالي الرصيد</p>
                            <span className={`text-2xl font-black ${totalQty <= 10 ? 'text-red-600' : 'text-slate-800'}`}>{totalQty.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {product.batches.map(b => (
                            <div key={b.id} className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                                <p className="text-[10px] text-slate-400 font-bold truncate">{b.batch_number}</p>
                                <p className="font-black text-blue-600 text-sm">{currency}{b.selling_price.toLocaleString()}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs text-slate-500">الكمية:</span>
                                    <span className="text-xs font-bold text-slate-700">{b.quantity}</span>
                                </div>
                            </div>
                        ))}
                        {product.batches.length === 0 && (
                            <div className="col-span-full py-2 text-center text-slate-400 text-xs italic">
                                لا توجد تشغيلات متوفرة حالياً لهذا الصنف
                            </div>
                        )}
                    </div>
                </div>
              );
            })}
          </div>
      )}

      {!isLoading && displayedProducts.length === 0 && (
          <div className="py-20 text-center text-slate-400">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-bold">لم يتم العثور على نتائج للبحث</p>
          </div>
      )}

      {/* زر تحميل المزيد - ضروري للأداء مع 23,000 صنف */}
      {!isLoading && visibleCount < filteredProducts.length && (
          <div className="flex justify-center pt-8">
              <button 
                onClick={loadMore}
                className="flex items-center gap-3 px-10 py-4 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all shadow-xl active:scale-95"
              >
                  <ChevronDown className="w-6 h-6 animate-bounce" />
                  عرض المزيد ({filteredProducts.length - visibleCount} صنف متبقي)
              </button>
          </div>
      )}
    </div>
  );
};
export default Inventory;
