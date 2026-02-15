
import { useState, useMemo, useEffect } from 'react';
import { ArabicSmartSearch } from '../utils/search';
import { ProductWithBatches } from '../types';

export function useInventoryFilter(
  products: ProductWithBatches[], 
  settings: any, 
  bestSuppliersMap: Record<string, string>,
  latestPricesMap: Record<string, number>
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [hideZero, setHideZero] = useState(false);
  const [showLow, setShowLow] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // 1. ضمان وجود مصفوفة حتى لو كانت البيانات لم تحمل بعد
  const allProductsBase = useMemo(() => products || [], [products]);

  // 2. تطبيق كافة عمليات التصفية على المصفوفة الكاملة أولاً
  const allFiltered = useMemo(() => {
    let results = [...allProductsBase];
    
    // فلترة المستودع
    if (warehouseFilter !== 'ALL') {
        results = results.filter(p => p.batches?.some(b => b.warehouse_id === warehouseFilter));
    }
    
    // فلترة البحث الذكي (يدعم حتى 50 ألف سجل)
    if (searchQuery.trim()) {
        results = ArabicSmartSearch.smartSearch(results, searchQuery);
    }

    // فلترة النواقص بناءً على الحد المذكور في الإعدادات
    if (showLow) {
        const threshold = settings.lowStockThreshold || 10;
        results = results.filter(p => {
            const total = p.batches?.reduce((sum, b) => sum + b.quantity, 0) || 0;
            return total > 0 && total <= threshold;
        });
    }

    // فلترة الأصناف المنتهية تماماً
    if (showOut) {
        results = results.filter(p => (p.batches?.reduce((sum, b) => sum + b.quantity, 0) || 0) === 0);
    }

    // إثراء النتائج بالبيانات المحسوبة (الكمية الحالية وسعر البيع المعتمد)
    const enriched = results.map(p => {
        const display_quantity = warehouseFilter === 'ALL' 
            ? (p.batches?.reduce((s, b) => s + b.quantity, 0) || 0)
            : (p.batches?.find(b => b.warehouse_id === warehouseFilter)?.quantity || 0);
            
        const display_selling_price = latestPricesMap[p.id] ?? p.selling_price ?? 0;

        return {
            ...p,
            display_quantity,
            best_supplier_name: bestSuppliersMap[p.id] || '---',
            display_selling_price,
        };
    });

    // إخفاء الأرصدة الصفرية إذا تم تفعيل الخيار
    return hideZero ? enriched.filter(p => p.display_quantity > 0) : enriched;

  }, [allProductsBase, searchQuery, warehouseFilter, hideZero, showLow, showOut, settings.lowStockThreshold, bestSuppliersMap, latestPricesMap]);

  // 3. تطبيق التقسيم إلى صفحات (Pagination) على النتائج المصفاة فقط
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allFiltered.slice(start, start + ITEMS_PER_PAGE);
  }, [allFiltered, currentPage]);

  // 4. إعادة تعيين الصفحة إلى 1 فور تغيير أي معيار بحث أو تصفية
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, warehouseFilter, hideZero, showLow, showOut]);

  return {
    searchQuery, setSearchQuery,
    warehouseFilter, setWarehouseFilter,
    hideZero, setHideZero,
    showLow, setShowLow,
    showOut, setShowOut,
    currentPage, setCurrentPage,
    paginatedProducts,
    totalCount: allFiltered.length,
    totalPages: Math.ceil(allFiltered.length / ITEMS_PER_PAGE),
    allFiltered // تصدير كافة النتائج المصفاة لاستخدامها في التقارير والإكسيل
  };
}
