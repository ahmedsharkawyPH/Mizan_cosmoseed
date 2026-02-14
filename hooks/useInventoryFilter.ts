
import { useState, useMemo, useEffect } from 'react';
import { ArabicSmartSearch } from '../utils/search';
import { ProductWithBatches } from '../types';

export function useInventoryFilter(products: ProductWithBatches[], settings: any, bestSuppliersMap: Record<string, string>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [hideZero, setHideZero] = useState(false);
  const [showLow, setShowLow] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const enrichedAndFiltered = useMemo(() => {
    let results = [...products];
    
    // 1. الفلترة الأساسية (المخزن، البحث، النواقص)
    if (warehouseFilter !== 'ALL') {
        results = results.filter(p => p.batches?.some(b => b.warehouse_id === warehouseFilter));
    }
    
    if (searchQuery.trim()) {
        results = ArabicSmartSearch.smartSearch(results, searchQuery);
    }

    if (showLow) {
        const threshold = settings.lowStockThreshold || 10;
        results = results.filter(p => {
            const total = p.batches?.reduce((sum, b) => sum + b.quantity, 0) || 0;
            return total > 0 && total <= threshold;
        });
    }

    if (showOut) {
        results = results.filter(p => (p.batches?.reduce((sum, b) => sum + b.quantity, 0) || 0) === 0);
    }

    // 2. الإثراء والفلترة النهائية (تجهيز الحقول المباشرة للعرض)
    return results.map(p => {
        const display_quantity = warehouseFilter === 'ALL' 
            ? (p.batches?.reduce((s, b) => s + b.quantity, 0) || 0)
            : (p.batches?.find(b => b.warehouse_id === warehouseFilter)?.quantity || 0);
            
        return {
            ...p,
            display_quantity,
            best_supplier_name: bestSuppliersMap[p.id] || '---',
        };
    }).filter(p => !hideZero || p.display_quantity > 0);

  }, [products, searchQuery, warehouseFilter, hideZero, showLow, showOut, settings.lowStockThreshold, bestSuppliersMap]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return enrichedAndFiltered.slice(start, start + ITEMS_PER_PAGE);
  }, [enrichedAndFiltered, currentPage]);

  useEffect(() => setCurrentPage(1), [searchQuery, warehouseFilter, hideZero, showLow, showOut]);

  return {
    searchQuery, setSearchQuery,
    warehouseFilter, setWarehouseFilter,
    hideZero, setHideZero,
    showLow, setShowLow,
    showOut, setShowOut,
    currentPage, setCurrentPage,
    paginatedProducts: paginated,
    totalCount: enrichedAndFiltered.length,
    totalPages: Math.ceil(enrichedAndFiltered.length / ITEMS_PER_PAGE),
    allFiltered: enrichedAndFiltered
  };
}
