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

  // --- 1. Financial Data ---
  const financialData = useMemo(() => {
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate && i.type === 'SALE';
    });
    const revenue = invoices.reduce((acc, inv) => acc + inv.net_total, 0);
    let cogs = 0;
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            const cost = (item.batch?.purchase_price || item.product.purchase_price || 0) * item.quantity; 
            cogs += cost;
        });
    });
    const transactions = db.getCashTransactions().filter(tx => {
        const d = tx.date.split('T')[0];
        return d >= startDate && d <= endDate && tx.type === 'EXPENSE' && tx.category !== 'SUPPLIER_PAYMENT'; 
    });
    const expenses = transactions.reduce((acc, tx) => acc + tx.amount, 0);
    const expenseBreakdown = transactions.reduce((acc: any, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
        return acc;
    }, {});
    const expenseChartData = Object.keys(expenseBreakdown).map(k => ({ name: t(`cat.${k}`) !== `cat.${k}` ? t(`cat.${k}`) : k, value: expenseBreakdown[k] }));
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;
    return { revenue, cogs, expenses, grossProfit, netProfit, expenseChartData };
  }, [startDate, endDate]);

  // --- 2. Sales Analysis Logic ---
  const salesData = useMemo(() => {
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate && i.type === 'SALE';
    });

    const trendMap: Record<string, number> = {};
    invoices.forEach(inv => {
        const day = inv.date.split('T')[0];
        trendMap[day] = (trendMap[day] || 0) + inv.net_total;
    });
    const salesTrend = Object.entries(trendMap).map(([date, value]) => ({ date, value })).sort((a,b) => a.date.localeCompare(b.date));

    const productSales: Record<string, { qty: number, total: number, code: string }> = {};
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            if (!productSales[item.product.name]) productSales[item.product.name] = { qty: 0, total: 0, code: item.product.code || '' };
            productSales[item.product.name].qty += item.quantity;
            productSales[item.product.name].total += (item.quantity * (item.unit_price || 0)) * (1 - (item.discount_percentage / 100));
        });
    });
    const topProducts = Object.entries(productSales).map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total, code: stats.code })).sort((a, b) => b.total - a.total).slice(0, 10);

    return { topProducts, salesTrend, count: invoices.length, avgInvoice: invoices.length > 0 ? (invoices.reduce((s,i)=>s+i.net_total,0) / invoices.length) : 0, productSales };
  }, [startDate, endDate]);

  // --- 3. Purchases Analysis Logic ---
  const purchaseData = useMemo(() => {
      const pInvoices = db.getPurchaseInvoices().filter(p => {
          const d = p.date.split('T')[0];
          return d >= startDate && d <= endDate && p.type === 'PURCHASE';
      });
      const totalPurchases = pInvoices.reduce((sum, p) => sum + p.total_amount, 0);
      const supplierVolume: Record<string, number> = {};
      pInvoices.forEach(p => {
          const name = db.getSuppliers().find(s => s.id === p.supplier_id)?.name || 'Unknown';
          supplierVolume[name] = (supplierVolume[name] || 0) + p.total_amount;
      });
      const topSuppliers = Object.entries(supplierVolume).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      return { totalPurchases, pCount: pInvoices.length, topSuppliers };
  }, [startDate, endDate]);

  // --- 4. Representatives Analysis Logic ---
  const repsData = useMemo(() => {
      const reps = db.getRepresentatives();
      const invoices = db.getInvoices().filter(i => {
          const d = i.date.split('T')[0];
          return d >= startDate && d <= endDate && i.type === 'SALE';
      });
      const report = reps.map(r => {
          const repInvoices = invoices.filter(inv => {
              const cust = db.getCustomers().find(c => c.id === inv.customer_id);
              return cust?.representative_code === r.code;
          });
          const sales = repInvoices.reduce((sum, inv) => sum + inv.net_total, 0);
          const commission = (sales * (r.commission_rate || 0)) / 100;
          return { name: r.name, code: r.code, sales, commission, count: repInvoices.length };
      }).sort((a,b) => b.sales - a.sales);
      return report;
  }, [startDate, endDate]);

  // --- 5. Telesales Analysis Logic ---
  const teleData = useMemo(() => {
      const teles = authService.getUsers().filter(u => u.role === 'TELESALES');
      const invoices = db.getInvoices().filter(i => {
          const d = i.date.split('T')[0];
          return d >= startDate && d <= endDate && i.type === 'SALE';
      });
      return teles.map(t => {
          const tInvoices = invoices.filter(inv => inv.created_by === t.id);
          const sales = tInvoices.reduce((sum, inv) => sum + inv.net_total, 0);
          return { name: t.name, sales, count: tInvoices.length };
      }).sort((a,b) => b.sales - a.sales);
  }, [startDate, endDate]);

  // --- 6. Inventory Logic ---
  const inventoryData = useMemo(() => {
      const products = db.getProductsWithBatches();
      let totalValue = 0;
      const items = products.map(p => {
          const qty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
          const val = qty * (p.purchase_price || 0);
          totalValue += val;
          return { name: p.name, qty, val, code: p.code };
      }).sort((a,b) => b.val - a.val);
      return { items, totalValue };
  }, []);

  // --- New Tabs Logic ---

  // A. Daily Shortages (Sold Today + Low Stock)
  const dailyShortages = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const invoicesToday = db.getInvoices().filter(inv => inv.date.startsWith(todayStr) && inv.type === 'SALE');
    const products = db.getProductsWithBatches();
    const threshold = db.getSettings().lowStockThreshold || 10;
    
    const soldTodayMap: Record<string, number> = {};
    invoicesToday.forEach(inv => {
        inv.items.forEach(item => {
            soldTodayMap[item.product.id] = (soldTodayMap[item.product.id] || 0) + item.quantity;
        });
    });

    return products.map(p => {
        const stock = p.batches.reduce((s, b) => s + b.quantity, 0);
        const soldToday = soldTodayMap[p.id] || 0;
        return { ...p, stock, soldToday };
    }).filter(p => p.soldToday > 0 && (p.stock < p.soldToday || p.stock < threshold))
    .sort((a,b) => a.stock - b.stock);
  }, []);

  // B. Stagnant Items (Stock > 0 but Sales = 0 in period)
  const stagnantItems = useMemo(() => {
    const products = db.getProductsWithBatches();
    const soldInPeriod = new Set();
    
    db.getInvoices().forEach(inv => {
        const d = inv.date.split('T')[0];
        if (d >= startDate && d <= endDate && inv.type === 'SALE') {
            inv.items.forEach(item => soldInPeriod.add(item.product.id));
        }
    });

    return products.map(p => {
        const stock = p.batches.reduce((s, b) => s + b.quantity, 0);
        return { ...p, stock };
    }).filter(p => p.stock > 0 && !soldInPeriod.has(p.id))
    .sort((a,b) => b.stock - a.stock);
  }, [startDate, endDate]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Date Filter Section */}
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

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {[
              { id: 'FINANCIAL', label: 'المالية (P&L)', icon: DollarSign },
              { id: 'SALES', label: 'المبيعات', icon: TrendingUp },
              { id: 'DAILY_SHORTAGES', label: 'نواقص اليوم', icon: AlertTriangle },
              { id: 'BEST_SELLING_LIST', label: 'الأكثر مبيعاً', icon: Star },
              { id: 'STAGNANT_ITEMS', label: 'الرواكد', icon: Clock },
              { id: 'PURCHASES', label: 'المشتريات', icon: ShoppingBag },
              { id: 'INVENTORY', label: 'المخزون', icon: Package },
              { id: 'REPRESENTATIVES', label: 'المندوبين', icon: Briefcase },
              { id: 'TELESALES', label: 'التيليسيلز', icon: Phone },
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
                  <tab.icon className="w-4 h-4" />{tab.label}
              </button>
          ))}
      </div>

      {/* 1. SALES TAB */}
      {activeTab === 'SALES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                      <p className="text-gray-400 text-[10px] font-black uppercase mb-1">إجمالي الفواتير</p>
                      <h3 className="text-3xl font-black text-slate-800">{salesData.count}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                      <p className="text-gray-400 text-[10px] font-black uppercase mb-1">متوسط قيمة الفاتورة</p>
                      <h3 className="text-3xl font-black text-blue-600">{currency}{salesData.avgInvoice.toLocaleString()}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                      <p className="text-gray-400 text-[10px] font-black uppercase mb-1">صافي المبيعات</p>
                      <h3 className="text-3xl font-black text-emerald-600">{currency}{financialData.revenue.toLocaleString()}</h3>
                  </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="font-black text-slate-800 mb-8 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> مؤشر المبيعات اليومي</h3>
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

      {/* 2. DAILY SHORTAGES TAB */}
      {activeTab === 'DAILY_SHORTAGES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 bg-red-50 border-b flex items-center gap-2 font-black text-red-700">
                      <AlertTriangle className="w-5 h-5" /> الأصناف المباعة اليوم (نواقص محتملة)
                  </div>
                  <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px]">
                          <tr>
                              <th className="p-4">اسم الصنف</th>
                              <th className="p-4 text-center">الكمية المباعة اليوم</th>
                              <th className="p-4 text-center">الرصيد المتبقي</th>
                              <th className="p-4 text-center">الحالة</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {dailyShortages.map((p, i) => (
                              <tr key={i} className="hover:bg-red-50/30 transition-colors">
                                  <td className="p-4 font-bold text-slate-800">{p.name} <div className="text-[10px] text-gray-400 font-mono">#{p.code}</div></td>
                                  <td className="p-4 text-center font-black text-blue-600">{p.soldToday}</td>
                                  <td className="p-4 text-center font-black text-slate-700">{p.stock}</td>
                                  <td className="p-4 text-center">
                                      {p.stock <= 0 ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">نفذت تماماً</span> : <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black">رصيد حرج</span>}
                                  </td>
                              </tr>
                          ))}
                          {dailyShortages.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-gray-400 font-bold">لا يوجد نواقص ناتجة عن مبيعات اليوم</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* 3. BEST SELLING TAB */}
      {activeTab === 'BEST_SELLING_LIST' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 bg-emerald-50 border-b flex items-center gap-2 font-black text-emerald-700">
                      <Star className="w-5 h-5" /> قائمة الأصناف الأكثر مبيعاً (خلال الفترة)
                  </div>
                  <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px]">
                          <tr>
                              <th className="p-4">الترتيب</th>
                              <th className="p-4">الصنف</th>
                              <th className="p-4 text-center">الكمية المباعة</th>
                              <th className="p-4 text-center">إجمالي القيمة الإيرادات</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {/* Fix: Explicitly cast Object.entries to handle unknown property access errors */}
                          {(Object.entries(salesData.productSales) as [string, { qty: number; total: number; code: string }][])
                            .map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total, code: stats.code }))
                            .sort((a,b) => b.total - a.total)
                            .map((p, i) => (
                              <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                                  <td className="p-4 text-center font-black text-gray-400">{i+1}</td>
                                  <td className="p-4 font-bold text-slate-800">{p.name}</td>
                                  <td className="p-4 text-center font-black text-slate-600">{p.qty}</td>
                                  <td className="p-4 text-center font-black text-emerald-600">{currency}{p.total.toLocaleString()}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* 4. STAGNANT ITEMS TAB */}
      {activeTab === 'STAGNANT_ITEMS' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 bg-amber-50 border-b flex items-center gap-2 font-black text-amber-700">
                      <Clock className="w-5 h-5" /> الرواكد (أصناف بالمخزن ولم تبع خلال الفترة)
                  </div>
                  <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px]">
                          <tr>
                              <th className="p-4">اسم الصنف</th>
                              <th className="p-4 text-center">الرصيد الراكد</th>
                              <th className="p-4 text-center">قيمة المخزون الراكد</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {stagnantItems.map((p, i) => (
                              <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                                  <td className="p-4 font-bold text-slate-800">{p.name} <div className="text-[10px] text-gray-400 font-mono">#{p.code}</div></td>
                                  <td className="p-4 text-center font-black text-slate-600">{p.stock}</td>
                                  <td className="p-4 text-center font-black text-amber-600">{currency}{(p.stock * (p.purchase_price || 0)).toLocaleString()}</td>
                              </tr>
                          ))}
                          {stagnantItems.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-gray-400 font-bold">لا يوجد أصناف راكدة حالياً</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* 5. PURCHASES TAB */}
      {activeTab === 'PURCHASES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-full">
                      <h3 className="font-black text-slate-800 mb-6">ملخص المشتريات</h3>
                      <div className="space-y-6">
                          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                               <p className="text-blue-500 text-xs font-black uppercase mb-1">إجمالي المشتريات (الفترة)</p>
                               <h2 className="text-4xl font-black text-blue-700">{currency}{purchaseData.totalPurchases.toLocaleString()}</h2>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Tab Contents: Reps, Telesales, Financial, Inventory (Simplified) */}
      {activeTab === 'FINANCIAL' && (
          <div className="animate-in fade-in space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><p className="text-gray-400 text-[10px] font-black uppercase mb-1">إجمالي المبيعات</p><h3 className="text-2xl font-black text-slate-800">{currency}{financialData.revenue.toLocaleString()}</h3></div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><p className="text-emerald-500 text-[10px] font-black uppercase mb-1">مجمل الربح</p><h3 className="text-2xl font-black text-emerald-600">{currency}{financialData.grossProfit.toLocaleString()}</h3></div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"><p className="text-rose-500 text-[10px] font-black uppercase mb-1">المصروفات</p><h3 className="text-2xl font-black text-rose-600">-{currency}{financialData.expenses.toLocaleString()}</h3></div>
                  <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 ring-4 ring-slate-100"><p className="text-blue-400 text-[10px] font-black uppercase mb-1">صافي الأرباح</p><h3 className="text-3xl font-black text-white">{currency}{financialData.netProfit.toLocaleString()}</h3></div>
              </div>
          </div>
      )}

      {activeTab === 'INVENTORY' && (
          <div className="animate-in fade-in space-y-6">
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl flex justify-between items-center">
                  <div><p className="text-blue-400 text-xs font-black uppercase mb-1">قيمة الأصول المخزنية الحالية</p><h2 className="text-4xl font-black">{currency}{inventoryData.totalValue.toLocaleString()}</h2></div>
                  <Package className="w-16 h-16 text-white/10" />
              </div>
          </div>
      )}
      
      {activeTab === 'REPRESENTATIVES' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50 border-b font-black text-slate-800">أداء المندوبين</div>
            <table className="w-full text-sm text-right">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black">
                    <tr><th className="p-4">المندوب</th><th className="p-4 text-center">المبيعات</th><th className="p-4 text-center">العمولة</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {repsData.map((r, i) => (
                        <tr key={i}><td className="p-4 font-black">{r.name}</td><td className="p-4 text-center">{currency}{r.sales.toLocaleString()}</td><td className="p-4 text-center">{currency}{r.commission.toLocaleString()}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}

      {activeTab === 'TELESALES' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50 border-b font-black text-slate-800">أداء التيليسيلز</div>
            <table className="w-full text-sm text-right">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black">
                    <tr><th className="p-4">الموظف</th><th className="p-4 text-center">المبيعات</th><th className="p-4 text-center">الفواتير</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {teleData.map((t, i) => (
                        <tr key={i}><td className="p-4 font-black">{t.name}</td><td className="p-4 text-center">{currency}{t.sales.toLocaleString()}</td><td className="p-4 text-center">{t.count}</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
    </div>
  );
}
