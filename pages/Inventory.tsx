
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArabicSmartSearch } from '../utils/search';
import { 
  Search, Package, Filter, X, Zap, Hash, Tag, PlusCircle,
  FileSpreadsheet, Loader2, Award, PackagePlus, EyeOff, ChevronLeft, ChevronRight, FileDown, CheckCircle2,
  Edit, Trash2, ClipboardList, Printer, ArrowRight, TrendingUp, History, FileText, Download
} from 'lucide-react';
import { exportInventoryToExcel } from '../utils/excel';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 50;

interface ProductMovement {
    date: string;
    type: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PUR_RETURN';
    ref: string;
    entityName: string;
    qtyIn: number;
    qtyOut: number;
    price: number;
    balanceAfter: number;
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbFullLoaded, setDbFullLoaded] = useState(db.isFullyLoaded);
  
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  
  // States for Edit/ItemCard
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [viewingCardProduct, setViewingCardProduct] = useState<any | null>(null);

  const [exportOptions, setExportOptions] = useState({
      warehouseId: 'ALL',
      onlyInStock: false
  });

  const [pdfExportOptions, setPdfExportOptions] = useState({
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
      if (editingProduct) {
          await db.updateProduct(editingProduct.id, { name: quickAddForm.name, code: quickAddForm.code, purchase_price: quickAddForm.purchase_price, selling_price: quickAddForm.selling_price });
          toast.success("تم تحديث الصنف بنجاح");
      } else {
          const pData = { name: quickAddForm.name, code: quickAddForm.code };
          const bData = { 
              quantity: quickAddForm.initial_qty, 
              purchase_price: quickAddForm.purchase_price, 
              selling_price: quickAddForm.selling_price,
              warehouse_id: quickAddForm.warehouse_id || warehouses[0]?.id
          };
          await db.addProduct(pData, bData);
          toast.success("تم إضافة الصنف بنجاح");
      }
      setIsAddModalOpen(false);
      setEditingProduct(null);
      setQuickAddForm({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });
      loadProducts();
  };

  const handleEdit = (p: any) => {
      setEditingProduct(p);
      setQuickAddForm({
          name: p.name,
          code: p.code || '',
          purchase_price: p.purchase_price || 0,
          selling_price: p.selling_price || 0,
          initial_qty: 0, 
          warehouse_id: ''
      });
      setIsAddModalOpen(true);
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("هل أنت متأكد من حذف هذا الصنف؟")) {
          const hasInvoices = db.getInvoices().some(inv => inv.items.some(it => it.product.id === id));
          const hasPurchases = db.getPurchaseInvoices().some(inv => inv.items.some(it => it.product_id === id));
          if (hasInvoices || hasPurchases) {
              return toast.error("لا يمكن حذف صنف له حركات بيع أو شراء مسجلة. يمكنك تصفير رصيده فقط.");
          }
          await db.deleteProduct(id);
          toast.success("تم الحذف بنجاح");
          loadProducts();
      }
  };

  const itemCardMovements = useMemo(() => {
      if (!viewingCardProduct) return [];
      const pid = viewingCardProduct.id;
      const all: ProductMovement[] = [];
      db.getInvoices().forEach(inv => {
          const item = inv.items.find(it => it.product.id === pid);
          if (item) {
              const cust = db.getCustomers().find(c => c.id === inv.customer_id);
              all.push({
                  date: inv.date,
                  type: inv.type === 'SALE' ? 'SALE' : 'SALE_RETURN',
                  ref: inv.invoice_number,
                  entityName: cust?.name || 'عميل نقدي',
                  qtyIn: inv.type === 'RETURN' ? item.quantity : 0,
                  qtyOut: inv.type === 'SALE' ? item.quantity : 0,
                  price: item.unit_price || 0,
                  balanceAfter: 0
              });
          }
      });
      db.getPurchaseInvoices().forEach(inv => {
          const item = inv.items.find(it => it.product_id === pid);
          if (item) {
              const supp = db.getSuppliers().find(s => s.id === inv.supplier_id);
              all.push({
                  date: inv.date,
                  type: inv.type === 'PURCHASE' ? 'PURCHASE' : 'PUR_RETURN',
                  ref: inv.invoice_number,
                  entityName: supp?.name || 'مورد',
                  qtyIn: inv.type === 'PURCHASE' ? item.quantity : 0,
                  qtyOut: inv.type === 'RETURN' ? item.quantity : 0,
                  price: item.cost_price,
                  balanceAfter: 0
              });
          }
      });
      all.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let runningBalance = 0;
      return all.map(m => {
          runningBalance += (m.qtyIn - m.qtyOut);
          return { ...m, balanceAfter: runningBalance };
      });
  }, [viewingCardProduct]);

  const handleExportExcel = () => {
      const toastId = toast.loading("جاري تحضير ملف الإكسيل...");
      const exportData: any[] = [];
      products.forEach(p => {
          const pBatches = p.batches || [];
          const filteredBatches = exportOptions.warehouseId === 'ALL' ? pBatches : pBatches.filter((b: any) => b.warehouse_id === exportOptions.warehouseId);
          const totalQty = filteredBatches.reduce((s: number, b: any) => s + b.quantity, 0);
          if (exportOptions.onlyInStock && totalQty <= 0) return;
          if (filteredBatches.length > 0) {
              filteredBatches.forEach((b: any) => {
                  if (exportOptions.onlyInStock && b.quantity <= 0) return;
                  exportData.push({ "كود الصنف": p.code || '---', "اسم الصنف": p.name, "المخزن": warehouses.find(w => w.id === b.warehouse_id)?.name || 'غير معروف', "الرصيد": b.quantity, "سعر التكلفة": b.purchase_price, "سعر البيع": b.selling_price });
              });
          } else if (!exportOptions.onlyInStock) {
              exportData.push({ "كود الصنف": p.code || '---', "اسم الصنف": p.name, "المخزن": exportOptions.warehouseId === 'ALL' ? 'كافة المخازن' : warehouses.find(w => w.id === exportOptions.warehouseId)?.name, "الرصيد": 0, "سعر التكلفة": p.purchase_price || 0, "سعر البيع": p.selling_price || 0 });
          }
      });
      if (exportData.length === 0) { toast.error("لا توجد بيانات مطابقة لخيارات التصدير", { id: toastId }); return; }
      exportInventoryToExcel(exportData, exportOptions.warehouseId === 'ALL' ? 'Full_Inventory' : 'Warehouse_Inventory');
      toast.success("تم استخراج الملف بنجاح", { id: toastId });
      setIsExportModalOpen(false);
  };

  const handleExportPdf = async () => {
    setIsPdfGenerating(true);
    const toastId = toast.loading("جاري إنشاء تقرير PDF...");
    
    // 1. فلترة البيانات
    let dataToPdf = products.filter(p => {
        const pBatches = p.batches || [];
        const filteredBatches = pdfExportOptions.warehouseId === 'ALL' ? pBatches : pBatches.filter((b: any) => b.warehouse_id === pdfExportOptions.warehouseId);
        const totalQty = filteredBatches.reduce((s: number, b: any) => s + b.quantity, 0);
        if (pdfExportOptions.onlyInStock && totalQty <= 0) return false;
        return true;
    });

    if (dataToPdf.length === 0) {
        toast.error("لا توجد بيانات مطابقة للخيارات المختارة", { id: toastId });
        setIsPdfGenerating(false);
        return;
    }

    // 2. إنشاء حاوية مؤقتة للتقرير للتحويل إلى PDF
    const reportContainer = document.createElement('div');
    reportContainer.style.width = '210mm'; // عرض A4
    reportContainer.style.padding = '15mm';
    reportContainer.style.background = 'white';
    reportContainer.style.direction = 'rtl';
    reportContainer.style.fontFamily = 'Cairo, sans-serif';
    reportContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
            <div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 900;">${settings.companyName}</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">تقرير قائمة الأسعار والمخزون</p>
                <p style="margin: 5px 0 0 0; font-size: 12px;">المخزن: ${pdfExportOptions.warehouseId === 'ALL' ? 'الكل' : warehouses.find(w => w.id === pdfExportOptions.warehouseId)?.name}</p>
            </div>
            <div style="text-align: left;">
                <p style="margin: 0; font-size: 12px;">تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</p>
                <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">Mizan Online Pro</p>
            </div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f3f4f6;">
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: center; width: 40px;">#</th>
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">اسم الصنف</th>
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">الكود</th>
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">سعر البيع</th>
                </tr>
            </thead>
            <tbody>
                ${dataToPdf.map((p, i) => `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 11px;">${i+1}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${p.name}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-family: monospace;">${p.code || '---'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: 900;">${currency}${p.selling_price?.toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.body.appendChild(reportContainer);

    try {
        const canvas = await html2canvas(reportContainer, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        
        toast.success("تم تصدير ملف PDF بنجاح", { id: toastId });
        setIsPdfModalOpen(false);
    } catch (err) {
        toast.error("حدث خطأ أثناء إنشاء الملف", { id: toastId });
    } finally {
        document.body.removeChild(reportContainer);
        setIsPdfGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div><h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><Package className="w-8 h-8 text-blue-600" /> {t('stock.title')}</h1></div>
           <div className="flex flex-wrap gap-2">
             <button onClick={() => setIsPdfModalOpen(true)} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-red-700 transition-all active:scale-95"><FileText className="w-5 h-5" /> تصدير PDF</button>
             <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95"><FileSpreadsheet className="w-5 h-5" /> تصدير إكسيل</button>
             <button id="btn_new_product" name="btn_new_product" onClick={() => { setEditingProduct(null); setIsAddModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><PlusCircle className="w-5 h-5" /> {t('stock.new')}</button>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
          <div className="relative group mb-4">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none"><Search className="h-6 w-6 text-slate-400" /></div>
              <input id="inventory_main_search" name="inventory_search" ref={searchInputRef} type="text" autoComplete="off" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 ابحث في كامل المخزون..." className="w-full pl-4 pr-14 py-4 text-xl border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-slate-50 focus:bg-white shadow-inner" />
          </div>
          <div className="flex flex-wrap gap-4 items-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2"><label htmlFor="warehouse_filter_select" className="text-xs font-black text-slate-400 uppercase">{t('stock.filter_warehouse')}:</label><select id="warehouse_filter_select" name="warehouse_filter" value={selectedWarehouseFilter} onChange={e => setSelectedWarehouseFilter(e.target.value)} className="text-sm font-bold p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"><option value="ALL">-- كل المخازن --</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
                <button id="btn_toggle_zero_stock" name="btn_toggle_zero_stock" onClick={() => setHideZeroStock(!hideZeroStock)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${hideZeroStock ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-500 border-slate-200'}`}>{hideZeroStock ? <EyeOff className="w-4 h-4" /> : <Package className="w-4 h-4" />}{t('stock.only_available')}</button>
                <div className="flex gap-2"><button onClick={() => setShowLowStock(!showLowStock)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showLowStock ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}>نواقص</button><button onClick={() => setShowOutOfStock(!showOutOfStock)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showOutOfStock ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-500 border-slate-200'}`}>نفذت</button></div>
                <div className="mr-auto text-xs font-bold text-slate-400">عرض {paginatedProducts.length} من أصل {allFilteredProducts.length} صنف</div>
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
                  <th className="px-6 py-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{product.name}</div>
                    </td>
                    <td className="px-6 py-4 text-center"><code className="text-[11px] font-mono text-slate-400">{product.code || '---'}</code></td>
                    <td className="px-6 py-4 text-center"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100"><Award className="w-3 h-3" />{bestSuppliersMap[product.id] || '---'}</span></td>
                    <td className="px-6 py-4 text-center"><span className="font-bold text-blue-600 font-mono">{currency}{(product.selling_price || 0).toLocaleString()}</span></td>
                    <td className="px-6 py-4 text-center"><span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-lg font-black text-sm ${(product.batches?.reduce((s:number, b:any) => s+b.quantity,0) || 0) <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{selectedWarehouseFilter === 'ALL' ? (product.batches?.reduce((s:number, b:any) => s+b.quantity, 0) || 0) : (product.batches?.find((b:any) => b.warehouse_id === selectedWarehouseFilter)?.quantity || 0)}</span></td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-1.5">
                            <button onClick={() => setViewingCardProduct(product)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="كارت الصنف"><ClipboardList className="w-4.5 h-4.5" /></button>
                            <button onClick={() => handleEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="تعديل البيانات"><Edit className="w-4.5 h-4.5" /></button>
                            <button onClick={() => handleDelete(product.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="حذف نهائي"><Trash2 className="w-4.5 h-4.5" /></button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-4">
               <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"><ChevronRight className="w-5 h-5" /></button>
               <div className="flex gap-1">{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let pageNum = currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i); if (pageNum <= 0 || pageNum > totalPages) return null; return ( <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{pageNum}</button> ); })}</div>
               <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"><ChevronLeft className="w-5 h-5" /></button>
            </div>
          )}
        </div>
      </div>

      {/* Excel Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="bg-emerald-600 p-6 flex justify-between items-center text-white">
                    <h3 className="text-xl font-black flex items-center gap-3"><FileSpreadsheet className="w-6 h-6" /> تصدير المخزون (Excel)</h3>
                    <button onClick={() => setIsExportModalOpen(false)} className="text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">تحديد المخزن</label>
                        <select className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-emerald-500 font-bold" value={exportOptions.warehouseId} onChange={e => setExportOptions({...exportOptions, warehouseId: e.target.value})}>
                            <option value="ALL">-- كافة المخازن --</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <label className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl cursor-pointer group">
                        <input type="checkbox" className="w-6 h-6 rounded-lg text-emerald-600 focus:ring-emerald-500" checked={exportOptions.onlyInStock} onChange={e => setExportOptions({...exportOptions, onlyInStock: e.target.checked})} />
                        <span className="text-sm font-bold text-slate-700">تصدير الأصناف المتوفرة فقط (رصيد > 0)</span>
                    </label>
                    <button onClick={handleExportExcel} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95">بدء التصدير الآن</button>
                </div>
            </div>
        </div>
      )}

      {/* PDF Export Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="bg-red-600 p-6 flex justify-between items-center text-white">
                    <h3 className="text-xl font-black flex items-center gap-3"><FileText className="w-6 h-6" /> تصدير تقرير PDF</h3>
                    <button onClick={() => setIsPdfModalOpen(false)} className="text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100 mb-2">
                        <p className="text-[10px] text-red-600 font-black uppercase mb-1">محتوى التقرير:</p>
                        <p className="text-xs font-bold text-red-800 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> اسم الصنف + الكود + سعر البيع</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">تحديد المخزن للمطابقة</label>
                        <select className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-red-500 font-bold" value={pdfExportOptions.warehouseId} onChange={e => setPdfExportOptions({...pdfExportOptions, warehouseId: e.target.value})}>
                            <option value="ALL">-- كافة المخازن --</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <label className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl cursor-pointer group">
                        <input type="checkbox" className="w-6 h-6 rounded-lg text-red-600 focus:ring-red-500" checked={pdfExportOptions.onlyInStock} onChange={e => setPdfExportOptions({...pdfExportOptions, onlyInStock: e.target.checked})} />
                        <span className="text-sm font-bold text-slate-700">تصدير الأصناف المتوفرة فقط (رصيد > 0)</span>
                    </label>
                    <button onClick={handleExportPdf} disabled={isPdfGenerating} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                        {isPdfGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                        {isPdfGenerating ? "جاري الإنشاء..." : "إنشاء ملف PDF"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Item Card Modal */}
      {viewingCardProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  #item-card-print, #item-card-print * { visibility: visible; }
                  #item-card-print { position: absolute; left: 0; top: 0; width: 100%; padding: 10mm; background: white; direction: rtl; }
                  .no-print { display: none !important; }
                }
              `}</style>
              <div id="item-card-print" className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center no-print">
                      <div className="flex items-center gap-3">
                          <ClipboardList className="w-6 h-6 text-blue-400" />
                          <h3 className="text-xl font-black">كارت حركة الصنف</h3>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"><Printer className="w-4 h-4" /> طباعة الكارت</button>
                          <button onClick={() => setViewingCardProduct(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                      </div>
                  </div>

                  <div className="p-8 bg-slate-50 border-b hidden print:block text-center border-black">
                      <h1 className="text-2xl font-black mb-2">{settings.companyName}</h1>
                      <div className="text-lg font-bold border-2 border-black inline-block px-10 py-1 rounded-lg">تقرير حركة صنف تفصيلي</div>
                  </div>

                  <div className="p-8 space-y-6 flex-1 overflow-auto bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">اسم الصنف</span>
                              <span className="text-xl font-black text-slate-800">{viewingCardProduct.name}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">كود الصنف</span>
                              <span className="text-xl font-mono font-black text-blue-600">{viewingCardProduct.code || '---'}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الرصيد الحالي بالمخازن</span>
                              <span className="text-xl font-black text-emerald-600">{viewingCardProduct.batches?.reduce((s:number, b:any) => s+b.quantity, 0) || 0}</span>
                          </div>
                      </div>

                      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-xs text-right">
                              <thead className="bg-slate-800 text-white font-black uppercase">
                                  <tr>
                                      <th className="p-4">تاريخ الحركة</th>
                                      <th className="p-4 text-center">النوع</th>
                                      <th className="p-4">رقم المرجع</th>
                                      <th className="p-4">البيان / العميل / المورد</th>
                                      <th className="p-4 text-center text-emerald-400">وارد (+)</th>
                                      <th className="p-4 text-center text-rose-400">صادر (-)</th>
                                      <th className="p-4 text-center bg-slate-700">الرصيد</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {itemCardMovements.map((m, i) => (
                                      <tr key={i} className="hover:bg-slate-50 font-bold transition-colors">
                                          <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(m.date).toLocaleDateString('ar-EG')}</td>
                                          <td className="p-4 text-center">
                                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                  m.type === 'PURCHASE' ? 'bg-blue-50 text-blue-700' :
                                                  m.type === 'SALE' ? 'bg-emerald-50 text-emerald-700' :
                                                  'bg-rose-50 text-rose-700'
                                              }`}>
                                                  {m.type === 'PURCHASE' ? 'شراء' : m.type === 'SALE' ? 'بيع' : 'مرتجع'}
                                              </span>
                                          </td>
                                          <td className="p-4 font-mono text-blue-600">{m.ref}</td>
                                          <td className="p-4 text-slate-800 truncate max-w-[150px]">{m.entityName}</td>
                                          <td className="p-4 text-center text-emerald-600 font-black">{m.qtyIn || '-'}</td>
                                          <td className="p-4 text-center text-rose-600 font-black">{m.qtyOut || '-'}</td>
                                          <td className="p-4 text-center bg-slate-50 font-black text-sm">{m.balanceAfter}</td>
                                      </tr>
                                  ))}
                                  {itemCardMovements.length === 0 && (
                                      <tr><td colSpan={7} className="p-20 text-center text-slate-300 font-black">لا توجد حركات مسجلة لهذا الصنف بعد</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 border-t hidden print:flex justify-between items-center text-xs font-bold border-black">
                      <span>تم استخراج التقرير بتاريخ: {new Date().toLocaleString('ar-EG')}</span>
                      <span>Mizan Online Pro - نظام محاسبي متكامل</span>
                  </div>
              </div>
          </div>
      )}

      {/* Edit/Add Modal */}
      {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-100">
                  <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                      <h3 className="text-xl font-black flex items-center gap-3">
                          {editingProduct ? <Edit className="w-6 h-6" /> : <PlusCircle className="w-6 h-6" />}
                          {editingProduct ? `تعديل الصنف: ${editingProduct.name}` : 'إضافة صنف جديد للمخزون'}
                      </h3>
                      <button onClick={() => setIsAddModalOpen(false)} className="text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-8 grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">اسم الصنف المعروض *</label>
                          <input className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all" value={quickAddForm.name} onChange={e => setQuickAddForm({...quickAddForm, name: e.target.value})} autoFocus />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">كود الصنف (Barcode)</label>
                          <input className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-blue-500 font-mono transition-all" value={quickAddForm.code} onChange={e => setQuickAddForm({...quickAddForm, code: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">الرصيد الافتتاحي</label>
                          <input type="number" disabled={!!editingProduct} className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-blue-500 font-black disabled:bg-slate-50 disabled:text-slate-400" value={quickAddForm.initial_qty} onChange={e => setQuickAddForm({...quickAddForm, initial_qty: parseInt(e.target.value) || 0})} />
                          {editingProduct && <p className="text-[9px] text-orange-500 font-bold mt-1">* تعديل الرصيد يتم من خلال شاشة "الجرد الفعلي"</p>}
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">سعر التكلفة (Default)</label>
                          <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-rose-500 font-black text-rose-600 transition-all" value={quickAddForm.purchase_price} onChange={e => setQuickAddForm({...quickAddForm, purchase_price: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">سعر البيع (Default)</label>
                          <input type="number" className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-emerald-500 font-black text-emerald-600 transition-all" value={quickAddForm.selling_price} onChange={e => setQuickAddForm({...quickAddForm, selling_price: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div className="col-span-2 pt-4">
                          <button onClick={handleSaveProduct} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all active:scale-95">حفظ بيانات الصنف</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Inventory;
