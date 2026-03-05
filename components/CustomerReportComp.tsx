
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { Invoice, Customer, Product, CartItem } from '../types';
import SearchableSelect from './SearchableSelect';
import { 
  Search, Calendar, User, ShoppingBag, TrendingUp, 
  ChevronLeft, Package, FileText, X, ArrowDownLeft, 
  Receipt, History, Info, Filter, ListChecks, BarChart3,
  CreditCard
} from 'lucide-react';

interface CustomerReportCompProps {
  initialCustomerId?: string;
  initialProductId?: string;
  startDate?: string;
  endDate?: string;
}

export default function CustomerReportComp({ 
  initialCustomerId = '', 
  initialProductId = '',
  startDate = '',
  endDate = ''
}: CustomerReportCompProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId);
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId);
  const [fromDate, setFromDate] = useState<string>(startDate);
  const [toDate, setToDate] = useState<string>(endDate);
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'PAYMENTS' | 'ITEMS'>('INVOICES');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const currency = db.getSettings().currency;
  const customers = db.getCustomers();
  const products = db.getAllProducts();

  const customerOptions = useMemo(() => 
    customers.map(c => ({
      value: c.id,
      label: c.name,
      subLabel: c.phone
    })), [customers]);

  const productOptions = useMemo(() => 
    products.map(p => ({
      value: p.id,
      label: p.name,
      subLabel: p.code
    })), [products]);

  const filteredInvoices = useMemo(() => {
    if (!selectedCustomerId) return [];

    let invoices = db.getInvoices().filter(inv => 
      inv.customer_id === selectedCustomerId && 
      inv.status !== 'CANCELLED'
    );

    if (fromDate) invoices = invoices.filter(inv => inv.date.split('T')[0] >= fromDate);
    if (toDate) invoices = invoices.filter(inv => inv.date.split('T')[0] <= toDate);

    if (selectedProductId) {
      invoices = invoices.filter(inv => 
        inv.items.some(item => item.product.id === selectedProductId)
      );
    }

    return invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCustomerId, fromDate, toDate, selectedProductId]);

  const filteredPayments = useMemo(() => {
    if (!selectedCustomerId) return [];

    const invoiceIds = new Set(filteredInvoices.map(inv => inv.id));
    
    let payments = db.getCashTransactions().filter(tx => 
      tx.category === 'CUSTOMER_PAYMENT' && 
      tx.status !== 'DELETED' && 
      (tx.reference_id === selectedCustomerId || invoiceIds.has(tx.reference_id || ''))
    );

    if (fromDate) payments = payments.filter(tx => tx.date.split('T')[0] >= fromDate);
    if (toDate) payments = payments.filter(tx => tx.date.split('T')[0] <= toDate);

    return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCustomerId, filteredInvoices, fromDate, toDate]);

  const itemsSummary = useMemo(() => {
    if (!selectedCustomerId) return [];

    const summaryMap = new Map<string, { 
      productId: string; 
      name: string; 
      code: string; 
      totalQty: number; 
      totalValue: number; 
      invoiceCount: number; 
    }>();

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const pId = item.product.id;
        if (selectedProductId && pId !== selectedProductId) return;

        const existing = summaryMap.get(pId);
        const price = item.unit_price || 0;
        const discount = item.discount_percentage || 0;
        const value = (item.quantity * price) * (1 - discount / 100);

        if (existing) {
          existing.totalQty += item.quantity;
          existing.totalValue += value;
          existing.invoiceCount += 1;
        } else {
          const p = products.find(prod => prod.id === pId);
          summaryMap.set(pId, {
            productId: pId,
            name: p?.name || 'صنف غير معروف',
            code: p?.code || '',
            totalQty: item.quantity,
            totalValue: value,
            invoiceCount: 1
          });
        }
      });
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredInvoices, selectedProductId, products]);

  const totals = useMemo(() => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    
    const totalSales = filteredInvoices
      .filter(inv => inv.type === 'SALE')
      .reduce((sum, inv) => sum + inv.net_total, 0);
      
    const totalReturns = filteredInvoices
      .filter(inv => inv.type === 'RETURN')
      .reduce((sum, inv) => sum + inv.net_total, 0);
      
    const totalPayments = filteredPayments.reduce((sum, tx) => {
      return sum + (tx.type === 'RECEIPT' ? tx.amount : -tx.amount);
    }, 0);

    return {
      customerName: customer?.name || '',
      openingBalance: customer?.opening_balance || 0,
      currentBalance: customer?.current_balance || 0,
      totalSales,
      totalReturns,
      totalPayments,
      netMovement: totalSales - totalReturns - totalPayments
    };
  }, [selectedCustomerId, filteredInvoices, filteredPayments, customers]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <SearchableSelect
              label="اختر العميل"
              options={customerOptions}
              value={selectedCustomerId}
              onChange={(val) => {
                setSelectedCustomerId(val);
                setSelectedInvoice(null);
              }}
              placeholder="ابحث باسم العميل أو الهاتف..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 mr-1">من تاريخ</label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 mr-1">إلى تاريخ</label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-4">
            <SearchableSelect
              label="فلترة بصنف معين (اختياري)"
              options={productOptions}
              value={selectedProductId}
              onChange={setSelectedProductId}
              placeholder="ابحث باسم الصنف أو الكود..."
            />
          </div>
        </div>
      </div>

      {!selectedCustomerId ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
            <User className="w-12 h-12" />
          </div>
          <p className="text-lg font-black text-slate-400">يرجى اختيار عميل لعرض التقرير</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="col-span-2 bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-1">العميل المختار</p>
                <h2 className="text-lg md:text-2xl font-black text-slate-800 truncate">{totals.customerName}</h2>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">الرصيد الافتتاحي</p>
                  <p className="font-bold text-slate-600">{currency}{totals.openingBalance.toLocaleString()}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">الرصيد الحالي</p>
                  <p className={`font-black ${totals.currentBalance >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {currency}{Math.abs(totals.currentBalance).toLocaleString()}
                    <span className="text-[8px] mr-1">{totals.currentBalance >= 0 ? '(مدين)' : '(دائن)'}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              </div>
              <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-1">إجمالي المبيعات</p>
              <p className="text-lg md:text-2xl font-black text-slate-800">{currency}{totals.totalSales.toLocaleString()}</p>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5 text-rose-600" />
              </div>
              <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-1">إجمالي المرتجعات</p>
              <p className="text-lg md:text-2xl font-black text-slate-800">{currency}{totals.totalReturns.toLocaleString()}</p>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                <Receipt className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
              </div>
              <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-1">إجمالي المدفوعات</p>
              <p className="text-lg md:text-2xl font-black text-slate-800">{currency}{totals.totalPayments.toLocaleString()}</p>
            </div>

            <div className="bg-slate-900 p-4 md:p-6 rounded-3xl shadow-lg shadow-slate-200">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                <History className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-1">صافي حركة الفترة</p>
              <p className="text-lg md:text-2xl font-black text-white">{currency}{totals.netMovement.toLocaleString()}</p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto scrollbar-hide">
            <button 
              onClick={() => { setActiveTab('INVOICES'); setSelectedInvoice(null); }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'INVOICES' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" /> الفواتير ({filteredInvoices.length})
            </button>
            <button 
              onClick={() => { setActiveTab('PAYMENTS'); setSelectedInvoice(null); }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <CreditCard className="w-4 h-4" /> المدفوعات ({filteredPayments.length})
            </button>
            <button 
              onClick={() => { setActiveTab('ITEMS'); setSelectedInvoice(null); }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'ITEMS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Package className="w-4 h-4" /> الأصناف ({itemsSummary.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex flex-col md:flex-row gap-6 min-h-[500px]">
            <div className={`flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${selectedInvoice ? 'hidden md:flex' : 'flex'}`}>
              {activeTab === 'INVOICES' && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                    <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-blue-500" /> سجل الفواتير
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {filteredInvoices.length > 0 ? (
                      <div className="divide-y divide-slate-50">
                        {filteredInvoices.map((inv) => (
                          <button
                            key={inv.id}
                            onClick={() => setSelectedInvoice(inv)}
                            className={`w-full p-4 text-right hover:bg-slate-50 transition-all flex items-center justify-between group ${selectedInvoice?.id === inv.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 text-sm">#{inv.invoice_number}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${inv.type === 'SALE' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                  {inv.type === 'SALE' ? 'بيع' : 'مرتجع'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(inv.date).toLocaleDateString('ar-EG')}</span>
                                <span className="flex items-center gap-1"><Info className="w-3 h-3" /> {inv.items.length} أصناف</span>
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="font-black text-slate-900">{currency}{inv.net_total.toLocaleString()}</div>
                              <div className={`text-[10px] font-bold ${inv.payment_status === 'PAID' ? 'text-emerald-500' : 'text-orange-500'}`}>
                                {inv.payment_status === 'PAID' ? 'مدفوع بالكامل' : 'متبقي جزء'}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center text-slate-400">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold">لا توجد فواتير تطابق الفلترة</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'PAYMENTS' && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/30">
                    <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-500" /> سجل المدفوعات
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">التاريخ</th>
                          <th className="px-6 py-4">النوع</th>
                          <th className="px-6 py-4 text-center">المبلغ</th>
                          <th className="px-6 py-4 hidden sm:table-cell">البيان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredPayments.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-600">
                              {new Date(tx.date).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${tx.type === 'RECEIPT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {tx.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-black text-slate-900">
                              {currency}{tx.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-bold hidden sm:table-cell">
                              {tx.notes}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'ITEMS' && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/30">
                    <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-500" /> ملخص الأصناف
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">الصنف</th>
                          <th className="px-6 py-4 text-center">إجمالي الكمية</th>
                          <th className="px-6 py-4 text-center">إجمالي القيمة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {itemsSummary.map((item) => (
                          <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-black text-slate-800">{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-bold">{item.code}</div>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-600">
                              {item.totalQty}
                            </td>
                            <td className="px-6 py-4 text-center font-black text-slate-900">
                              {currency}{item.totalValue.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Detail Area */}
            <div className={`flex-[1.2] bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${!selectedInvoice ? 'hidden md:flex' : 'flex'}`}>
              {selectedInvoice ? (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedInvoice(null)} className="md:hidden p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-slate-600 rotate-180" />
                      </button>
                      <div>
                        <h3 className="font-black text-slate-800 text-sm">تفاصيل الفاتورة #{selectedInvoice.invoice_number}</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(selectedInvoice.date).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedInvoice(null)} className="hidden md:block p-2 hover:bg-slate-200 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">نوع الفاتورة</p>
                        <p className={`font-black text-sm ${selectedInvoice.type === 'SALE' ? 'text-blue-600' : 'text-rose-600'}`}>
                          {selectedInvoice.type === 'SALE' ? 'مبيعات' : 'مرتجع مبيعات'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">الإجمالي الصافي</p>
                        <p className="font-black text-slate-900 text-lg">
                          {currency}{selectedInvoice.net_total.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase">
                          <tr>
                            <th className="px-4 py-3">الصنف</th>
                            <th className="px-4 py-3 text-center">الكمية</th>
                            <th className="px-4 py-3 text-center">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedInvoice.items.map((item: any, idx: number) => {
                            const price = item.unit_price || 0;
                            const discount = item.discount_percentage || 0;
                            const lineTotal = (item.quantity * price) * (1 - discount / 100);
                            return (
                              <tr key={idx}>
                                <td className="px-4 py-3 font-bold text-slate-700">{item.product.name}</td>
                                <td className="px-4 py-3 text-center font-bold text-slate-600">{item.quantity}</td>
                                <td className="px-4 py-3 text-center font-black text-slate-800">{lineTotal.toLocaleString()}</td>
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
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-10 h-10" />
                  </div>
                  <p className="font-black text-slate-400">اختر فاتورة لعرض تفاصيلها</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
