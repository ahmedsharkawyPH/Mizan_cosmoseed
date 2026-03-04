
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { Invoice, CashTransaction } from '../types';
import { Calendar, TrendingUp, DollarSign, Wallet, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, Filter, Download } from 'lucide-react';

interface FinancialAnalysisReportProps {
  startDate: string;
  endDate: string;
}

interface AnalysisRow {
  label: string;
  sales: number;
  profit: number;
  expenses: number;
  netProfit: number;
}

export default function FinancialAnalysisReport({ startDate, endDate }: FinancialAnalysisReportProps) {
  const [viewType, setViewType] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const currency = db.getSettings().currency;

  const analysisData = useMemo(() => {
    const invoices = db.getInvoices().filter(inv => {
      const d = inv.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });

    const expenses = db.getCashTransactions().filter(tx => {
      const d = tx.date.split('T')[0];
      return d >= startDate && d <= endDate && tx.type === 'EXPENSE' && tx.category !== 'SUPPLIER_PAYMENT';
    });

    const calculateInvoiceProfit = (inv: Invoice) => {
      const itemsProfit = inv.items.reduce((acc, item) => {
        const sellPrice = item.unit_price !== undefined ? item.unit_price : (item.batch?.selling_price || 0);
        const costPrice = item.batch?.purchase_price || item.product.purchase_price || 0;
        const revenue = (item.quantity * sellPrice) * (1 - (item.discount_percentage || 0) / 100);
        const cost = (item.quantity + (item.bonus_quantity || 0)) * costPrice;
        return acc + (revenue - cost);
      }, 0);
      const invoiceProfit = itemsProfit - (inv.additional_discount || 0);
      return inv.type === 'SALE' ? invoiceProfit : -invoiceProfit;
    };

    const calculateInvoiceSales = (inv: Invoice) => {
      return inv.type === 'SALE' ? inv.net_total : -inv.net_total;
    };

    const grouped: Record<string, { sales: number; profit: number; expenses: number }> = {};

    // Process Invoices
    invoices.forEach(inv => {
      const date = new Date(inv.date);
      const key = viewType === 'DAILY' 
        ? inv.date.split('T')[0] 
        : `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!grouped[key]) grouped[key] = { sales: 0, profit: 0, expenses: 0 };
      grouped[key].sales += calculateInvoiceSales(inv);
      grouped[key].profit += calculateInvoiceProfit(inv);
    });

    // Process Expenses
    expenses.forEach(tx => {
      const date = new Date(tx.date);
      const key = viewType === 'DAILY' 
        ? tx.date.split('T')[0] 
        : `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!grouped[key]) grouped[key] = { sales: 0, profit: 0, expenses: 0 };
      grouped[key].expenses += tx.amount;
    });

    return Object.entries(grouped)
      .map(([label, data]) => ({
        label,
        sales: data.sales,
        profit: data.profit,
        expenses: data.expenses,
        netProfit: data.profit - data.expenses
      }))
      .sort((a, b) => b.label.localeCompare(a.label));
  }, [startDate, endDate, viewType]);

  const totals = useMemo(() => {
    return analysisData.reduce((acc, curr) => ({
      sales: acc.sales + curr.sales,
      profit: acc.profit + curr.profit,
      expenses: acc.expenses + curr.expenses,
      netProfit: acc.netProfit + curr.netProfit
    }), { sales: 0, profit: 0, expenses: 0, netProfit: 0 });
  }, [analysisData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Controls */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setViewType('DAILY')}
            className={`flex-1 md:flex-none px-8 py-2.5 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${viewType === 'DAILY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Calendar className="w-4 h-4" /> تحليل يومي
          </button>
          <button
            onClick={() => setViewType('MONTHLY')}
            className={`flex-1 md:flex-none px-8 py-2.5 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${viewType === 'MONTHLY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Filter className="w-4 h-4" /> تحليل شهري
          </button>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase">الفترة المحددة</p>
                <p className="text-xs font-bold text-slate-600">{startDate} إلى {endDate}</p>
            </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي المبيعات</p>
            <h3 className="text-xl font-black text-slate-800">{currency}{totals.sales.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">إجمالي الربح</p>
            <h3 className="text-xl font-black text-emerald-600">{currency}{totals.profit.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-rose-500 uppercase mb-1">إجمالي المصروفات</p>
            <h3 className="text-xl font-black text-rose-600">{currency}{totals.expenses.toLocaleString()}</h3>
        </div>
        <div className="bg-slate-900 p-5 rounded-3xl shadow-xl border border-slate-800">
            <p className="text-[10px] font-black text-blue-400 uppercase mb-1">صافي الأرباح</p>
            <h3 className="text-xl font-black text-white">{currency}{totals.netProfit.toLocaleString()}</h3>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">{viewType === 'DAILY' ? 'التاريخ' : 'الشهر'}</th>
                <th className="px-6 py-4 text-center">إجمالي المبيعات</th>
                <th className="px-6 py-4 text-center">الربح</th>
                <th className="px-6 py-4 text-center">المصروفات</th>
                <th className="px-6 py-4 text-left">صافي الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {analysisData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors font-bold">
                  <td className="px-6 py-4 text-slate-700">{row.label}</td>
                  <td className="px-6 py-4 text-center text-slate-900">{currency}{row.sales.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center text-emerald-600">{currency}{row.profit.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center text-rose-600">{currency}{row.expenses.toLocaleString()}</td>
                  <td className={`px-6 py-4 text-left font-black ${row.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    {currency}{row.netProfit.toLocaleString()}
                  </td>
                </tr>
              ))}
              {analysisData.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-300">
                    <p className="font-black">لا توجد بيانات متاحة للفترة المحددة</p>
                  </td>
                </tr>
              )}
            </tbody>
            {analysisData.length > 0 && (
              <tfoot className="bg-slate-50 font-black border-t-2 border-slate-100">
                <tr>
                  <td className="px-6 py-4 text-slate-800">الإجمالي</td>
                  <td className="px-6 py-4 text-center text-slate-900">{currency}{totals.sales.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center text-emerald-600">{currency}{totals.profit.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center text-rose-600">{currency}{totals.expenses.toLocaleString()}</td>
                  <td className={`px-6 py-4 text-left ${totals.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    {currency}{totals.netProfit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
