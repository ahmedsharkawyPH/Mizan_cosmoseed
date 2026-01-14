
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Users, Package, ArrowUpRight, ArrowDownLeft, Filter, Truck, Search, Briefcase, Phone, ChevronRight, ChevronDown, Table2, BookOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';

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
  const [selectedRepFilter, setSelectedRepFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'LEDGER' | 'MONTHLY_SUMMARY' | 'SALES' | 'PURCHASES' | 'INVENTORY' | 'PARTNERS' | 'REPRESENTATIVES' | 'TELESALES'>('FINANCIAL');
  const [selectedMonth, setSelectedMonth] = useState(today.substring(0, 7)); 
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);

  useEffect(() => {
      setSupervisors(authService.getUsers());
  }, []);

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

  const ledgerData = useMemo(() => db.getGeneralLedger(), []);

  const financialData = useMemo(() => {
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });
    const revenue = invoices.reduce((acc, inv) => acc + inv.net_total, 0);
    let cogs = 0;
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            const cost = (item.batch?.purchase_price || 0) * item.quantity; 
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

  const monthlySummaryData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyData = [];
    const allInvoices = db.getInvoices();
    const allPurchases = db.getPurchaseInvoices();
    const allTransactions = db.getCashTransactions();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const daySales = allInvoices.filter(i => i.date.startsWith(dateStr) && i.type === 'SALE').reduce((acc, i) => acc + i.net_total, 0);
        const dayPurchases = allPurchases.filter(p => p.date.startsWith(dateStr) && p.type === 'PURCHASE').reduce((acc, p) => acc + p.total_amount, 0);
        const dayExpenses = allTransactions.filter(t => t.date.startsWith(dateStr) && t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT').reduce((acc, t) => acc + t.amount, 0);
        const dayCashIn = allTransactions.filter(t => t.date.startsWith(dateStr) && t.type === 'RECEIPT').reduce((acc, t) => acc + t.amount, 0);
        let dayCredit = 0;
        allInvoices.filter(i => i.date.startsWith(dateStr) && i.type === 'SALE').forEach(inv => {
            const initialPayment = allTransactions.filter(t => t.reference_id === inv.id && t.date.startsWith(dateStr) && t.type === 'RECEIPT').reduce((sum, t) => sum + t.amount, 0);
            dayCredit += (inv.net_total - initialPayment);
        });
        dailyData.push({ date: dateStr, sales: daySales, purchases: dayPurchases, expenses: dayExpenses, cashIn: dayCashIn, credit: dayCredit > 0 ? dayCredit : 0 });
    }
    const totals = dailyData.reduce((acc, day) => ({
        sales: acc.sales + day.sales, purchases: acc.purchases + day.purchases, expenses: acc.expenses + day.expenses, cashIn: acc.cashIn + day.cashIn, credit: acc.credit + day.credit
    }), { sales: 0, purchases: 0, expenses: 0, cashIn: 0, credit: 0 });
    return { dailyData, totals };
  }, [selectedMonth]);

  const salesData = useMemo(() => {
    const allCustomers = db.getCustomers();
    const allReps = db.getRepresentatives();
    const validReps = selectedSupervisor ? allReps.filter(r => r.supervisor_id === selectedSupervisor) : allReps;
    const validRepCodes = validReps.map(r => r.code);
    const scopedCustomers = allCustomers.filter(c => c.representative_code && validRepCodes.includes(c.representative_code));
    const availableAreas = Array.from(new Set(scopedCustomers.map(c => c.area).filter(Boolean))).sort();
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        const dateMatch = d >= startDate && d <= endDate;
        const invCustomer = allCustomers.find(c => c.id === i.customer_id);
        if (!invCustomer) return false;
        let customerMatch = !selectedCustomer || i.customer_id === selectedCustomer;
        let areaMatch = !selectedArea || invCustomer.area === selectedArea;
        return dateMatch && customerMatch && areaMatch;
    });
    const totalFilteredRevenue = invoices.reduce((sum, inv) => sum + inv.net_total, 0);
    const productSales: Record<string, { qty: number, total: number }> = {};
    invoices.forEach(inv => {
        inv.items.forEach(item => {
             const net = (item.quantity * (item.unit_price || item.batch.selling_price)) * (1 - (item.discount_percentage || 0) / 100);
            if (!productSales[item.product.name]) productSales[item.product.name] = { qty: 0, total: 0 };
            productSales[item.product.name].qty += item.quantity;
            productSales[item.product.name].total += net;
        });
    });
    const topProducts = Object.entries(productSales).map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total })).sort((a, b) => b.qty - a.qty);
    const trendData = Object.entries(invoices.reduce((acc: any, inv) => {
        const d = inv.date.split('T')[0]; acc[d] = (acc[d] || 0) + inv.net_total; return acc;
    }, {})).map(([date, amount]) => ({ date, amount })).sort((a:any, b:any) => a.date.localeCompare(b.date));
    return { topProducts, trendData, count: invoices.length, availableAreas, totalFilteredRevenue };
  }, [startDate, endDate, selectedCustomer, selectedArea, selectedSupervisor]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-6">
         <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <TrendingUp className="w-7 h-7 text-blue-600" />{t('nav.reports')}
         </h1>
         {activeTab !== 'INVENTORY' && activeTab !== 'MONTHLY_SUMMARY' && (
             <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                 <Filter className="w-4 h-4 text-slate-700" />
                 <div className="flex items-center gap-2 w-full md:w-auto">
                    <input type="date" className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <span className="text-gray-400">-</span>
                    <input type="date" className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                 </div>
                 <div className="flex gap-2 overflow-x-auto">
                     <button onClick={() => handleQuickDate('TODAY')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium whitespace-nowrap">Today</button>
                     <button onClick={() => handleQuickDate('MONTH')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium whitespace-nowrap">This Month</button>
                     <button onClick={() => handleQuickDate('YEAR')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium whitespace-nowrap">This Year</button>
                 </div>
             </div>
         )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
              { id: 'FINANCIAL', label: 'Financials', icon: DollarSign },
              { id: 'LEDGER', label: 'General Ledger', icon: BookOpen },
              { id: 'MONTHLY_SUMMARY', label: 'Monthly Summary', icon: Table2 },
              { id: 'SALES', label: 'Sales', icon: TrendingUp },
              { id: 'PURCHASES', label: 'Purchases', icon: Truck },
              { id: 'TELESALES', label: 'Telesales', icon: Phone },
              { id: 'REPRESENTATIVES', label: 'Reps', icon: Briefcase },
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}>
                  <tab.icon className="w-4 h-4" />{tab.label}
              </button>
          ))}
      </div>

      {activeTab === 'FINANCIAL' && (
          <div className="animate-in fade-in duration-300 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <p className="text-gray-500 text-sm font-medium">Revenue</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-2">{currency}{financialData.revenue.toLocaleString()}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <p className="text-gray-500 text-sm font-medium">Gross Profit</p>
                      <h3 className="text-2xl font-bold text-emerald-600 mt-2">{currency}{financialData.grossProfit.toLocaleString()}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <p className="text-gray-500 text-sm font-medium">Expenses</p>
                      <h3 className="text-2xl font-bold text-red-600 mt-2">-{currency}{financialData.expenses.toLocaleString()}</h3>
                  </div>
                  <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg">
                      <p className="text-slate-400 text-sm font-medium">Net Profit</p>
                      <h3 className="text-3xl font-bold mt-2">{currency}{financialData.netProfit.toLocaleString()}</h3>
                  </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-[400px]">
                      <h3 className="font-bold text-gray-800 mb-6">Financial Comparison</h3>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[{name: 'Revenue', value: financialData.revenue}, {name: 'COGS', value: financialData.cogs}, {name: 'Net Profit', value: financialData.netProfit}]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-[400px]">
                      <h3 className="font-bold text-gray-800 mb-6">Expense Distribution</h3>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={financialData.expenseChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>
                                  {financialData.expenseChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'LEDGER' && (
          <div className="animate-in fade-in duration-300 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Double-Entry Journal</h3>
                      <div className="text-xs text-slate-500 font-mono">System Integrity Verified</div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left rtl:text-right">
                          <thead className="bg-slate-800 text-white uppercase text-xs">
                              <tr>
                                  <th className="p-4">Date</th>
                                  <th className="p-4">Account</th>
                                  <th className="p-4">Description</th>
                                  <th className="p-4 text-right">Debit</th>
                                  <th className="p-4 text-right">Credit</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {ledgerData.map((entry, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="p-4 text-gray-500 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                                      <td className="p-4 font-bold text-blue-600">{entry.account}</td>
                                      <td className="p-4 text-gray-600">{entry.description}</td>
                                      <td className="p-4 text-right font-mono">{entry.debit > 0 ? `${currency}${entry.debit.toLocaleString()}` : '-'}</td>
                                      <td className="p-4 text-right font-mono">{entry.credit > 0 ? `${currency}${entry.credit.toLocaleString()}` : '-'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'MONTHLY_SUMMARY' && (
          <div className="animate-in fade-in duration-300 space-y-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                  <span className="font-bold">Select Month:</span>
                  <input type="month" className="border rounded-lg px-3 py-2 font-bold" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm text-center">
                      <thead className="bg-slate-800 text-white uppercase text-xs">
                          <tr>
                              <th className="p-4 text-left">Date</th>
                              <th className="p-4">Sales</th>
                              <th className="p-4">Cash In</th>
                              <th className="p-4">Credit</th>
                              <th className="p-4">Expenses</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {monthlySummaryData.dailyData.map((day, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-4 text-left font-bold text-gray-600">{new Date(day.date).toLocaleDateString(undefined, {day:'numeric', month:'short'})}</td>
                                  <td className="p-4 text-emerald-600 font-bold">{day.sales > 0 ? `${currency}${day.sales.toLocaleString()}` : '-'}</td>
                                  <td className="p-4 text-blue-600">{day.cashIn > 0 ? `${currency}${day.cashIn.toLocaleString()}` : '-'}</td>
                                  <td className="p-4 text-orange-600">{day.credit > 0 ? `${currency}${day.credit.toLocaleString()}` : '-'}</td>
                                  <td className="p-4 text-red-600">{day.expenses > 0 ? `${currency}${day.expenses.toLocaleString()}` : '-'}</td>
                              </tr>
                          ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-black">
                          <tr>
                              <td className="p-4 text-left">TOTAL</td>
                              <td className="p-4">{currency}{monthlySummaryData.totals.sales.toLocaleString()}</td>
                              <td className="p-4">{currency}{monthlySummaryData.totals.cashIn.toLocaleString()}</td>
                              <td className="p-4">{currency}{monthlySummaryData.totals.credit.toLocaleString()}</td>
                              <td className="p-4 text-red-600">{currency}{monthlySummaryData.totals.expenses.toLocaleString()}</td>
                          </tr>
                      </tfoot>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
}
