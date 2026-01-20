
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  Calendar, DollarSign, TrendingUp, TrendingDown, Users, Package, 
  ArrowUpRight, ArrowDownLeft, Filter, Truck, Search, Briefcase, 
  Phone, ChevronRight, ChevronDown, Table2, BookOpen, Wallet, 
  BarChart3, Activity, UserCheck, ShieldCheck
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
  
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'LEDGER' | 'MONTHLY_SUMMARY' | 'SALES' | 'PURCHASES' | 'INVENTORY' | 'PARTNERS' | 'REPRESENTATIVES' | 'TELESALES'>('FINANCIAL');
  const [selectedMonth, setSelectedMonth] = useState(today.substring(0, 7)); 

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

  // --- 1. Financial Logic ---
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

  // --- 2. Sales Logic ---
  const salesData = useMemo(() => {
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate && i.type === 'SALE';
    });
    const productSales: Record<string, { qty: number, total: number }> = {};
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            if (!productSales[item.product.name]) productSales[item.product.name] = { qty: 0, total: 0 };
            productSales[item.product.name].qty += item.quantity;
            productSales[item.product.name].total += (item.quantity * (item.unit_price || 0));
        });
    });
    const topProducts = Object.entries(productSales).map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total })).sort((a, b) => b.total - a.total).slice(0, 10);
    return { topProducts, count: invoices.length };
  }, [startDate, endDate]);

  // --- 3. Purchases Logic ---
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

  // --- 4. Inventory Logic ---
  const inventoryData = useMemo(() => {
      const products = db.getProductsWithBatches();
      let totalValue = 0;
      const items = products.map(p => {
          const qty = p.batches.reduce((sum, b) => sum + b.quantity, 0);
          const val = qty * (p.purchase_price || 0);
          totalValue += val;
          return { name: p.name, qty, val };
      }).sort((a,b) => b.val - a.val);
      return { items, totalValue };
  }, []);

  // --- 5. Partners & Debt Logic ---
  const partnersData = useMemo(() => {
      const customers = db.getCustomers();
      const suppliers = db.getSuppliers();
      const receivables = customers.reduce((sum, c) => sum + (c.current_balance > 0 ? c.current_balance : 0), 0);
      const payables = suppliers.reduce((sum, s) => sum + Math.abs(s.current_balance), 0);
      const topDebtors = [...customers].sort((a,b) => b.current_balance - a.current_balance).slice(0, 10);
      const topCreditors = [...suppliers].sort((a,b) => b.current_balance - a.current_balance).slice(0, 10);
      return { receivables, payables, topDebtors, topCreditors };
  }, []);

  // --- 6. Representatives Logic ---
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

  // --- 7. Telesales Logic ---
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
         <div className="flex justify-between items-center">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-600" /> تقارير ميزان الذكية
            </h1>
            <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold border border-blue-100">
                مركز البيانات الموحد
            </div>
         </div>

         <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
             <Filter className="w-5 h-5 text-slate-400" />
             <div className="flex items-center gap-3 w-full md:w-auto">
                <input type="date" className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-blue-500 transition-all" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-slate-400 font-bold">إلى</span>
                <input type="date" className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-blue-500 transition-all" value={endDate} onChange={e => setEndDate(e.target.value)} />
             </div>
             <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full md:w-auto">
                 <button onClick={() => handleQuickDate('TODAY')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all whitespace-nowrap">اليوم</button>
                 <button onClick={() => handleQuickDate('MONTH')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all whitespace-nowrap">هذا الشهر</button>
                 <button onClick={() => handleQuickDate('YEAR')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all whitespace-nowrap">السنة</button>
             </div>
         </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {[
              { id: 'FINANCIAL', label: 'المالية (P&L)', icon: DollarSign },
              { id: 'SALES', label: 'المبيعات', icon: TrendingUp },
              { id: 'PURCHASES', label: 'المشتريات', icon: Truck },
              { id: 'INVENTORY', label: 'المخزون', icon: Package },
              { id: 'PARTNERS', label: 'المديونيات', icon: Wallet },
              { id: 'REPRESENTATIVES', label: 'المندوبين', icon: Briefcase },
              { id: 'TELESALES', label: 'التيليسيلز', icon: Phone },
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
                  <tab.icon className="w-4 h-4" />{tab.label}
              </button>
          ))}
      </div>

      {activeTab === 'FINANCIAL' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">إجمالي المبيعات</p>
                      <h3 className="text-2xl font-black text-slate-800">{currency}{financialData.revenue.toLocaleString()}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">مجمل الربح</p>
                      <h3 className="text-2xl font-black text-emerald-600">{currency}{financialData.grossProfit.toLocaleString()}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mb-1">المصروفات</p>
                      <h3 className="text-2xl font-black text-rose-600">-{currency}{financialData.expenses.toLocaleString()}</h3>
                  </div>
                  <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 ring-4 ring-slate-100">
                      <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">صافي الأرباح</p>
                      <h3 className="text-3xl font-black text-white">{currency}{financialData.netProfit.toLocaleString()}</h3>
                  </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
                      <h3 className="font-black text-slate-800 mb-8 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> تحليل الأداء المالي</h3>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[{name: 'المبيعات', value: financialData.revenue}, {name: 'التكلفة', value: financialData.cogs}, {name: 'الربح', value: financialData.netProfit}]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" tick={{fontSize: 12, fontWeight: 'bold', fill: '#64748b'}} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                              <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                                 <Cell fill="#3b82f6" /><Cell fill="#94a3b8" /><Cell fill="#10b981" />
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
                      <h3 className="font-black text-slate-800 mb-8 flex items-center gap-2"><TrendingDown className="w-5 h-5 text-rose-500" /> هيكل المصروفات</h3>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={financialData.expenseChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} dataKey="value" paddingAngle={8} stroke="none">
                                  {financialData.expenseChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'SALES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="font-black text-slate-800 mb-8 flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-blue-500" /> الأصناف الأكثر مبيعاً (بالقيمة)</h3>
                  <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={salesData.topProducts} layout="vertical" margin={{ left: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" tick={{fontSize: 10, fontWeight: 'bold'}} width={150} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{fill: '#f8fafc'}} />
                              <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={25} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'PURCHASES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-gray-400 text-[10px] font-black uppercase mb-1">إجمالي المشتريات</p>
                    <h3 className="text-2xl font-black text-slate-800">{currency}{purchaseData.totalPurchases.toLocaleString()}</h3>
                    <p className="text-xs text-slate-500 mt-1">عدد الفواتير: {purchaseData.pCount}</p>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="font-black text-slate-800 mb-4">كبار الموردين</h3>
                    <div className="space-y-3">
                        {purchaseData.topSuppliers.map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <span className="font-bold text-slate-700">{s.name}</span>
                                <span className="font-black text-blue-600">{currency}{s.value.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
          </div>
      )}

      {activeTab === 'INVENTORY' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl flex justify-between items-center">
                  <div>
                      <p className="text-blue-400 text-xs font-black uppercase mb-1">قيمة الأصول المخزنية الحالية</p>
                      <h2 className="text-4xl font-black">{currency}{inventoryData.totalValue.toLocaleString()}</h2>
                  </div>
                  <Package className="w-16 h-16 text-white/10" />
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black">
                          <tr>
                              <th className="p-4">الصنف</th>
                              <th className="p-4 text-center">الكمية</th>
                              <th className="p-4">إجمالي القيمة التقديرية</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {inventoryData.items.slice(0, 20).map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-4 font-bold text-slate-700">{item.name}</td>
                                  <td className="p-4 text-center font-black text-blue-600">{item.qty}</td>
                                  <td className="p-4 font-mono font-bold">{currency}{item.val.toLocaleString()}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'PARTNERS' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                      <p className="text-emerald-600 text-xs font-black uppercase mb-1">إجمالي المستحقات (عند العملاء)</p>
                      <h3 className="text-3xl font-black text-emerald-700">{currency}{partnersData.receivables.toLocaleString()}</h3>
                  </div>
                  <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                      <p className="text-rose-600 text-xs font-black uppercase mb-1">إجمالي المديونيات (للموردين)</p>
                      <h3 className="text-3xl font-black text-rose-700">{currency}{partnersData.payables.toLocaleString()}</h3>
                  </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-emerald-500" /> أكثر العملاء مديونية</h3>
                      <div className="space-y-3">
                          {partnersData.topDebtors.map((c, i) => (
                              <div key={i} className="flex justify-between items-center p-3 border-b border-slate-50">
                                  <span className="font-bold text-slate-700">{c.name}</span>
                                  <span className="font-black text-rose-600">{currency}{c.current_balance.toLocaleString()}</span>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Truck className="w-5 h-5 text-rose-500" /> كبار الموردين الدائنين</h3>
                      <div className="space-y-3">
                          {partnersData.topCreditors.map((s, i) => (
                              <div key={i} className="flex justify-between items-center p-3 border-b border-slate-50">
                                  <span className="font-bold text-slate-700">{s.name}</span>
                                  <span className="font-black text-emerald-600">{currency}{Math.abs(s.current_balance).toLocaleString()}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'REPRESENTATIVES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 bg-slate-50 border-b font-black text-slate-800">تقرير أداء المندوبين والمحصلين</div>
                  <table className="w-full text-sm text-right">
                      <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black">
                          <tr>
                              <th className="p-4">المندوب</th>
                              <th className="p-4 text-center">عدد الفواتير</th>
                              <th className="p-4 text-center">إجمالي المبيعات</th>
                              <th className="p-4 text-center">العمولة المستحقة</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {repsData.map((r, i) => (
                              <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                  <td className="p-4">
                                      <div className="font-black text-slate-800">{r.name}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">@{r.code}</div>
                                  </td>
                                  <td className="p-4 text-center font-bold text-slate-600">{r.count}</td>
                                  <td className="p-4 text-center font-black text-blue-600">{currency}{r.sales.toLocaleString()}</td>
                                  <td className="p-4 text-center">
                                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black text-xs">
                                          {currency}{r.commission.toLocaleString()}
                                      </span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'TELESALES' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {teleData.map((t, i) => (
                      <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center font-black text-blue-600">{t.name.charAt(0)}</div>
                              <div>
                                  <h4 className="font-black text-slate-800">{t.name}</h4>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">مسئول مبيعات هاتفية</p>
                              </div>
                          </div>
                          <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold text-slate-500"><span>المبيعات:</span><span className="text-slate-900 font-black">{currency}{t.sales.toLocaleString()}</span></div>
                              <div className="flex justify-between text-xs font-bold text-slate-500"><span>الأوردرات:</span><span className="text-slate-900 font-black">{t.count}</span></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'LEDGER' && (
          <div className="animate-in fade-in duration-500 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 bg-slate-800 text-white font-black flex justify-between items-center">
                      <span>دفتر الأستاذ المساعد</span>
                      <ShieldCheck className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="p-20 text-center text-slate-400">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p className="font-bold">يتم توليد قيود اليومية آلياً من حركات البيع والشراء والخزينة.</p>
                      <p className="text-xs mt-2">يرجى مراجعة "كشف حساب العميل" أو "المورد" للحصول على تفاصيل الأرصدة المتغيرة.</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
