
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Hash, Tag, PlusCircle,
  FileSpreadsheet, Loader2, Award, PackagePlus, EyeOff, ChevronLeft, ChevronRight, FileDown, CheckCircle2
} from 'lucide-react';
import { exportInventoryToExcel } from '../utils/excel';
// @ts-ignore
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 50;

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbFullLoaded, setDbFullLoaded] = useState(db.isFullyLoaded);
  const [isOffline, setIsOffline] = useState(db.isOffline);
  
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // خيارات التصدير
  const [exportOptions, setExportOptions] = useState({
      warehouseId: 'ALL',
      onlyInStock: false
  });

  const [quickAddForm, setQuickAddForm] = useState({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });

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
  }, [loadProducts, dbFullLoaded]);

  const bestSuppliersMap = useMemo(() => {
    const purchaseInvoices = db.getPurchaseInvoices() || [];
    const suppliers = db.getSuppliers() || [];
    const map: Record<string, string> = {};
    const bestPrices: Record<string, number> = {};
    const sortedInvoices = [...purchaseInvoices].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sortedInvoices.forEach(inv => {
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
  }, [dbFullLoaded, products.length]);

  const allFilteredProducts = useMemo(() => {
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

  const totalPages = Math.ceil(allFilteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allFilteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [allFilteredProducts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedWarehouseFilter, hideZeroStock, showLowStock, showOutOfStock]);

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

  const handleExportExcel = () => {
      const toastId = toast.loading("جاري تحضير ملف الإكسيل...");
      
      // منطق الفلترة للتصدير
      const exportData: any[] = [];
      products.forEach(p => {
          const pBatches = p.batches || [];
          const filteredBatches = exportOptions.warehouseId === 'ALL' 
            ? pBatches 
            : pBatches.filter((b: any) => b.warehouse_id === exportOptions.warehouseId);
          
          const totalQty = filteredBatches.reduce((s: number, b: any) => s + b.quantity, 0);
          
          if (exportOptions.onlyInStock && totalQty <= 0) return;

          // إذا اخترنا كل المخازن، نجمع الرصيد في سطر واحد أو نفصله حسب الرغبة
          // هنا سنقوم بتصدير سطر لكل مخزن يتواجد به الصنف ليكون التقرير دقيقاً
          if (filteredBatches.length > 0) {
              filteredBatches.forEach((b: any) => {
                  if (exportOptions.onlyInStock && b.quantity <= 0) return;
                  exportData.push({
                      "كود الصنف": p.code || '---',
                      "اسم الصنف": p.name,
                      "المخزن": warehouses.find(w => w.id === b.warehouse_id)?.name || 'غير معروف',
                      "الرصيد": b.quantity,
                      "سعر التكلفة": b.purchase_price,
                      "سعر البيع": b.selling_price
                  });
              });
          } else if (!exportOptions.onlyInStock) {
              // إضافة الأصناف التي ليس لها أرصدة في المخزن المحدد
              exportData.push({
                  "كود الصنف": p.code || '---',
                  "اسم الصنف": p.name,
                  "المخزن": exportOptions.warehouseId === 'ALL' ? 'كافة المخازن' : warehouses.find(w => w.id === exportOptions.warehouseId)?.name,
                  "الرصيد": 0,
                  "سعر التكلفة": p.purchase_price || 0,
                  "سعر البيع": p.selling_price || 0
              });
          }
      });

      if (exportData.length === 0) {
          toast.error("لا توجد بيانات مطابقة لخيارات التصدير", { id: toastId });
          return;
      }

      exportInventoryToExcel(exportData, exportOptions.warehouseId === 'ALL' ? 'Full_Inventory' : 'Warehouse_Inventory');
      toast.success("تم استخراج الملف بنجاح", { id: toastId });
      setIsExportModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div><h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><Package className="w-8 h-8 text-blue-600" /> {t('stock.title')}</h1></div>
           <div className="flex flex-wrap gap-2">
             <button 
                onClick={() => setIsExportModalOpen(true)}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
             >
                <FileDown className="w-5 h-5" /> تصدير إكسيل
             </button>
             <button id="btn_new_product" name="btn_new_product" onClick={() => { setIsAddModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><PlusCircle className="w-5 h-5" /> {t('stock.new')}</button>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
          <div className="relative group mb-4">
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
                <div className="flex gap-2">
                    <button 
                       onClick={() => setShowLowStock(!showLowStock)} 
                       className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showLowStock ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                      نواقص
                    </button>
                    <button 
                       onClick={() => setShowOutOfStock(!showOutOfStock)} 
                       className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showOutOfStock ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                      نفذت
                    </button>
                </div>
                <div className="mr-auto text-xs font-bold text-slate-400">
                  عرض {paginatedProducts.length} من أصل {allFilteredProducts.length} صنف
                </div>
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
                  <th className="px-6 py-4 text-center">الرصيد المتاح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{product.name}</div>
                    </td>
                    <td className="px-6 py-4 text-center"><code className="text-[11px] font-mono text-slate-400">{product.code || '---'}</code></td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                        <Award className="w-3 h-3" />{bestSuppliersMap[product.id] || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center"><span className="font-bold text-blue-600 font-mono">{currency}{(product.batches?.[0]?.selling_price || product.selling_price || 0).toLocaleString()}</span></td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg font-black text-sm ${(product.batches?.reduce((s:number, b:any) => s+b.quantity,0) || 0) <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {selectedWarehouseFilter === 'ALL' ? (product.batches?.reduce((s:number, b:any) => s+b.quantity, 0) || 0) : (product.batches?.find((b:any) => b.warehouse_id === selectedWarehouseFilter)?.quantity || 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-4">
               <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"
               >
                 <ChevronRight className="w-5 h-5" />
               </button>
               
               <div className="flex gap-1">
                 {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                   let pageNum = currentPage;
                   if (currentPage <= 3) pageNum = i + 1;
                   else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                   else pageNum = currentPage - 2 + i;
                   
                   if (pageNum <= 0 || pageNum > totalPages) return null;

                   return (
                     <button
                       key={pageNum}
                       onClick={() => setCurrentPage(pageNum)}
                       className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                     >
                       {pageNum}
                     </button>
                   );
                 })}
               </div>

               <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"
               >
                 <ChevronLeft className="w-5 h-5" />
               </button>
            </div>
          )}
        </div>
      </div>

      {/* مودال خيارات التصدير */}
      {isExportModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                  <div className="bg-emerald-600 p-6 flex justify-between items-center text-white">
                      <h3 className="text-xl font-black flex items-center gap-3">
                        <FileSpreadsheet className="w-6 h-6" /> خيارات تصدير المخزون
                      </h3>
                      <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                      <div>
                          <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">تصدير بيانات المخزن:</label>
                          <select 
                            className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold focus:border-emerald-500 outline-none transition-all"
                            value={exportOptions.warehouseId}
                            onChange={e => setExportOptions({...exportOptions, warehouseId: e.target.value})}
                          >
                              <option value="ALL">-- كل المخازن المتاحة --</option>
                              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                      </div>

                      <div className="space-y-3">
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">نوع الأصناف المطلوبة:</label>
                          <div className="grid grid-cols-1 gap-3">
                              <button 
                                onClick={() => setExportOptions({...exportOptions, onlyInStock: false})}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${!exportOptions.onlyInStock ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                              >
                                  <span className="font-black">كافة الأصناف (بدون استثناء)</span>
                                  {!exportOptions.onlyInStock && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                              </button>
                              <button 
                                onClick={() => setExportOptions({...exportOptions, onlyInStock: true})}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${exportOptions.onlyInStock ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                              >
                                  <span className="font-black">الأصناف المتوفرة فقط (رصيد &gt; 0)</span>
                                  {exportOptions.onlyInStock && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                              </button>
                          </div>
                      </div>

                      <div className="pt-4">
                          <button 
                            onClick={handleExportExcel}
                            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                          >
                            <FileDown className="w-6 h-6" />
                            بدء التصدير وتحميل الملف
                          </button>
                          <p className="text-[10px] text-center text-slate-400 font-bold mt-4 uppercase">سيتم إنشاء ملف Excel متوافق مع كافة البرامج المكتبية</p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                  <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-800">إضافة صنف جديد</h3>
                      <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-8 grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                          <label className="block text-sm font-bold text-slate-700 mb-1">اسم الصنف *</label>
                          <input className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={quickAddForm.name} onChange={e => setQuickAddForm({...quickAddForm, name: e.target.value})} autoFocus />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">الكود</label>
                          <input className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono" value={quickAddForm.code} onChange={e => setQuickAddForm({...quickAddForm, code: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">الرصيد الافتتاحي</label>
                          <input type="number" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={quickAddForm.initial_qty} onChange={e => setQuickAddForm({...quickAddForm, initial_qty: parseInt(e.target.value) || 0})} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">سعر الشراء</label>
                          <input type="number" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-red-600" value={quickAddForm.purchase_price} onChange={e => setQuickAddForm({...quickAddForm, purchase_price: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">سعر البيع</label>
                          <input type="number" className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-emerald-600" value={quickAddForm.selling_price} onChange={e => setQuickAddForm({...quickAddForm, selling_price: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div className="col-span-2 pt-4">
                          <button onClick={handleSaveProduct} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all">حفظ البيانات</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Inventory;
