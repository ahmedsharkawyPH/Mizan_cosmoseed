
import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useInventoryFilter } from '../hooks/useInventoryFilter';
import { useProductMovements } from '../hooks/useProductMovements';
import { generatePriceListPdf } from '../services/pdfGenerator';
import { exportInventoryToExcel } from '../utils/excel';
import { t } from '../utils/t';
import { 
  Search, Package, Filter, X, Zap, Hash, Tag, PlusCircle, FileSpreadsheet, Loader2, Award, 
  PackagePlus, EyeOff, ChevronLeft, ChevronRight, FileDown, CheckCircle2, Edit, Trash2, 
  ClipboardList, Printer, History, FileText, Download 
} from 'lucide-react';
// @ts-ignore
import toast from 'react-hot-toast';

export default function Inventory() {
  const { products, settings, warehouses, purchaseInvoices, addProduct, updateProduct, deleteProduct } = useData();
  const { 
    searchQuery, setSearchQuery, warehouseFilter, setWarehouseFilter, hideZero, setHideZero, 
    showLow, setShowLow, showOut, setShowOut, currentPage, setCurrentPage, 
    paginatedProducts, totalCount, totalPages, allFiltered 
  } = useInventoryFilter(products, settings);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [viewingProduct, setViewingProduct] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });

  const currency = settings.currency;

  const bestSuppliers = useMemo(() => {
    const map: Record<string, string> = {};
    const bestPrices: Record<string, number> = {};
    [...purchaseInvoices].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(inv => {
      if (inv.type === 'PURCHASE') {
        inv.items.forEach(item => {
          if (!bestPrices[item.product_id] || item.cost_price < bestPrices[item.product_id]) {
            bestPrices[item.product_id] = item.cost_price;
            map[item.product_id] = inv.supplier_name || '---';
          }
        });
      }
    });
    return map;
  }, [purchaseInvoices]);

  const handleOpenAdd = () => {
    const maxCode = Math.max(...products.map(p => parseInt(p.code || '0')).filter(c => !isNaN(c)), 1000);
    setEditingProduct(null);
    setQuickForm({ name: '', code: (maxCode + 1).toString(), purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: warehouses[0]?.id || '' });
    setIsAddModalOpen(true);
  };

  const handleSave = async () => {
    if (!quickForm.name) return toast.error("اسم الصنف مطلوب");
    setIsSubmitting(true);
    const res = editingProduct 
        ? await updateProduct(editingProduct.id, { name: quickForm.name, code: quickForm.code, purchase_price: quickForm.purchase_price, selling_price: quickForm.selling_price })
        : await addProduct({ name: quickForm.name, code: quickForm.code }, { quantity: quickForm.initial_qty, purchase_price: quickForm.purchase_price, selling_price: quickForm.selling_price, warehouse_id: quickForm.warehouse_id });
    
    if (res.success) {
        toast.success(editingProduct ? "تم التحديث" : "تمت الإضافة");
        setIsAddModalOpen(false);
    } else toast.error(res.message);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من الحذف؟")) {
        const res = await deleteProduct(id);
        if (res.success) toast.success("تم الحذف");
        else toast.error("لا يمكن حذف صنف له حركات مسجلة");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
           <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><Package className="w-8 h-8 text-blue-600" /> {t('stock.title')}</h1>
           <div className="flex flex-wrap gap-2">
             <button onClick={() => generatePriceListPdf(allFiltered, settings)} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg"><FileText className="w-5 h-5" /> PDF</button>
             <button onClick={() => exportInventoryToExcel(allFiltered)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg"><FileSpreadsheet className="w-5 h-5" /> Excel</button>
             <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg"><PlusCircle className="w-5 h-5" /> {t('stock.new')}</button>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100 space-y-4">
          <div className="relative group">
              <Search className="absolute right-4 top-4 h-6 w-6 text-slate-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 ابحث في كامل المخزون..." className="w-full pl-4 pr-14 py-4 text-xl border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white" />
          </div>
          <div className="flex flex-wrap gap-3 items-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)} className="text-sm font-bold p-2 border rounded-xl outline-none"><option value="ALL">كل المخازن</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                <button onClick={() => setHideZero(!hideZero)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${hideZero ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500'}`}>المتوفر فقط</button>
                <button onClick={() => setShowLow(!showLow)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${showLow ? 'bg-amber-500 text-white' : 'bg-white text-slate-500'}`}>نواقص</button>
                <div className="mr-auto text-xs font-bold text-slate-400">عرض {totalCount} صنف</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b">
                <tr><th>الصنف</th><th className="text-center">كود</th><th className="text-center">أفضل مورد</th><th className="text-center">سعر البيع</th><th className="text-center">الرصيد</th><th className="text-center">إجراء</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {paginatedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/50">
                    <td className="px-6 py-4 text-slate-800">{p.name}</td>
                    <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">{p.code || '---'}</td>
                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg border">{bestSuppliers[p.id] || '---'}</span></td>
                    <td className="px-6 py-4 text-center text-blue-600">{currency}{(p.selling_price || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-lg text-sm font-black ${(p.batches?.reduce((s,b)=>s+b.quantity,0)||0)<=0?'text-red-600 bg-red-50':'text-emerald-600 bg-emerald-50'}`}>{warehouseFilter === 'ALL' ? (p.batches?.reduce((s,b)=>s+b.quantity,0)||0) : (p.batches?.find(b=>b.warehouse_id===warehouseFilter)?.quantity||0)}</span></td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-1">
                            <button onClick={() => setViewingProduct(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><ClipboardList className="w-4 h-4" /></button>
                            <button onClick={() => { setEditingProduct(p); setQuickForm({ ...quickForm, name: p.name, code: p.code||'', purchase_price: p.purchase_price||0, selling_price: p.selling_price||0 }); setIsAddModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(p.id)} className="p-2 text-red-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-6 bg-slate-50 flex items-center justify-center gap-4 border-t">
               <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-xl bg-white border disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
               <span className="text-sm font-bold">صفحة {currentPage} من {totalPages}</span>
               <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-xl bg-white border disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
            </div>
          )}
        </div>
      </div>

      {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                  <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                      <h3 className="text-xl font-black">{editingProduct ? "تعديل الصنف" : "صنف جديد"}</h3>
                      <button onClick={() => setIsAddModalOpen(false)}><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-8 grid grid-cols-2 gap-5">
                      <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase">اسم الصنف</label><input className="w-full border-2 p-3 rounded-xl font-bold" value={quickForm.name} onChange={e => setQuickForm({...quickForm, name: e.target.value})} autoFocus /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase">الكود</label><input className="w-full border-2 p-3 rounded-xl font-mono" value={quickForm.code} onChange={e => setQuickForm({...quickForm, code: e.target.value})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase">الرصيد</label><input type="number" disabled={!!editingProduct} className="w-full border-2 p-3 rounded-xl font-black disabled:bg-slate-50" value={quickForm.initial_qty} onChange={e => setQuickForm({...quickForm, initial_qty: parseInt(e.target.value)||0})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase">التكلفة</label><input type="number" className="w-full border-2 p-3 rounded-xl font-black text-red-600" value={quickForm.purchase_price} onChange={e => setQuickForm({...quickForm, purchase_price: parseFloat(e.target.value)||0})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase">البيع</label><input type="number" className="w-full border-2 p-3 rounded-xl font-black text-emerald-600" value={quickForm.selling_price} onChange={e => setQuickForm({...quickForm, selling_price: parseFloat(e.target.value)||0})} /></div>
                      <button onClick={handleSave} disabled={isSubmitting} className="col-span-2 bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ الصنف"}</button>
                  </div>
              </div>
          </div>
      )}

      {viewingProduct && <ItemCardModal product={viewingProduct} onClose={() => setViewingProduct(null)} />}
    </div>
  );
}

function ItemCardModal({ product, onClose }: { product: any, onClose: () => void }) {
    const movements = useProductMovements(product.id);
    const { settings } = useData();
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <h3 className="text-xl font-black flex items-center gap-3"><ClipboardList className="w-6 h-6 text-blue-400" /> كارت حركة: {product.name}</h3>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="bg-blue-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"><Printer className="w-4 h-4" /> طباعة</button>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X className="w-6 h-6" /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-8 space-y-6">
                    <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div><span className="text-[10px] font-black text-slate-400">كود الصنف</span><div className="font-mono text-blue-600 text-lg">{product.code || '---'}</div></div>
                        <div><span className="text-[10px] font-black text-slate-400">الرصيد الإجمالي</span><div className="font-black text-emerald-600 text-lg">{product.batches?.reduce((s:any,b:any)=>s+b.quantity,0)}</div></div>
                        <div><span className="text-[10px] font-black text-slate-400">سعر البيع</span><div className="font-black text-slate-800 text-lg">{settings.currency}{product.selling_price}</div></div>
                    </div>
                    <table className="w-full text-xs text-right border-collapse">
                        <thead className="bg-slate-800 text-white font-black uppercase">
                            <tr><th className="p-3">التاريخ</th><th className="p-3 text-center">النوع</th><th className="p-3">المرجع</th><th className="p-3">البيان</th><th className="p-3 text-center text-emerald-400">وارد</th><th className="p-3 text-center text-rose-400">صادر</th><th className="p-3 text-center">الرصيد</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold">
                            {movements.map((m, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-slate-500">{new Date(m.date).toLocaleDateString('ar-EG')}</td>
                                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${m.type === 'PURCHASE' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>{m.type === 'PURCHASE' ? 'شراء' : 'بيع'}</span></td>
                                    <td className="p-3 font-mono text-blue-600">{m.ref}</td>
                                    <td className="p-3 text-slate-800 truncate max-w-[150px]">{m.entityName}</td>
                                    <td className="p-3 text-center text-emerald-600">{m.qtyIn || '-'}</td>
                                    <td className="p-3 text-center text-rose-600">{m.qtyOut || '-'}</td>
                                    <td className="p-3 text-center bg-slate-50 font-black">{m.balanceAfter}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
