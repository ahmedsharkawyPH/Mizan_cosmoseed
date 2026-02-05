
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { 
  Calendar, DollarSign, TrendingUp, TrendingDown, Users, Package, 
  ArrowUpRight, ArrowDownLeft, Filter, Truck, Search, Briefcase, 
  Phone, ChevronRight, ChevronDown, Table2, BookOpen, Wallet, 
  BarChart3, Activity, UserCheck, ShieldCheck, ShoppingBag, Star, Clock, AlertTriangle
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Reports() {
  const currency = db.getSettings().currency;
  const location = useLocation();
  
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  
  const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'SALES' | 'PURCHASES' | 'INVENTORY' | 'REPRESENTATIVES' | 'TELESALES' | 'DAILY_SHORTAGES' | 'BEST_SELLING_LIST' | 'STAGNANT_ITEMS'>('FINANCIAL');

  const handleQuickDate = (type: 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR') => {
    const now = new Date();
    let start = '';
    let end = now.toISOString().split('T')[0];
    if (type === 'TODAY') start = end;
    else if (type === 'MONTH') start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    else if (type === 'LAST_MONTH') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (type === 'YEAR') start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
  };

  // --- 1. Financial Data (Corrected for Returns) ---
  const financialData = useMemo(() => {
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });

    // الإيراد الصافي = مبيعات - مرتجعات
    const revenue = invoices.reduce((acc, inv) => 
        inv.type === 'SALE' ? acc + inv.net_total : acc - inv.net_total, 0
    );

    let cogs = 0;
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            const costValue = (item.batch?.purchase_price || item.product.purchase_price || 0) * item.quantity; 
            cogs += (inv.type === 'SALE' ? costValue : -costValue); // تكلفة البضاعة المباعة تخصم عند الرد
        });
    });

    const transactions = db.getCashTransactions().filter(tx => {
        const d = tx.date.split('T')[0];
        return d >= startDate && d <= endDate && tx.type === 'EXPENSE' && tx.category !== 'SUPPLIER_PAYMENT'; 
    });

    const expenses = transactions.reduce((acc, tx) => acc + tx.amount, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;
    
    const expenseBreakdown = transactions.reduce((acc: any, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
        return acc;
    }, {});
    const expenseChartData = Object.keys(expenseBreakdown).map(k => ({ name: t(`cat.${k}`) !== `cat.${k}` ? t(`cat.${k}`) : k, value: expenseBreakdown[k] }));

    return { revenue, cogs, expenses, grossProfit, netProfit, expenseChartData };
  }, [startDate, endDate]);

  // --- 2. Sales Analysis Logic (Corrected for Returns) ---
  const salesData = useMemo(() => {
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });

    const trendMap: Record<string, number> = {};
    invoices.forEach(inv => {
        const day = inv.date.split('T')[0];
        const val = inv.type === 'SALE' ? inv.net_total : -inv.net_total;
        trendMap[day] = (trendMap[day] || 0) + val;
    });
    const salesTrend = Object.entries(trendMap).map(([date, value]) => ({ date, value })).sort((a,b) => a.date.localeCompare(b.date));

    const productSales: Record<string, { qty: number, total: number, code: string }> = {};
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            if (!productSales[item.product.name]) productSales[item.product.name] = { qty: 0, total: 0, code: item.product.code || '' };
            const lineValue = (item.quantity * (item.unit_price || 0)) * (1 - (item.discount_percentage / 100));
            
            if (inv.type === 'SALE') {
                productSales[item.product.name].qty += item.quantity;
                productSales[item.product.name].total += lineValue;
            } else {
                productSales[item.product.name].qty -= item.quantity;
                productSales[item.product.name].total -= lineValue;
            }
        });
    });
    const topProducts = Object.entries(productSales).map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total, code: stats.code })).sort((a, b) => b.total - a.total).slice(0, 10);

    return { topProducts, salesTrend, count: invoices.filter(i=>i.type==='SALE').length, productSales };
  }, [startDate, endDate]);

  // Rest of the analysis remains similar...
  const purchaseData = useMemo(() => {
      const pInvoices = db.getPurchaseInvoices().filter(p => {
          const d = p.date.split('T')[0];
          return d >= startDate && d <= endDate;
      });
      const totalPurchases = pInvoices.reduce((sum, p) => p.type === 'PURCHASE' ? sum + p.total_amount : sum - p.total_amount, 0);
      const supplierVolume: Record<string, number> = {};
      pInvoices.forEach(p => {
          const name = db.getSuppliers().find(s => s.id === p.supplier_id)?.name || 'Unknown';
          supplierVolume[name] = (supplierVolume[name] || 0) + (p.type === 'PURCHASE' ? p.total_amount : -p.total_amount);
      });
      const topSuppliers = Object.entries(supplierVolume).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      return { totalPurchases, pCount: pInvoices.filter(i=>i.type==='PURCHASE').length, topSuppliers };
  }, [startDate, endDate]);

  const repsData = useMemo(() => {
      const reps = db.getRepresentatives();
      const invoices = db.getInvoices().filter(i => {
          const d = i.date.split('T')[0];
          return d >= startDate && d <= endDate;
      });
      return reps.map(r => {
          const repInvoices = invoices.filter(inv => {
              const cust = db.getCustomers().find(c => c.id === inv.customer_id);
              return cust?.representative_code === r.code;
          });
          const sales = repInvoices.reduce((sum, inv) => inv.type === 'SALE' ? sum + inv.net_total : sum - inv.net_total, 0);
          const commission = (sales * (r.commission_rate || 0)) / 100;
          return { name: r.name, code: r.code, sales, commission, count: repInvoices.length };
      }).sort((a,b) => b.sales - a.sales);
  }, [startDate, endDate]);

  // Tab Rendering...
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-6">
         <div className="flex justify-between items-center">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-600" /> تقارير ميزان التحليلية
            </h1>
            <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold border border-blue-100">تحليل حي للبيانات</div>
         </div>

         <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
             <Filter className="w-5 h-5 text-slate-400" />
             <div className="flex items-center gap-3 w-full md:w-auto">
                <input type="date" className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-blue-500 transition-all" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-slate-400 font-bold">إلى</span>
                <input type="date" className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-blue-500 transition-all" value={endDate} onChange={e => setEndDate(e.target.value)} />
             </div>
             <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full md:w-auto">
                 <button onClick={() => handleQuickDate('TODAY')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all">اليوم</button>
                 <button onClick={() => handleQuickDate('MONTH')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all">هذا الشهر</button>
                 <button onClick={() => handleQuickDate('YEAR')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all">السنة</button>
             </div>
         </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {[
              { id: 'FINANCIAL', label: 'المالية (P&L)', icon: DollarSign },
              { id: 'SALES', label: 'المبيعات', icon: TrendingUp },
              { id: 'PURCHASES', label: 'المشتريات', icon: ShoppingBag },
              { id: 'REPRESENTATIVES', label: 'المندوبين', icon: Briefcase },
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
                  <tab.icon className="w-4 h-4" />{tab.label}
              </button>
          ))}
      </div>

      {activeTab === 'FINANCIAL' && (
          <div className="animate-in fade-in space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><p className="text-gray-400 text-[10px] font-black uppercase mb-1">صافي المبيعات</p><h3 className="text-2xl font-black text-slate-800">{currency}{financialData.revenue.toLocaleString()}</h3></div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><p className="text-emerald-500 text-[10px] font-black uppercase mb-1">مجمل الربح</p><h3 className="text-2xl font-black text-emerald-600">{currency}{financialData.grossProfit.toLocaleString()}</h3></div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><p className="text-rose-500 text-[10px] font-black uppercase mb-1">المصروفات</p><h3 className="text-2xl font-black text-rose-600">-{currency}{financialData.expenses.toLocaleString()}</h3></div>
                  <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 ring-4 ring-slate-100"><p className="text-blue-400 text-[10px] font-black uppercase mb-1">صافي الأرباح</p><h3 className="text-3xl font-black text-white">{currency}{financialData.netProfit.toLocaleString()}</h3></div>
              </div>
          </div>
      )}

      {activeTab === 'SALES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
               <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="font-black text-slate-800 mb-8 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> مؤشر المبيعات الصافي اليومي</h3>
                  <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={salesData.salesTrend}>
                              <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Tooltip />
                              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
