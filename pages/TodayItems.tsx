
import React, { useMemo } from 'react';
import { db } from '../services/db';
import { ListChecks, Package, Search } from 'lucide-react';

export default function TodayItems() {
  const currency = db.getSettings().currency;
  
  const todaySoldItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const invoices = db.getInvoices().filter(inv => inv.date.startsWith(today) && inv.type === 'SALE');
    const productsWithStock = db.getProductsWithBatches();
    
    const aggregated: Record<string, { name: string, quantity: number, totalAmount: number, stock: number }> = {};

    invoices.forEach(inv => {
      inv.items.forEach(item => {
        const prodId = item.product.id;
        const price = item.unit_price || item.batch?.selling_price || item.product.selling_price || 0;
        const total = item.quantity * price * (1 - (item.discount_percentage / 100));

        if (!aggregated[prodId]) {
          const productData = productsWithStock.find(p => p.id === prodId);
          const totalStock = productData?.batches.reduce((sum, b) => sum + b.quantity, 0) || 0;
          
          aggregated[prodId] = {
            name: item.product.name,
            quantity: 0,
            totalAmount: 0,
            stock: totalStock
          };
        }
        
        aggregated[prodId].quantity += item.quantity;
        aggregated[prodId].totalAmount += total;
      });
    });

    return Object.values(aggregated).sort((a, b) => b.quantity - a.quantity);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-blue-600" />
            أصناف اليوم المباعة
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            عرض تجميعي لكافة الأصناف التي تم بيعها اليوم بتاريخ {new Date().toLocaleDateString('ar-EG')}
          </p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-100">
          إجمالي الأصناف: {todaySoldItems.length}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-right">اسم الصنف</th>
                <th className="px-6 py-4 text-center">الكمية المباعة</th>
                <th className="px-6 py-4 text-center">متوسط السعر / القيمة</th>
                <th className="px-6 py-4 text-center">الرصيد الحالي بالمخزن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {todaySoldItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{item.name}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black">
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="font-bold text-slate-700">{currency}{item.totalAmount.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400">معدل: {currency}{(item.totalAmount / item.quantity).toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[40px] px-3 py-1 rounded-lg font-black text-sm ${item.stock <= 0 ? 'bg-red-50 text-red-600 border border-red-100' : item.stock < 10 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                      {item.stock}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {todaySoldItems.length === 0 && (
          <div className="py-20 text-center">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-400">لم يتم بيع أي أصناف اليوم حتى الآن</h3>
          </div>
        )}
      </div>
    </div>
  );
}
