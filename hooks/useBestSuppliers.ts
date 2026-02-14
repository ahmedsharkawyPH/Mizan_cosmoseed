
import { useMemo } from 'react';
import { useData } from '../context/DataContext';

export function useBestSuppliers() {
  const { purchaseInvoices, suppliers } = useData();

  return useMemo(() => {
    const map: Record<string, string> = {};
    const bestPrices: Record<string, number> = {};

    // ترتيب الفواتير زمنياً لضمان معالجة البيانات بشكل صحيح
    const sorted = [...purchaseInvoices].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sorted.forEach(inv => {
      if (inv.type === 'PURCHASE') {
        const supplier = suppliers.find(s => s.id === inv.supplier_id);
        inv.items.forEach(item => {
          // نبحث عن السعر الأقل (أفضل مورد سعرياً)
          if (!bestPrices[item.product_id] || item.cost_price < bestPrices[item.product_id]) {
            bestPrices[item.product_id] = item.cost_price;
            map[item.product_id] = supplier?.name || '---';
          }
        });
      }
    });
    return map;
  }, [purchaseInvoices, suppliers]);
}
