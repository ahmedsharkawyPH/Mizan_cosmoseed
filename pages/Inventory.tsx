import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch, SEARCH_CONFIG } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Brain, Sparkles,
  Command, Hash, Tag, DollarSign, Percent, Star, PlusCircle,
  FileSpreadsheet, Loader2, Download, Upload, FileOutput, TrendingUp, AlertCircle, RefreshCw, Wifi, WifiOff, Award, Save, PackagePlus,
  Edit, Trash2, FileText, ChevronRight, LayoutList, History, ArrowRightLeft, Warehouse as WarehouseIcon
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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    code: '',
    purchase_price: 0,
    selling_price: 0,
    initial_qty: 0,
    warehouse_id: ''
  });

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
        if (db.isFullyLoaded !== dbFullLoaded || db.isOffline !== isOffline) {
            loadProducts();
        }
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
    
    if (showOutOfStock) { 
      results = results.filter(p => p.batches.reduce((sum: any, b: any) => sum + b.quantity, 0) === 0); 
    }
    
    results = ArabicSmartSearch.smartSearch(results, searchQuery);
    setSearchResults(results);
  }, [searchQuery, products, showLowStock, showOutOfStock, settings.lowStockThreshold]);

  const handleExport = () => { 
    exportFilteredProductsToExcel(searchResults.length > 0 ? searchResults : products); 
    toast.success("تم تصدير البيانات بنجاح");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsImporting(true);
      try {
        const data = await readExcelFile<any>(e.target.files[0]);
        let count = 0;
        for (const item of data) {
          await db.addProduct(
            { code: item.code || item['كود الصنف'], name: item.name || item['اسم الصنف'] },
            { 
              quantity: item.quantity || item['الكمية'] || 0,
              purchase_price: item.purchase_price || item['سعر الشراء'] || 0,
              selling_price: item.selling_price || item['سعر البيع'] || 0,
              batch_number: item.batch_number || item['رقم التشغيلة'] || 'IMPORT',
              expiry_date: item.expiry_date || item['تاريخ الصلاحية'] || '2099-12-31',
              warehouse_id: warehouses.find(w => w.is_default)?.id || warehouses[0]?.id
            }
          );
          count++;
        }
        toast.success(`تم استيراد ${count} صنف بنجاح`);
        loadProducts();
        setIsIEOpen(false);
      } catch (err) {
        toast.error("فشل استيراد الملف. يرجى التأكد من الصيغة.");
      } finally {
        setIsImporting(false);
      }
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddForm.name) return toast.error("اسم الصنف مطلوب");
    
    if (editingProduct) {
        await db.updateProduct(editingProduct.id, {
            name: quickAddForm.name,
            code: quickAddForm.code,
            purchase_price: quickAddForm.purchase_price,
            selling_price: quickAddForm.selling_price
        });
        toast.success("تم تحديث الصنف بنجاح");
    } else {
        let finalCode = quickAddForm.code;
        if (!finalCode) {
          const numericCodes = products.map(p => parseInt(p.code)).filter(c => !isNaN(c));
          finalCode = (numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 1001).toString();
        }

        try {
          await db.addProduct(
            { code: finalCode, name: quickAddForm.name },
            {
              quantity: quickAddForm.initial_qty,
              purchase_price: quickAddForm.purchase_price,
              selling_price: quickAddForm.selling_price,
              batch_number: 'OPENING',
              expiry_date: '2099-12-31',
              warehouse_id: quickAddForm.warehouse_id || warehouses.find(w => w.is_default)?.id || warehouses[0]?.id
            }
          );
          toast.success("تمت إضافة الصنف بنجاح");
        } catch (err) {
          toast.error("حدث خطأ أثناء الحفظ");
          return;
        }
    }
    
    loadProducts();
    setIsAddModalOpen(false);
    setEditingProduct(null);
    setQuickAddForm({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });
  };

  const handleEditProduct = (product: any) => {
      setEditingProduct(product);
      setQuickAddForm({
          name: product.name,
          code: product.code || '',
          purchase_price: product.purchase_price || 0,
          selling_price: product.selling_price || 0,
          initial_qty: 0,
          warehouse_id: ''
      });
      setIsAddModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
      if (confirm("هل أنت متأكد من حذف هذا الصنف نهائياً؟ سيؤدي ذلك لحذف كافة التشغيلات المرتبطة به.")) {
          await db.deleteProduct(id);
          toast.success("تم حذف الصنف بنجاح");
          loadProducts();
      }
  };

  const handleViewCard = (product: any) => {
      setSelectedCardProduct(product);
      setIsCardModalOpen(true);
  };

  const displayedProducts = useMemo(() => {
    if (searchQuery.trim() || showLowStock || showOutOfStock) return searchResults;
    return products; // عرض كافة الأصناف المجلوبة
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
                        <span className="text-[10px] font-bold">جاري مزامنة الأصناف (تم جلب {products.length})...</span>
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
             <button onClick={() => { setEditingProduct(null); setIsAddModalOpen(true); setQuickAddForm({name:'', code:'', purchase_price:0, selling_price:0, initial_qty:0, warehouse_id:''}); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
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
                placeholder="🔍 ابحث في كامل المخزون... النتائج تظهر لحظياً"
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
                  <th className="px-6 py-4 text-center">إجراء</th>
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
                    onEdit={handleEditProduct}
                    onDelete={handleDeleteProduct}
                    onViewCard={handleViewCard}
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

      {/* QUICK ADD / EDIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                {editingProduct ? <Edit className="w-6 h-6 text-blue-600" /> : <PackagePlus className="w-6 h-6 text-blue-600" />}
                {editingProduct ? 'تعديل بيانات صنف' : 'إضافة صنف سريع'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">اسم الصنف *</label>
                  <input className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-bold" value={quickAddForm.name} onChange={e => setQuickAddForm({...quickAddForm, name: e.target.value})} placeholder="أدخل اسم المنتج" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">كود الصنف (اختياري)</label>
                  <input className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-mono" value={quickAddForm.code} onChange={e => setQuickAddForm({...quickAddForm, code: e.target.value})} placeholder="توليد تلقائي" />
                </div>
                {!editingProduct && (
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">المخزن</label>
                    <select className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-bold" value={quickAddForm.warehouse_id} onChange={e => setQuickAddForm({...quickAddForm, warehouse_id: e.target.value})}>
                        <option value="">اختر المخزن</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">سعر الشراء ({currency})</label>
                  <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-bold text-red-600" value={quickAddForm.purchase_price || ''} onChange={e => setQuickAddForm({...quickAddForm, purchase_price: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">سعر البيع ({currency})</label>
                  <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-bold text-blue-600" value={quickAddForm.selling_price || ''} onChange={e => setQuickAddForm({...quickAddForm, selling_price: parseFloat(e.target.value) || 0})} />
                </div>
                {!editingProduct && (
                    <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">الكمية الافتتاحية (الرصيد الحالي)</label>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-blue-500 transition-all font-black text-center text-2xl" value={quickAddForm.initial_qty || ''} onChange={e => setQuickAddForm({...quickAddForm, initial_qty: parseFloat(e.target.value) || 0})} />
                    </div>
                )}
              </div>
              <button onClick={handleQuickAdd} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Save className="w-5 h-5" /> {editingProduct ? 'تحديث بيانات الصنف' : 'حفظ الصنف الجديد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM CARD MODAL */}
      {isCardModalOpen && selectedCardProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                  <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                              <FileText className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                              <h3 className="text-xl font-black">{selectedCardProduct.name}</h3>
                              <p className="text-slate-400 text-xs font-mono">#{selectedCardProduct.code}</p>
                          </div>
                      </div>
                      <button onClick={() => setIsCardModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <WarehouseIcon className="w-4 h-4" /> الأرصدة الحالية في المخازن
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {warehouses.map(w => {
                                  const qty = selectedCardProduct.batches.filter((b:any) => b.warehouse_id === w.id).reduce((s:number, b:any) => s + b.quantity, 0);
                                  return (
                                      <div key={w.id} className="p-4 rounded-2xl border-2 border-slate-100 flex justify-between items-center group hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                                          <span className="font-bold text-slate-600">{w.name}</span>
                                          <span className={`font-black text-lg ${qty > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{qty}</span>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                      <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <History className="w-4 h-4" /> سجل حركات الصنف (الوارد والصادر)
                          </h4>
                          <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                              <table className="w-full text-xs text-right">
                                  <thead className="bg-white border-b border-slate-200 text-slate-500 font-black uppercase">
                                      <tr>
                                          <th className="p-4">التاريخ</th>
                                          <th className="p-4">نوع الحركة</th>
                                          <th className="p-4 text-center">الكمية</th>
                                          <th className="p-4">المخزن</th>
                                          <th className="p-4">المرجع</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                      {db.getProductMovements(selectedCardProduct.id).map((m:any) => (
                                          <tr key={m.id} className="hover:bg-white transition-colors">
                                              <td className="p-4 text-slate-500 font-mono">{new Date(m.date).toLocaleDateString()}</td>
                                              <td className="p-4">
                                                  <span className={`inline-flex items-center gap-1.5 font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                      {m.quantity > 0 ? <ArrowRightLeft className="w-3 h-3 rotate-45" /> : <ArrowRightLeft className="w-3 h-3 -rotate-45" />}
                                                      {t(`stock.movement.${m.type}`) || m.type}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-center font-black">{Math.abs(m.quantity)}</td>
                                              <td className="p-4 font-bold text-slate-600">{warehouses.find(w => w.id === m.warehouse_id)?.name || '---'}</td>
                                              <td className="p-4 text-slate-400 font-mono">{m.reference_id || '---'}</td>
                                          </tr>
                                      ))}
                                      {db.getProductMovements(selectedCardProduct.id).length === 0 && (
                                          <tr><td colSpan={5} className="p-10 text-center text-slate-300 font-bold">لا يوجد حركات مسجلة لهذا الصنف</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>

                  <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-3">
                      <button onClick={() => setIsCardModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">إغلاق</button>
                  </div>
              </div>
          </div>
      )}

      {/* IMPORT/EXPORT MODAL */}
      {isIEOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" /> استيراد وتصدير الأصناف
              </h3>
              <button onClick={() => setIsIEOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <button onClick={downloadInventoryTemplate} className="w-full p-4 border-2 border-slate-100 rounded-2xl flex items-center justify-between hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors"><Download className="w-5 h-5" /></div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700">تحميل نموذج الإكسيل</p>
                    <p className="text-xs text-slate-400">ملف فارغ بالأعمدة المطلوبة</p>
                  </div>
                </div>
              </button>

              <button onClick={handleExport} className="w-full p-4 border-2 border-slate-100 rounded-2xl flex items-center justify-between hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors"><FileOutput className="w-5 h-5" /></div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700">تصدير الأصناف الحالية</p>
                    <p className="text-xs text-slate-400">تصدير {searchResults.length || products.length} صنف</p>
                  </div>
                </div>
              </button>

              <div className="relative pt-4 border-t border-slate-100">
                <label className={`w-full p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${isImporting ? 'bg-slate-50 border-slate-200 opacity-50' : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50'}`}>
                  {isImporting ? <Loader2 className="w-8 h-8 text-blue-600 animate-spin" /> : <Upload className="w-8 h-8 text-slate-400" />}
                  <div className="text-center">
                    <p className="font-bold text-slate-700">رفع ملف الأصناف</p>
                    <p className="text-xs text-slate-400">اختر ملف Excel من جهازك</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} disabled={isImporting} />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductRow = React.memo(({ product, searchQuery, currency, bestSupplier, onEdit, onDelete, onViewCard }: { product: any; searchQuery: string; currency: string; bestSupplier: string; onEdit: (p:any)=>void; onDelete: (id:string)=>void; onViewCard: (p:any)=>void; }) => {
  const totalQty = product.batches?.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0) || 0;
  
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
      <td className="px-6 py-4 text-center">
          <div className="flex justify-center gap-2">
              <button 
                onClick={() => onViewCard(product)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                title="كارت الصنف"
              >
                  <FileText className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onEdit(product)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                title="تعديل"
              >
                  <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onDelete(product.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="حذف"
              >
                  <Trash2 className="w-4 h-4" />
              </button>
          </div>
      </td>
    </tr>
  );
});

export default Inventory;