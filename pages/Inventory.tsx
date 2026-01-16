
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { 
  PlusCircle, RotateCcw, ArrowRightLeft, X, PackagePlus, Search, 
  Trash2, AlertTriangle, Package, Calendar, Hash, ShoppingBag, 
  Download, FileSpreadsheet, Loader2, Edit2, Save, FileOutput, 
  Info, DollarSign, BarChart3, ChevronRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Batch, Product, ProductWithBatches } from '../types';
import { readExcelFile, downloadInventoryTemplate, exportAllProductsToExcel } from '../utils/excel';

const StatMiniCard = ({ title, value, icon: Icon, color, isCurrency = false }: any) => {
    const currency = db.getSettings().currency;
    return (
        <div className="bg-white p-5 rounded-2xl shadow-card border border-slate-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className={`p-3 rounded-xl ${color} bg-opacity-10 ${color.replace('bg-', 'text-')}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                <h3 className="text-xl font-black text-slate-800">
                    {isCurrency ? `${currency}${value.toLocaleString()}` : value.toLocaleString()}
                </h3>
            </div>
        </div>
    );
};

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState(db.getProductsWithBatches());
  const warehouses = db.getWarehouses();
  const settings = db.getSettings();
  const currency = settings.currency;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [isImporting, setIsImporting] = useState(false);

  // Quick Edit State
  const [editModal, setEditModal] = useState<{ isOpen: boolean; batch: Batch | null; product: Product | null }>({ isOpen: false, batch: null, product: null });
  const [editForm, setEditForm] = useState({ purchase_price: 0, selling_price: 0, quantity: 0 });

  const [transferModal, setTransferModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [transferQty, setTransferQty] = useState(0);
  const [targetWarehouse, setTargetWarehouse] = useState('');

  const [spoilageModal, setSpoilageModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [damagedQty, setDamagedQty] = useState(0);
  const [reason, setReason] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ 
    code: '', 
    name: '', 
    quantity: 0, 
    purchase_price: 0, 
    selling_price: 0,
    batch_number: 'AUTO',
    expiry_date: '2099-12-31'
  });

  useEffect(() => {
    if (location.state && (location.state as any).openAdd) setIsAddOpen(true);
  }, [location]);

  // Inventory Totals Logic
  const inventoryStats = useMemo(() => {
      let totalQty = 0;
      let totalCostValue = 0;
      let lowStockCount = 0;
      const threshold = settings.lowStockThreshold || 10;

      products.forEach(p => {
          const pQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
          totalQty += pQty;
          p.batches.forEach(b => {
              totalCostValue += (b.quantity * b.purchase_price);
          });
          if (pQty < threshold) lowStockCount++;
      });

      return { totalSkus: products.length, totalQty, totalCostValue, lowStockCount };
  }, [products, settings.lowStockThreshold]);

  const handleManualAdd = async () => {
      if(!addForm.name || !addForm.code) return alert("يرجى ملء الحقول المطلوبة");
      await db.addProduct(
        { code: String(addForm.code), name: addForm.name }, 
        { 
          quantity: addForm.quantity, 
          purchase_price: addForm.purchase_price, 
          selling_price: addForm.selling_price,
          batch_number: addForm.batch_number,
          expiry_date: addForm.expiry_date
        }
      );
      setProducts(db.getProductsWithBatches());
      setIsAddOpen(false);
      setAddForm({ code: '', name: '', quantity: 0, purchase_price: 0, selling_price: 0, batch_number: 'AUTO', expiry_date: '2099-12-31' });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsImporting(true);
    try {
      const data = await readExcelFile<any>(e.target.files[0]);
      for (const row of data) {
          if (row.name && row.code) {
            await db.addProduct(
              { code: String(row.code), name: String(row.name), selling_price: Number(row.selling_price) || 0, purchase_price: Number(row.purchase_price) || 0 },
              row.quantity > 0 ? { quantity: Number(row.quantity), purchase_price: Number(row.purchase_price) || 0, selling_price: Number(row.selling_price) || 0, batch_number: String(row.batch_number || 'AUTO'), expiry_date: row.expiry_date || '2099-12-31' } : undefined
            );
          }
      }
      await db.init();
      setProducts(db.getProductsWithBatches());
      alert(`تم استيراد البيانات بنجاح.`);
    } catch (err) {
      alert("حدث خطأ أثناء الاستيراد.");
    } finally {
      setIsImporting(false);
      e.target.value = ''; 
    }
  };

  const openQuickEdit = (item: Batch | Product, isProduct: boolean = false) => {
      if (isProduct) {
          const p = item as Product;
          setEditForm({ purchase_price: p.purchase_price || 0, selling_price: p.selling_price || 0, quantity: 0 });
          setEditModal({ isOpen: true, batch: null, product: p });
      } else {
          const b = item as Batch;
          setEditForm({ purchase_price: b.purchase_price, selling_price: b.selling_price, quantity: b.quantity });
          setEditModal({ isOpen: true, batch: b, product: null });
      }
  };

  const handleQuickSave = async () => {
      if (editModal.batch) {
          await db.updateBatchPrices(editModal.batch.id, editForm.purchase_price, editForm.selling_price, editForm.quantity);
      } else if (editModal.product) {
          await db.updateProductPrices(editModal.product.id, editForm.purchase_price, editForm.selling_price);
      }
      setProducts(db.getProductsWithBatches());
      setEditModal({ isOpen: false, batch: null, product: null });
  };

  const filteredProducts = useMemo(() => {
      return products.filter(p => {
          const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase());
          const totalQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
          
          if (!matchesSearch) return false;
          if (filterType === 'LOW') return totalQty > 0 && totalQty < settings.lowStockThreshold;
          if (filterType === 'OUT') return totalQty <= 0;
          return true;
      });
  }, [products, searchTerm, filterType, settings.lowStockThreshold]);

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                {t('stock.title')}
            </h1>
            <p className="text-slate-500 font-medium">إدارة الأصناف، التشغيلات، والتحويلات المخزنية</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button onClick={() => exportAllProductsToExcel(products)} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all hover:bg-indigo-700 active:scale-95">
                <FileOutput className="w-4 h-4" /> <span className="hidden sm:inline">تصدير إكسيل</span>
            </button>
            <button onClick={downloadInventoryTemplate} className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all hover:bg-slate-50 shadow-sm">
                <Download className="w-4 h-4 text-blue-500" /> <span className="hidden sm:inline">النموذج</span>
            </button>
            <label className={`cursor-pointer bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all hover:bg-emerald-700 active:scale-95 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                <span className="hidden sm:inline">{isImporting ? `جاري الرفع...` : t('stock.import')}</span>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={isImporting} />
            </label>
            <button onClick={() => setIsAddOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95">
                <PlusCircle className="w-5 h-5" />{t('stock.new')}
            </button>
        </div>
      </div>

      {/* 2. Summary Dashboard Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatMiniCard title="إجمالي الأصناف" value={inventoryStats.totalSkus} icon={Package} color="bg-blue-600" />
          <StatMiniCard title="رصيد الوحدات" value={inventoryStats.totalQty} icon={Hash} color="bg-indigo-600" />
          <StatMiniCard title="قيمة المخزون (تكلفة)" value={inventoryStats.totalCostValue} icon={DollarSign} color="bg-emerald-600" isCurrency />
          <StatMiniCard title="أصناف وصلت للحد الأدنى" value={inventoryStats.lowStockCount} icon={AlertTriangle} color="bg-rose-600" />
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:max-w-md">
             <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
             <input 
                type="text" 
                placeholder="بحث باسم الصنف أو الكود..." 
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-inner bg-slate-50 transition-all" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
             />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl w-full lg:w-auto overflow-x-auto shrink-0">
                <button 
                    onClick={() => setFilterType('ALL')}
                    className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterType === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    الكل
                </button>
                <button 
                    onClick={() => setFilterType('LOW')}
                    className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterType === 'LOW' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <AlertTriangle className="w-4 h-4" /> النواقص
                </button>
                <button 
                    onClick={() => setFilterType('OUT')}
                    className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${filterType === 'OUT' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <AlertCircle className="w-4 h-4" /> نفذت
                </button>
          </div>
      </div>

      {/* 4. Products List Rendering */}
      <div className="grid gap-6">
        {filteredProducts.length > 0 ? filteredProducts.map(product => {
          const totalQty = product.batches.reduce((sum, b) => sum + b.quantity, 0);
          const isLow = totalQty > 0 && totalQty < settings.lowStockThreshold;
          const isOut = totalQty <= 0;

          return (
            <div key={product.id} className={`bg-white rounded-2xl shadow-card border transition-all duration-300 overflow-hidden hover:shadow-xl ${isOut ? 'border-rose-100' : isLow ? 'border-amber-100' : 'border-slate-100'}`}>
                {/* Product Header Row */}
                <div className={`px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isOut ? 'bg-rose-50/30' : isLow ? 'bg-amber-50/30' : 'bg-slate-50/50'} border-b`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${isOut ? 'bg-rose-100 text-rose-600' : isLow ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {product.name.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-slate-800">{product.name}</h3>
                                {isOut ? (
                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">نفذت الكمية</span>
                                ) : isLow ? (
                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">رصيد منخفض</span>
                                ) : (
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">متوفر</span>
                                )}
                            </div>
                            <span className="text-xs font-mono text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded mt-1 inline-block">{product.code}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-none pt-4 md:pt-0">
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">السعر الافتراضي</p>
                            <div className="flex items-center gap-2 justify-end">
                                <span className="text-lg font-black text-emerald-600">{currency}{product.selling_price || 0}</span>
                                <button onClick={() => openQuickEdit(product, true)} className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 transition-all">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="text-right bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">إجمالي الرصيد</p>
                            <span className={`text-2xl font-black ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                                {totalQty}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Batches Table */}
                {product.batches.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left rtl:text-right">
                            <thead className="bg-slate-50/50 text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-3">{t('stock.warehouse')}</th>
                                    <th className="px-6 py-3 text-center">{t('stock.batch')}</th>
                                    <th className="px-6 py-3 text-right">{t('stock.cost')}</th>
                                    <th className="px-6 py-3 text-right">{t('stock.price')}</th>
                                    <th className="px-6 py-3 text-right">{t('stock.qty')}</th>
                                    <th className="px-6 py-3 text-center">{t('common.action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {product.batches.map(batch => (
                                <tr key={batch.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 font-bold text-blue-700">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                            {warehouses.find(w => w.id === batch.warehouse_id)?.name || 'مخزن غير معروف'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-xs text-slate-500 uppercase">{batch.batch_number}</td>
                                    <td className="px-6 py-4 text-right text-slate-400 font-mono">{currency}{batch.purchase_price}</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-700">{currency}{batch.selling_price}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-3 py-1 rounded-lg font-black text-sm ${batch.quantity <= 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-800'}`}>
                                            {batch.quantity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openQuickEdit(batch)} className="text-blue-600 p-2 rounded-lg hover:bg-blue-50" title="تعديل سريع"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => { setTransferQty(0); setTargetWarehouse(''); setTransferModal({ isOpen: true, batch }); }} className="text-indigo-600 p-2 rounded-lg hover:bg-indigo-50" title="تحويل مخزني"><ArrowRightLeft className="w-4 h-4" /></button>
                                            <button onClick={() => { setDamagedQty(0); setReason(''); setSpoilageModal({ isOpen: true, batch }); }} className="text-rose-600 p-2 rounded-lg hover:bg-rose-50" title="تبليغ تالف"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center bg-slate-50/30 flex flex-col items-center justify-center">
                        <ShoppingBag className="w-10 h-10 text-slate-200 mb-2" />
                        <p className="text-slate-400 font-medium">لا يوجد مخزون حالي لهذا الصنف</p>
                    </div>
                )}
            </div>
          );
        }) : (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">لم يتم العثور على نتائج</h3>
                <p className="text-slate-400 mt-2">جرب البحث بكلمات مختلفة أو تغيير التصفية</p>
            </div>
        )}
      </div>

      {/* --- Modals Stay the same logic-wise but with polished CSS --- */}
      
      {/* Quick Edit Prices Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b bg-blue-600 text-white font-bold">
                    <h3 className="flex items-center gap-2"><Edit2 className="w-5 h-5" /> {editModal.product ? 'تعديل أسعار الصنف' : 'تعديل التشغيلة'}</h3>
                    <button onClick={() => setEditModal({isOpen: false, batch: null, product: null})} className="hover:rotate-90 transition-transform"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">سعر التكلفة</label>
                        <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-xl font-black bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all" value={editForm.purchase_price} onChange={e => setEditForm({...editForm, purchase_price: +e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">سعر البيع</label>
                        <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-xl font-black text-blue-600 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all" value={editForm.selling_price} onChange={e => setEditForm({...editForm, selling_price: +e.target.value})} />
                    </div>
                    {editModal.batch && (
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">تعديل الرصيد يدوياً</label>
                            <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-xl font-black text-emerald-600 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all" value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: +e.target.value})} />
                        </div>
                    )}
                    <button onClick={handleQuickSave} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95">
                        <Save className="w-5 h-5" /> حفظ التغييرات
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-between items-center p-6 border-b bg-slate-900 text-white font-bold shrink-0">
                      <h3 className="flex items-center gap-2"><PackagePlus className="w-6 h-6 text-blue-400" /> {t('prod.new_title')}</h3>
                      <button onClick={() => setIsAddOpen(false)} className="hover:rotate-90 transition-transform"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                      <div className="bg-blue-50 p-4 rounded-2xl flex items-start gap-3 text-blue-700 text-sm mb-2 border border-blue-100">
                          <Info className="w-5 h-5 mt-0.5 shrink-0" />
                          <p>يمكنك تعريف الصنف بأسعاره فقط وترك الرصيد (صفر) إذا لم يكن لديك مخزون حالي. سيتم إضافة الرصيد لاحقاً عبر فواتير المشتريات.</p>
                      </div>
                      <div>
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">{t('prod.name')} *</label>
                          <input className="w-full border-2 border-slate-100 p-3 rounded-xl focus:border-blue-500 outline-none font-bold transition-all" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="مثال: مشروب غازي 250 مل" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">{t('prod.code')} *</label>
                            <input className="w-full border-2 border-slate-100 p-3 rounded-xl font-mono uppercase focus:border-blue-500 outline-none transition-all" value={addForm.code} onChange={e => setAddForm({...addForm, code: e.target.value})} placeholder="P-001" />
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">رصيد ابتدائي</label>
                            <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-xl font-black text-emerald-600 focus:border-blue-500 outline-none transition-all" value={addForm.quantity} onChange={e => setAddForm({...addForm, quantity: +e.target.value})} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">{t('stock.cost')}</label>
                            <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-xl focus:border-blue-500 outline-none font-bold transition-all" value={addForm.purchase_price} onChange={e => setAddForm({...addForm, purchase_price: +e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">{t('stock.price')}</label>
                            <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-xl font-black text-blue-600 focus:border-blue-500 outline-none transition-all" value={addForm.selling_price} onChange={e => setAddForm({...addForm, selling_price: +e.target.value})} />
                        </div>
                      </div>
                      <div className="pt-4">
                        <button onClick={handleManualAdd} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5" /> إتمام الحفظ
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
export default Inventory;
