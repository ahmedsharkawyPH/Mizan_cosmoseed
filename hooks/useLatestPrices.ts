
import { useMemo } from 'react';
import { useData } from '../context/DataContext';

/**
 * هذا الـ Hook يولد خريطة تحتوي على أحدث سعر بيع لكل صنف
 * محسوب من آخر فاتورة مشتريات مسجلة زمنياً.
 */
export function useLatestPrices() {
  const { purchaseInvoices } = useData();

  return useMemo(() => {
    const map: Record<string, number> = {};

    // 1. ترتيب فواتير المشتريات من الأقدم للأحدث
    const sortedInvoices = [...purchaseInvoices].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 2. تحديث الخريطة بأحدث سعر بيع لكل منتج
    // الفواتير الأحدث ستقوم بالكتابة فوق الأقدم تلقائياً
    sortedInvoices.forEach(inv => {
      if (inv.status !== 'CANCELLED') {
        inv.items.forEach(item => {
          if (typeof item.selling_price === 'number' && item.selling_price > 0) {
            map[item.product_id] = item.selling_price;
          }
        });
      }
    });

    return map;
  }, [purchaseInvoices]);
}
