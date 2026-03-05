
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Invoice, PurchaseInvoice, Product } from '../types';
import SearchableSelect from './SearchableSelect';
import { Search, Calendar, User, Hash, ShoppingBag, TrendingUp, ChevronLeft, Package, FileText, Printer, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { t } from '../utils/t';

interface ProductReportProps {
  startDate: string;
  endDate: string;
}

export default function ProductReport({ startDate, endDate }: ProductReportProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [reportType, setReportType] = useState<'SALES' | 'SALES_RETURN' | 'PURCHASES' | 'PURCHASES_RETURN'>('SALES');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | PurchaseInvoice | null>(null);
  
  const products = db.getAllProducts();
  const productOptions = useMemo(() => 
    products.map(p => ({
      value: p.id,
      label: p.name,
      subLabel: p.code
    })), [products]);

  const filteredInvoices = useMemo(() => {
    if (!selectedProductId) return [];

    if (reportType === 'SALES' || reportType === 'SALES_RETURN') {
      const targetType = reportType === 'SALES' ? 'SALE' : 'RETURN';
      return db.getInvoices().filter(inv => {
        const date = inv.date.split('T')[0];
        const hasProduct = inv.items.some(item => item.product.id === selectedProductId);
        return date >= startDate && date <= endDate && hasProduct && inv.type === targetType;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const targetType = reportType === 'PURCHASES' ? 'PURCHASE' : 'RETURN';
      return db.getPurchaseInvoices().filter(inv => {
        const date = inv.date.split('T')[0];
        const hasProduct = inv.items.some(item => item.product_id === selectedProductId);
        return date >= startDate && date <= endDate && hasProduct && inv.type === targetType;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }, [selectedProductId, reportType, startDate, endDate]);

  const getCustomerName = (id: string) => db.getCustomers().find(c => c.id === id)?.name || '...';
  const getSupplierName = (id: string) => db.getSuppliers().find(s => s.id === id)?.name || '...';

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-180px)] gap-4 md:gap-6 animate-in fade-in duration-500">
      {/* Search Header */}
      <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 md:gap-4 items-end">
        <div className="flex-1 w-full">
          <SearchableSelect
            label="اختر الصنف للبحث"
            options={productOptions}
            value={selectedProductId}
            onChange={setSelectedProductId}
            placeholder="ابحث باسم الصنف أو الكود..."
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-hide w-full md:w-auto">
          <button
            onClick={() => { setReportType('SALES'); setSelectedInvoice(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${reportType === 'SALES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <TrendingUp className="w-4 h-4" /> مبيعات
          </button>
          <button
            onClick={() => { setReportType('SALES_RETURN'); setSelectedInvoice(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${reportType === 'SALES_RETURN' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ArrowDownLeft className="w-4 h-4" /> مرتجع مبيعات
          </button>
          <button
            onClick={() => { setReportType('PURCHASES'); setSelectedInvoice(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${reportType === 'PURCHASES' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ShoppingBag className="w-4 h-4" /> مشتريات
          </button>
          <button
            onClick={() => { setReportType('PURCHASES_RETURN'); setSelectedInvoice(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${reportType === 'PURCHASES_RETURN' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ArrowUpRight className="w-4 h-4" /> مرتجع مشتريات
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 gap-4 md:gap-6 overflow-hidden">
        {/* Left Side: Invoice Details (Hidden on mobile if no invoice selected) */}
        <div className={`flex-[1.5] bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${!selectedInvoice ? 'hidden md:flex' : 'flex'}`}>
          {selectedInvoice ? (
            <div className="flex flex-col h-full">
              <div className="p-3 md:p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  {/* Mobile Back Button */}
                  <button onClick={() => setSelectedInvoice(null)} className="md:hidden p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600 rotate-180" />
                  </button>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm md:text-lg">تفاصيل الفاتورة #{selectedInvoice.invoice_number}</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 font-bold mt-0.5 md:mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(selectedInvoice.date).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="hidden md:block p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="bg-slate-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100">
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase mb-1">{reportType.startsWith('SALES') ? 'العميل' : 'المورد'}</p>
                    <p className="font-bold text-slate-700 text-xs md:text-base flex items-center gap-2 truncate">
                      <User className="w-3.5 h-3.5 md:w-4 h-4 text-blue-500 shrink-0" />
                      {reportType.startsWith('SALES') 
                        ? getCustomerName((selectedInvoice as Invoice).customer_id) 
                        : getSupplierName((selectedInvoice as PurchaseInvoice).supplier_id)}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100">
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase mb-1">الإجمالي الصافي</p>
                    <p className="font-black text-slate-900 text-sm md:text-lg">
                      {db.getSettings().currency}
                      {'net_total' in selectedInvoice ? selectedInvoice.net_total.toLocaleString() : selectedInvoice.total_amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-xl md:rounded-2xl overflow-hidden">
                  <table className="w-full text-xs md:text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 font-black text-[9px] md:text-[10px] uppercase">
                      <tr>
                        <th className="px-3 md:px-4 py-3">الصنف</th>
                        <th className="px-3 md:px-4 py-3 text-center">الكمية</th>
                        <th className="px-3 md:px-4 py-3 text-center hidden sm:table-cell">السعر</th>
                        <th className="px-3 md:px-4 py-3 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedInvoice.items.map((item: any, idx: number) => {
                        const isTarget = (item.product?.id || item.product_id) === selectedProductId;
                        return (
                          <tr key={idx} className={`${isTarget ? 'bg-blue-50/50' : ''}`}>
                            <td className="px-3 md:px-4 py-3 font-bold text-slate-700">
                              <div className="flex flex-col">
                                <span>{item.product?.name || db.getAllProducts().find(p => p.id === item.product_id)?.name}</span>
                                {isTarget && <span className="text-[8px] text-blue-600 font-black">الصنف المختار</span>}
                              </div>
                            </td>
                            <td className="px-3 md:px-4 py-3 text-center font-bold text-slate-600">{item.quantity}</td>
                            <td className="px-3 md:px-4 py-3 text-center font-bold text-slate-600 hidden sm:table-cell">
                              {(item.unit_price || item.cost_price || 0).toLocaleString()}
                            </td>
                            <td className="px-3 md:px-4 py-3 text-center font-black text-slate-800">
                              {((item.quantity * (item.unit_price || item.cost_price || 0)) * (1 - (item.discount_percentage || 0) / 100)).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
              <div className="w-16 md:w-20 h-16 md:h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 md:w-10 h-8 md:h-10" />
              </div>
              <p className="font-black text-slate-400 text-sm md:text-base">اختر فاتورة من القائمة لعرض تفاصيلها</p>
              <p className="text-[10px] md:text-xs mt-2">سيتم عرض كافة الأصناف والأسعار هنا</p>
            </div>
          )}
        </div>

        {/* Right Side: Invoice List (Hidden on mobile if an invoice is selected) */}
        <div className={`flex-1 bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${selectedInvoice ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 md:p-4 border-b border-slate-50 bg-slate-50/30">
            <h3 className="font-black text-slate-700 text-xs md:text-sm flex items-center gap-2">
              <Package className="w-3.5 md:w-4 h-3.5 md:h-4 text-slate-400" /> قائمة الفواتير ({filteredInvoices.length})
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredInvoices.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {filteredInvoices.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className={`w-full p-3 md:p-4 text-right hover:bg-slate-50 transition-all flex items-center justify-between group ${selectedInvoice?.id === inv.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800 text-xs md:text-sm">#{inv.invoice_number}</span>
                        <span className={`text-[9px] md:text-[10px] px-2 py-0.5 rounded-full font-bold ${inv.type === 'SALE' || inv.type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {inv.type === 'SALE' ? 'بيع' : inv.type === 'RETURN' ? 'مرتجع' : inv.type === 'PURCHASE' ? 'شراء' : 'مرتجع شراء'}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[10px] md:text-xs text-slate-500 font-bold">
                        <span className="flex items-center gap-1 truncate max-w-[150px]"><User className="w-3 h-3 shrink-0" /> 
                          {reportType.startsWith('SALES') ? getCustomerName((inv as Invoice).customer_id) : getSupplierName((inv as PurchaseInvoice).supplier_id)}
                        </span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 shrink-0" /> {new Date(inv.date).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>
                    <ChevronLeft className={`w-4 md:w-5 h-4 md:h-5 text-slate-300 group-hover:text-blue-500 transition-all ${selectedInvoice?.id === inv.id ? 'text-blue-500 translate-x-[-4px]' : ''}`} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-slate-400">
                <Search className="w-8 md:w-10 h-8 md:h-10 mx-auto mb-3 opacity-20" />
                <p className="text-[10px] md:text-xs font-bold">لا توجد فواتير لهذا الصنف في الفترة المحددة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
