import React, { useState, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { useInventoryFilter } from '../hooks/useInventoryFilter';
import { useBestSuppliers } from '../hooks/useBestSuppliers';
import { useLatestPrices } from '../hooks/useLatestPrices'; 
import { generatePriceListPdf } from '../services/pdfGenerator';
import { exportInventoryToExcel } from '../utils/excel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// @ts-ignore*
import toast from 'react-hot-toast';

import InventoryHeader from './Inventory/InventoryHeader';
import InventoryControls from './Inventory/InventoryControls';
import InventoryTable from './Inventory/InventoryTable';
import AddProductModal from './Inventory/AddProductModal';
import ItemCardModal from './Inventory/ItemCardModal';

export default function Inventory() {
  const { products, settings, warehouses, addProduct, updateProduct, deleteProduct } = useData();
  
  const bestSuppliersMap = useBestSuppliers();
  const latestPricesMap = useLatestPrices();

  const { 
    searchQuery, setSearchQuery, warehouseFilter, setWarehouseFilter, 
    hideZero, setHideZero, showLow, setShowLow, currentPage, setCurrentPage, 
    paginatedProducts, totalCount, totalPages, allFiltered 
  } = useInventoryFilter(products, settings, bestSuppliersMap, latestPricesMap);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [viewingProduct, setViewingProduct] = useState<any>(null);

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
    if (confirm("هل أنت متأكد من الحذف؟")) {
        const res = await deleteProduct(id);
        if (res.success) toast.success("تم الحذف بنجاح");
        else toast.error("لا يمكن الحذف حالياً");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <InventoryHeader onAddNew={handleOpenAdd} onExportPdf={() => generatePriceListPdf(allFiltered, settings)} onExportExcel={() => exportInventoryToExcel(allFiltered)} />
        <InventoryControls searchQuery={searchQuery} setSearchQuery={setSearchQuery} warehouseFilter={warehouseFilter} setWarehouseFilter={setWarehouseFilter} hideZero={hideZero} setHideZero={setHideZero} showLow={showLow} setShowLow={setShowLow} warehouses={warehouses} totalCount={totalCount} />
        
        {/* تم تمرير فلتر المخزن وقائمة المخازن هنا */}
        <InventoryTable 
            products={paginatedProducts} 
            currency={settings.currency} 
            onViewCard={setViewingProduct} 
            onEdit={handleEdit} 
            onDelete={handleDelete}
            warehouseFilter={warehouseFilter}
            warehouses={warehouses}
        />
        
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
    </div>
  );
}