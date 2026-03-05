
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { PurchaseInvoice, CashTransaction, Supplier, Product, PurchaseItem } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { 
  Search, Calendar, Truck, Hash, ShoppingBag, TrendingUp, 
  ChevronLeft, Package, FileText, Printer, X, ArrowDownLeft, 
  ArrowUpRight, CreditCard, Receipt, History, Info, Filter,
  ArrowLeft, LayoutDashboard, ListChecks, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '../utils/t';

export default function SupplierReport() {
  const navigate = useNavigate();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'PAYMENTS' | 'ITEMS'>('INVOICES');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  const currency = db.getSettings().currency;
  const suppliers = db.getSuppliers();
  const products = db.getAllProducts();

  const supplierOptions = useMemo(() => 
    suppliers.map(s => ({
      value: s.id,
      label: s.name,
      subLabel: s.phone
    })), [suppliers]);

  const productOptions = useMemo(() => 
    products.map(p => ({
      value: p.id,
      label: p.name,
      subLabel: p.code
    })), [products]);

  // Logic for filtering purchase invoices
  const filteredInvoices = useMemo(() => {
    if (!selectedSupplierId) return [];

    let invoices = db.getPurchaseInvoices().filter(inv => 
      inv.supplier_id === selectedSupplierId && 
      inv.status !== 'CANCELLED'
    );

    // Date filter
    if (fromDate) {
      invoices = invoices.filter(inv => inv.date.split('T')[0] >= fromDate);
    }
    if (toDate) {
      invoices = invoices.filter(inv => inv.date.split('T')[0] <= toDate);
    }

    // Product filter
    if (selectedProductId) {
      invoices = invoices.filter(inv => 
        inv.items.some(item => item.product_id === selectedProductId)
      );
    }

    return invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedSupplierId, fromDate, toDate, selectedProductId]);

  // Logic for filtering payments
  const filteredPayments = useMemo(() => {
    if (!selectedSupplierId) return [];

    const invoiceIds = new Set(filteredInvoices.map(inv => inv.id));
    
    let payments = db.getCashTransactions().filter(tx => 
      tx.category === 'SUPPLIER_PAYMENT' && 
      tx.status !== 'DELETED' && 
      (tx.reference_id === selectedSupplierId || invoiceIds.has(tx.reference_id || ''))
    );

    // Date filter
    if (fromDate) {
      payments = payments.filter(tx => tx.date.split('T')[0] >= fromDate);
    }
    if (toDate) {
      payments = payments.filter(tx => tx.date.split('T')[0] <= toDate);
    }

    return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedSupplierId, filteredInvoices, fromDate, toDate]);

  // Aggregate items summary
  const itemsSummary = useMemo(() => {
    if (!selectedSupplierId) return [];

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
        const pId = item.product_id;
        
        // If product filter is active, skip other products
        if (selectedProductId && pId !== selectedProductId) return;

        const existing = summaryMap.get(pId);
        const price = item.cost_price || 0;
        const value = item.quantity * price;

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

  // Totals calculations
  const totals = useMemo(() => {
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    
    const totalPurchases = filteredInvoices
      .filter(inv => inv.type === 'PURCHASE')
      .reduce((sum, inv) => sum + inv.total_amount, 0);
      
    const totalReturns = filteredInvoices
      .filter(inv => inv.type === 'RETURN')
      .reduce((sum, inv) => sum + inv.total_amount, 0);
      
    const totalPayments = filteredPayments.reduce((sum, tx) => {
      // In SUPPLIER_PAYMENT, EXPENSE means we paid supplier, RECEIPT means supplier paid us (refund)
      return sum + (tx.type === 'EXPENSE' ? tx.amount : -tx.amount);
    }, 0);

    return {
      supplierName: supplier?.name || '',
      openingBalance: supplier?.opening_balance || 0,
      currentBalance: supplier?.current_balance || 0,
      totalPurchases,
      totalReturns,
      totalPayments,
      netMovement: totalPurchases - totalReturns - totalPayments
    };
  }, [selectedSupplierId, filteredInvoices, filteredPayments, suppliers]);

  const handleBack = () => {
    if (selectedInvoice) {
      setSelectedInvoice(null);
    } else {
      navigate('/reports');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 pb-20 md:pb-0">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 md:py-4 shadow-sm">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleBack}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2">
                <Truck className="w-6 h-6 text-emerald-600" />
                تقارير الموردين
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-end">
            <div className="md:col-span-4">
              <SearchableSelect
                label="اختر المورد"
                options={supplierOptions}
                value={selectedSupplierId}
                onChange={(val) => {
                  setSelectedSupplierId(val);
                  setSelectedInvoice(null);
                }}
                placeholder="ابحث باسم المورد أو الهاتف..."
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
      </div>

      <div className="max-w-7xl mx-auto w-full p-4 space-y-6">
        {!selectedSupplierId ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
              <Truck className="w-12 h-12" />
            </div>
            <p className="text-lg font-black text-slate-400">يرجى اختيار مورد لعرض التقرير</p>
            <p className="text-sm mt-2">يمكنك أيضاً تحديد فترة زمنية أو صنف معين للفلترة</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="col-span-2 bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-1">المورد المختار</p>
                  <h2 className="text-lg md:text-2xl font-black text-slate-800 truncate">{totals.supplierName}</h2>
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
                      <span className="text-[8px] mr-1">{totals.currentBalance >= 0 ? '(دائن له)' : '(مدين لنا)'}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                </div>
                <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase mb-1">إجمالي المشتريات</p>
                <p className="text-lg md:text-2xl font-black text-slate-800">{currency}{totals.totalPurchases.toLocaleString()}</p>
              </div>

              <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
                  <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5 text-rose-600" />
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
              {/* Main List Area */}
              <div className={`flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${selectedInvoice ? 'hidden md:flex' : 'flex'}`}>
                {activeTab === 'INVOICES' && (
                  <div className="flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                      <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-blue-500" /> سجل فواتير الشراء
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
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${inv.type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {inv.type === 'PURCHASE' ? 'شراء' : 'مرتجع'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(inv.date).toLocaleDateString('ar-EG')}</span>
                                  <span className="flex items-center gap-1"><Info className="w-3 h-3" /> {inv.items.length} أصناف</span>
                                </div>
                              </div>
                              <div className="text-left">
                                <div className="font-black text-slate-900">{currency}{inv.total_amount.toLocaleString()}</div>
                                <div className={`text-[10px] font-bold ${inv.paid_amount >= inv.total_amount ? 'text-emerald-500' : 'text-orange-500'}`}>
                                  {inv.paid_amount >= inv.total_amount ? 'مدفوع بالكامل' : 'متبقي جزء'}
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
                        <Receipt className="w-4 h-4 text-emerald-500" /> سجل المدفوعات للمورد
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
                            <th className="px-6 py-4 hidden sm:table-cell">المرجع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredPayments.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-600">
                                {new Date(tx.date).toLocaleDateString('ar-EG')}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${tx.type === 'EXPENSE' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {tx.type === 'EXPENSE' ? 'سند صرف' : 'سند قبض'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center font-black text-slate-900">
                                {currency}{tx.amount.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500 font-bold hidden sm:table-cell">
                                {tx.notes}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400 font-bold hidden sm:table-cell">
                                {tx.reference_id && tx.reference_id !== selectedSupplierId ? `فاتورة #${db.getPurchaseInvoices().find(i => i.id === tx.reference_id)?.invoice_number || '---'}` : 'حساب عام'}
                              </td>
                            </tr>
                          ))}
                          {filteredPayments.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-20 text-center text-slate-300 font-bold">لا توجد مدفوعات مسجلة</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'ITEMS' && (
                  <div className="flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/30">
                      <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-purple-500" /> ملخص الأصناف الموردة
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4">الصنف</th>
                            <th className="px-6 py-4 text-center">إجمالي الكمية</th>
                            <th className="px-6 py-4 text-center">إجمالي القيمة</th>
                            <th className="px-6 py-4 text-center hidden sm:table-cell">عدد الفواتير</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {itemsSummary.map((item) => (
                            <tr key={item.productId} className={`hover:bg-slate-50 transition-colors ${selectedProductId === item.productId ? 'bg-blue-50/50' : ''}`}>
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
                              <td className="px-6 py-4 text-center text-slate-400 font-bold hidden sm:table-cell">
                                {item.invoiceCount}
                              </td>
                            </tr>
                          ))}
                          {itemsSummary.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-20 text-center text-slate-300 font-bold">لا توجد بيانات أصناف</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Area (Invoice Details) */}
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
                          <p className={`font-black text-sm ${selectedInvoice.type === 'PURCHASE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {selectedInvoice.type === 'PURCHASE' ? 'مشتريات' : 'مرتجع مشتريات'}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">الإجمالي</p>
                          <p className="font-black text-slate-900 text-lg">
                            {currency}{selectedInvoice.total_amount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="border border-slate-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-xs text-right">
                          <thead className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase">
                            <tr>
                              <th className="px-4 py-3">الصنف</th>
                              <th className="px-4 py-3 text-center">الكمية</th>
                              <th className="px-4 py-3 text-center">التكلفة</th>
                              <th className="px-4 py-3 text-center">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {selectedInvoice.items.map((item: PurchaseItem, idx: number) => {
                              const isTarget = item.product_id === selectedProductId;
                              const price = item.cost_price || 0;
                              const lineTotal = item.quantity * price;

                              return (
                                <tr key={idx} className={`${isTarget ? 'bg-blue-50/50' : ''}`}>
                                  <td className="px-4 py-3 font-bold text-slate-700">
                                    <div className="flex flex-col">
                                      <span>{products.find(p => p.id === item.product_id)?.name || 'صنف غير معروف'}</span>
                                      {isTarget && <span className="text-[8px] text-blue-600 font-black">الصنف المختار</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-600">{item.quantity}</td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-600">{price.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center font-black text-slate-800">
                                    {lineTotal.toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                        <div className="flex justify-between text-sm font-black text-slate-900">
                          <span>الإجمالي النهائي:</span>
                          <span>{currency}{selectedInvoice.total_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-emerald-600">
                          <span>المبلغ المدفوع:</span>
                          <span>{currency}{selectedInvoice.paid_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-rose-500 border-t border-slate-200 pt-2">
                          <span>المتبقي للمورد:</span>
                          <span>{currency}{(selectedInvoice.total_amount - selectedInvoice.paid_amount).toLocaleString()}</span>
                        </div>
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
    </div>
  );
}
