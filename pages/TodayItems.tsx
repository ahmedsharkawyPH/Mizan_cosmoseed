
import React, { useMemo, useState } from 'react';
import { db } from '../services/db';
import { ListChecks, Package, Search, Printer, FileDown, Loader2 } from 'lucide-react';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';

export default function TodayItems() {
  const currency = db.getSettings().currency;
  const [isExporting, setIsExporting] = useState(false);
  
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('today-items-report');
    if (!element) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Today_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #today-items-report, #today-items-report * { visibility: visible; }
          #today-items-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-blue-600" />
            أصناف اليوم المباعة
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            عرض تجميعي لكافة الأصناف التي تم بيعها اليوم بتاريخ {new Date().toLocaleDateString('ar-EG')}
          </p>
        </div>
        
        <div className="flex items-center gap-2 print-hide">
          <button 
            onClick={handleExportPDF}
            disabled={isExporting || todaySoldItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-colors text-sm font-bold disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            PDF
          </button>
          <button 
            onClick={handlePrint}
            disabled={todaySoldItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-bold shadow-md disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </button>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-100">
            إجمالي الأصناف: {todaySoldItems.length}
          </div>
        </div>
      </div>

      <div id="today-items-report" className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-100 hidden print:block">
            <h2 className="text-xl font-bold text-center text-slate-800">تقرير المبيعات اليومي للأصناف</h2>
            <p className="text-center text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-right">اسم الصنف</th>
                <th className="px-6 py-4 text-center">الكمية المباعة</th>
                <th className="px-6 py-4 text-center">القيمة الإجمالية</th>
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

        <div className="p-6 border-t border-slate-100 hidden print:flex justify-between items-center text-xs font-bold text-slate-500">
            <span>تم الاستخراج بواسطة: ميزان أونلاين</span>
            <span>تاريخ الاستخراج: {new Date().toLocaleString('ar-EG')}</span>
        </div>
      </div>
    </div>
  );
}
