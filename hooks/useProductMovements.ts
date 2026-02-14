
import { useMemo } from 'react';
import { useData } from '../context/DataContext';

export interface ProductMovement {
    date: string;
    type: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PUR_RETURN';
    ref: string;
    entityName: string;
    qtyIn: number;
    qtyOut: number;
    price: number;
    balanceAfter: number;
}

export function useProductMovements(productId: string | null) {
  const { invoices, purchaseInvoices, customers, suppliers } = useData();

  return useMemo(() => {
      if (!productId) return [];
      const all: ProductMovement[] = [];

      invoices.forEach(inv => {
          const item = inv.items.find(it => it.product.id === productId);
          if (item) {
              const cust = customers.find(c => c.id === inv.customer_id);
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

      purchaseInvoices.forEach(inv => {
          const item = inv.items.find(it => it.product_id === productId);
          if (item) {
              const supp = suppliers.find(s => s.id === inv.supplier_id);
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
  }, [productId, invoices, purchaseInvoices, customers, suppliers]);
}
