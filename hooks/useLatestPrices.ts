
import { useMemo } from 'react';
import { useData } from '../context/DataContext';

/**
 * هذا الـ Hook يولد خريطة تحتوي على أحدث سعر بيع لكل صنف
 * محسوب من آخر فاتورة مشتريات مسجلة زمنياً.
 */
export function useLatestPrices() {
  const { purchaseInvoices } = useData();

  return useMemo(() => {
    const map: Record<string, { selling: number; purchase: number }> = {};

    // 1. ترتيب فواتير المشتريات من الأقدم للأحدث
    const sortedInvoices = [...purchaseInvoices].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 2. تحديث الخريطة بأحدث الأسعار لكل منتج
    sortedInvoices.forEach(inv => {
      if (inv.status !== 'CANCELLED' && inv.type === 'PURCHASE') {
        inv.items.forEach(item => {
          map[item.product_id] = {
            selling: item.selling_price || 0,
            purchase: item.cost_price || 0
          };
        });
      }
    });

    return map;
  }, [purchaseInvoices]);
}
