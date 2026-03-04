
import React, { useState, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useInventoryFilter } from '../hooks/useInventoryFilter';
import { useBestSuppliers } from '../hooks/useBestSuppliers';
import { useLatestPrices } from '../hooks/useLatestPrices'; 
import { generatePriceListPdf } from '../services/pdfGenerator';
import { exportInventoryToExcel } from '../utils/excel';
import { ChevronLeft, ChevronRight, Tags, Trash2 } from 'lucide-react';
// @ts-ignore*
import toast from 'react-hot-toast';

import InventoryHeader from './Inventory/InventoryHeader';
import InventoryControls from './Inventory/InventoryControls';
import InventoryTable from './Inventory/InventoryTable';
import AddProductModal from '../components/AddProductModal';
import ItemCardModal from './Inventory/ItemCardModal';
import ExportPdfModal from './Inventory/ExportPdfModal';

export default function Inventory() {
  const { products, settings, warehouses, addProduct, updateProduct, deleteProduct, syncAllProductPrices } = useData();
  
  const bestSuppliersMap = useBestSuppliers();
  const latestPricesMap = useLatestPrices();

  const { 
    searchQuery, setSearchQuery, warehouseFilter, setWarehouseFilter, 
    hideZero, setHideZero, showLow, setShowLow, currentPage, setCurrentPage, 
    paginatedProducts, totalCount, totalPages, allFiltered 
  } = useInventoryFilter(products, settings, bestSuppliersMap, latestPricesMap);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [viewingProduct, setViewingProduct] = useState<any>(null);
  const [productToDelete, setProductToDelete] = useState<any>(null);

  // حالة التحكم في نوع التسعير المعروض
  const [priceType, setPriceType] = useState<'retail' | 'wholesale' | 'half_wholesale'>('retail');

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsAddModalOpen(true);
  };

  const handleEdit = (p: any) => {
    setEditingProduct(p);
    setIsAddModalOpen(true);
  };

  const handleSave = useCallback(async (pData: any, bData: any) => {
    return editingProduct 
        ? await updateProduct(editingProduct.id, pData)
        : await addProduct(pData, bData);
  }, [editingProduct, addProduct, updateProduct]);

  const handleDelete = async (id: string) => {
    const res = await deleteProduct(id);
    if (res.success) toast.success("تم الحذف بنجاح");
    else toast.error("لا يمكن الحذف حالياً");
    setProductToDelete(null);
  };

  // دالة لتطبيق السعر المختار على قائمة المنتجات
  const applyPricing = useCallback((list: any[]) => {
    return list.map(p => {
      let selectedPrice = 0;
      
      if (priceType === 'wholesale') {
        selectedPrice = p.selling_price_wholesale || p.selling_price || 0;
      } else if (priceType === 'half_wholesale') {
        selectedPrice = p.selling_price_half_wholesale || p.selling_price || 0;
      } else {
        // Retail (Default)
        selectedPrice = p.display_selling_price || p.selling_price || 0;
      }

      return {
        ...p,
        display_selling_price: selectedPrice
      };
    });
  }, [priceType]);

  const adjustedPaginated = useMemo(() => applyPricing(paginatedProducts), [paginatedProducts, applyPricing]);
  const adjustedFiltered = useMemo(() => applyPricing(allFiltered), [allFiltered, applyPricing]);

  const handleExportPdf = (selectedPriceType: 'retail' | 'wholesale' | 'half_wholesale') => {
    // Apply the selected price type specifically for the PDF export
    const pdfData = allFiltered.map(p => {
      let selectedPrice = p.selling_price || 0; 
      
      if (selectedPriceType === 'wholesale') {
        selectedPrice = p.selling_price_wholesale || p.selling_price || 0;
      } else if (selectedPriceType === 'half_wholesale') {
        selectedPrice = p.selling_price_half_wholesale || p.selling_price || 0;
      }

      return {
        ...p,
        display_selling_price: selectedPrice
      };
    });

    generatePriceListPdf(pdfData, settings, selectedPriceType);
  };

  const handleSyncPrices = async () => {
    const res = await syncAllProductPrices();
    if (res.success) toast.success("تم تحديث كافة الأسعار من آخر فواتير شراء");
    else toast.error("فشل تحديث الأسعار");
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* شريط اختيار نوع التسعير */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 font-black text-sm px-2">
                <Tags className="w-5 h-5 text-blue-500" />
                عرض الأسعار:
            </div>
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner w-full sm:w-auto">
                <button 
                    onClick={() => setPriceType('retail')} 
                    className={`flex-1 sm:flex-none px-6 py-2 text-sm font-black rounded-lg transition-all ${priceType === 'retail' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                    قطاعي
                </button>
                <button 
                    onClick={() => setPriceType('half_wholesale')} 
                    className={`flex-1 sm:flex-none px-6 py-2 text-sm font-black rounded-lg transition-all ${priceType === 'half_wholesale' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                    نص جملة
                </button>
                <button 
                    onClick={() => setPriceType('wholesale')} 
                    className={`flex-1 sm:flex-none px-6 py-2 text-sm font-black rounded-lg transition-all ${priceType === 'wholesale' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                    جملة
                </button>
            </div>
        </div>

        <InventoryHeader 
          onAddNew={handleOpenAdd} 
          onExportPdf={() => setIsExportPdfModalOpen(true)} 
          onExportExcel={() => exportInventoryToExcel(adjustedFiltered)} 
          onSyncPrices={handleSyncPrices}
        />
        <InventoryControls searchQuery={searchQuery} setSearchQuery={setSearchQuery} warehouseFilter={warehouseFilter} setWarehouseFilter={setWarehouseFilter} hideZero={hideZero} setHideZero={setHideZero} showLow={showLow} setShowLow={setShowLow} warehouses={warehouses} totalCount={totalCount} />
        <InventoryTable products={adjustedPaginated} currency={settings.currency} onViewCard={setViewingProduct} onEdit={handleEdit} onDelete={setProductToDelete} />
        {totalPages > 1 && (
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center gap-4">
               <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-xl bg-white border border-slate-200 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"><ChevronRight className="w-5 h-5" /></button>
               <span className="text-sm font-black text-slate-700">صفحة {currentPage} من {totalPages}</span>
               <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-xl bg-white border border-slate-200 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
            </div>
        )}
      </div>
      <AddProductModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} product={editingProduct} onSave={handleSave} warehouses={warehouses} />
      <ItemCardModal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} product={viewingProduct} currency={settings.currency} />
      <ExportPdfModal isOpen={isExportPdfModalOpen} onClose={() => setIsExportPdfModalOpen(false)} onExport={handleExportPdf} />
      
      {productToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border-2 border-red-100 animate-in zoom-in duration-200">
                  <div className="p-8 bg-red-50 text-red-700 flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                          <Trash2 className="w-10 h-10 text-red-600" />
                      </div>
                      <h3 className="text-2xl font-black mb-2">تأكيد حذف المنتج</h3>
                      <p className="text-sm font-bold text-red-600/70">هل أنت متأكد من حذف المنتج {productToDelete.name}؟</p>
                      <p className="text-[10px] mt-2 text-red-500 font-black uppercase tracking-widest">سيتم حذف كافة بيانات المنتج والتشغيلات المرتبطة به</p>
                  </div>

                  <div className="p-8 space-y-4">
                      <button 
                          onClick={() => handleDelete(productToDelete.id)}
                          className="w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95"
                      >
                          تأكيد الحذف النهائي
                      </button>
                      <button 
                          onClick={() => setProductToDelete(null)}
                          className="w-full py-4 text-slate-400 font-black hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all"
                      >
                          إلغاء
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
