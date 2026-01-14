
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Users, Package, ArrowUpRight, ArrowDownLeft, Filter, Truck, Search, Briefcase, Phone, ChevronRight, ChevronDown, Table2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Reports() {
  const currency = db.getSettings().currency;
  const location = useLocation();
  
  // Date State
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  
  // Sales Filters State
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  
  // Reps Filters State
  const [selectedRepFilter, setSelectedRepFilter] = useState('');

  const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'MONTHLY_SUMMARY' | 'SALES' | 'PURCHASES' | 'INVENTORY' | 'PARTNERS' | 'REPRESENTATIVES' | 'TELESALES'>('FINANCIAL');

  // Monthly Summary State
  const [selectedMonth, setSelectedMonth] = useState(today.substring(0, 7)); // YYYY-MM

  // Telesales State
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  // Fetch users for Supervisor dropdown
  const [supervisors, setSupervisors] = useState<any[]>([]);

  useEffect(() => {
      const users = authService.getUsers();
      setSupervisors(users);
  }, []);

  // Reset dependent filters when Supervisor changes
  useEffect(() => {
      setSelectedArea('');
      setSelectedCustomer('');
  }, [selectedSupervisor]);

  // Sync Tab with URL
  useEffect(() => {
      if (location.pathname.includes('/reports/sales')) {
          setActiveTab('SALES');
      } else if (location.pathname.includes('/reports/purchases')) {
          setActiveTab('PURCHASES');
      } else if (location.pathname.includes('/reports/representatives')) {
          setActiveTab('REPRESENTATIVES');
      }
  }, [location.pathname]);

  const handleQuickDate = (type: 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR') => {
    const now = new Date();
    let start = '';
    let end = now.toISOString().split('T')[0];

    if (type === 'TODAY') {
        start = end;
    } else if (type === 'MONTH') {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (type === 'LAST_MONTH') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (type === 'YEAR') {
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    }
    setStartDate(start);
    setEndDate(end);
  };

  // --- MONTHLY SUMMARY DATA LOGIC ---
  const monthlySummaryData = useMemo(() => {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1; // 0-indexed
      
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dailyData = [];

      const allInvoices = db.getInvoices();
      const allPurchases = (db as any).purchaseInvoices || [];
      const allTransactions = db.getCashTransactions();

      for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          // 1. Sales (Total Invoice Value)
          const daySales = allInvoices
              .filter(i => i.date.startsWith(dateStr) && i.type === 'SALE')
              .reduce((acc, i) => acc + i.net_total, 0);

          // 2. Purchases (Total Purchase Invoice Value)
          const dayPurchases = allPurchases
              .filter((p: any) => p.date.startsWith(dateStr) && p.type === 'PURCHASE')
              .reduce((acc: number, p: any) => acc + p.total_amount, 0);

          // 3. Expenses (Operating Expenses only - Exclude Supplier Payment)
          // Adjust logic if needed based on "Total Expenses" request
          const dayExpenses = allTransactions
              .filter(t => t.date.startsWith(dateStr) && t.type === 'EXPENSE' && t.category !== 'SUPPLIER_PAYMENT')
              .reduce((acc, t) => acc + t.amount, 0);

          // 4. Cash In (Total Cash Received)
          const dayCashIn = allTransactions
              .filter(t => t.date.startsWith(dateStr) && t.type === 'RECEIPT')
              .reduce((acc, t) => acc + t.amount, 0);

          // 5. Credit (Agel) - Amount sold but not paid yet ON THIS DAY
          // Simplest approximation: Sales - Cash received for sales
          // Since CashIn mixes debt collection and immediate sales, this is tricky.
          // Correct Definition: Sales - (Cash collected for these specific invoices)
          // Simplified Definition for Daily Sheet: Sales - Cash In (If positive). But Cash In includes old debt.
          // Let's use: (Sales - Cash In) might be negative if we collected old debt.
          // To be precise: Sales Credit = Sum of (Invoice Net - Paid Amount) for invoices created TODAY.
          let dayCredit = 0;
          allInvoices.filter(i => i.date.startsWith(dateStr) && i.type === 'SALE').forEach(inv => {
              const paidForThisInvoice = db.getInvoicePaidAmount(inv.id); 
              // Note: getInvoicePaidAmount sums all payments. We only care about payments made ON THE SAME DAY?
              // Usually Agel means "Deferred". If I sell 1000 and take 0 cash, Agel is 1000.
              // If I sell 1000 and take 1000 cash, Agel is 0.
              
              // Let's calculate how much was paid on invoice creation (cash_paid parameter isn't stored directly, but transaction is).
              // We can look for transactions linked to this invoice on this day.
              const initialPayment = allTransactions
                  .filter(t => t.reference_id === inv.id && t.date.startsWith(dateStr) && t.type === 'RECEIPT')
                  .reduce((sum, t) => sum + t.amount, 0);
                  
              dayCredit += (inv.net_total - initialPayment);
          });

          dailyData.push({
              date: dateStr,
              sales: daySales,
              purchases: dayPurchases,
              expenses: dayExpenses,
              cashIn: dayCashIn,
              credit: dayCredit > 0 ? dayCredit : 0 // Ensure non-negative
          });
      }

      // Calculate Totals
      const totals = dailyData.reduce((acc, day) => ({
          sales: acc.sales + day.sales,
          purchases: acc.purchases + day.purchases,
          expenses: acc.expenses + day.expenses,
          cashIn: acc.cashIn + day.cashIn,
          credit: acc.credit + day.credit
      }), { sales: 0, purchases: 0, expenses: 0, cashIn: 0, credit: 0 });

      return { dailyData, totals };
  }, [selectedMonth]);

  // --- DATA AGGREGATION ---
  
  const financialData = useMemo(() => {
    // ... (Existing Logic) ...
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });
    const revenue = invoices.reduce((acc, inv) => acc + inv.net_total, 0);
    let cogs = 0;
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            const cost = item.batch.purchase_price * item.quantity; 
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
    const expenseChartData = Object.keys(expenseBreakdown).map(k => ({ name: t(`cat.${k}`), value: expenseBreakdown[k] }));
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;
    return { revenue, cogs, expenses, grossProfit, netProfit, expenseChartData };
  }, [startDate, endDate]);

  const salesData = useMemo(() => {
    // ... (Existing Logic) ...
    const allCustomers = db.getCustomers();
    const allReps = db.getRepresentatives();
    const validReps = selectedSupervisor ? allReps.filter(r => r.supervisor_id === selectedSupervisor) : allReps;
    const validRepCodes = validReps.map(r => r.code);
    const scopedCustomers = allCustomers.filter(c => c.representative_code && validRepCodes.includes(c.representative_code));
    const availableAreas = Array.from(new Set(scopedCustomers.map(c => c.area).filter(Boolean))).sort();
    const availableCustomers = selectedArea ? scopedCustomers.filter(c => c.area === selectedArea) : scopedCustomers;
    const invoices = db.getInvoices().filter(i => {
        const d = i.date.split('T')[0];
        const dateMatch = d >= startDate && d <= endDate;
        let customerMatch = true;
        let areaMatch = true;
        let supervisorMatch = true;
        const invCustomer = allCustomers.find(c => c.id === i.customer_id);
        if (!invCustomer) return false;
        if (selectedSupervisor) {
             const rep = allReps.find(r => r.code === invCustomer.representative_code);
             if (!rep || rep.supervisor_id !== selectedSupervisor) supervisorMatch = false;
        }
        if (selectedCustomer) customerMatch = i.customer_id === selectedCustomer;
        if (selectedArea) areaMatch = invCustomer.area === selectedArea;
        return dateMatch && customerMatch && areaMatch && supervisorMatch;
    });
    const totalFilteredRevenue = invoices.reduce((sum, inv) => sum + inv.net_total, 0);
    const productSales: Record<string, { qty: number, total: number }> = {};
    invoices.forEach(inv => {
        inv.items.forEach(item => {
             const gross = item.quantity * item.batch.selling_price;
             const net = gross * (1 - (item.discount_percentage || 0) / 100);
            if (!productSales[item.product.name]) productSales[item.product.name] = { qty: 0, total: 0 };
            productSales[item.product.name].qty += item.quantity;
            productSales[item.product.name].total += net;
        });
    });
    const topProducts = Object.entries(productSales).map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total })).sort((a, b) => b.qty - a.qty);
    const dailySales: Record<string, number> = {};
    invoices.forEach(inv => {
        const date = inv.date.split('T')[0];
        dailySales[date] = (dailySales[date] || 0) + inv.net_total;
    });
    const trendData = Object.entries(dailySales).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
    return { topProducts, trendData, count: invoices.length, availableAreas, availableCustomers, totalFilteredRevenue };
  }, [startDate, endDate, selectedCustomer, selectedArea, selectedSupervisor]);

  const purchasesData = useMemo(() => {
    // ... (Existing Logic) ...
    const allPurchases = (db as any).purchaseInvoices || [];
    const purchases = allPurchases.filter((p: any) => {
        const d = p.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });
    const totalPurchases = purchases.filter((p: any) => p.type === 'PURCHASE').reduce((acc: number, p: any) => acc + p.total_amount, 0);
    const totalReturns = purchases.filter((p: any) => p.type === 'RETURN').reduce((acc: number, p: any) => acc + p.total_amount, 0);
    const netPurchases = totalPurchases - totalReturns;
    const supplierPurchases: Record<string, number> = {};
    const suppliers = db.getSuppliers();
    purchases.filter((p:any) => p.type === 'PURCHASE').forEach((p: any) => {
        const sName = suppliers.find(s => s.id === p.supplier_id)?.name || 'Unknown';
        supplierPurchases[sName] = (supplierPurchases[sName] || 0) + p.total_amount;
    });
    const topSuppliers = Object.entries(supplierPurchases).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5);
    return { totalPurchases, totalReturns, netPurchases, topSuppliers, count: purchases.length };
  }, [startDate, endDate]);

  const inventoryData = useMemo(() => {
     // ... (Existing Logic) ...
     const products = db.getProductsWithBatches();
     let totalStockValue = 0;
     let totalStockCost = 0;
     let lowStockCount = 0;
     let expiredCount = 0;
     products.forEach(p => {
         let pQty = 0;
         p.batches.forEach(b => {
             pQty += b.quantity;
             totalStockValue += (b.quantity * b.selling_price);
             totalStockCost += (b.quantity * b.purchase_price);
             if (new Date(b.expiry_date) < new Date()) expiredCount++;
         });
         if (pQty < 10) lowStockCount++;
     });
     return { totalStockValue, totalStockCost, potentialProfit: totalStockValue - totalStockCost, lowStockCount, expiredCount };
  }, []);

  const partnersData = useMemo(() => {
      // ... (Existing Logic) ...
      const customers = db.getCustomers();
      const suppliers = db.getSuppliers();
      const totalReceivables = customers.reduce((acc, c) => acc + (c.current_balance > 0 ? c.current_balance : 0), 0);
      const totalPayables = suppliers.reduce((acc, s) => acc + (s.current_balance > 0 ? s.current_balance : 0), 0);
      const topDebtors = [...customers].sort((a, b) => b.current_balance - a.current_balance).slice(0, 5);
      return { totalReceivables, totalPayables, topDebtors };
  }, []);

  const repsData = useMemo(() => {
      // ... (Existing Logic) ...
      const reps = db.getRepresentatives();
      const customers = db.getCustomers();
      const custToRep: Record<string, string> = {};
      customers.forEach(c => { if(c.representative_code) custToRep[c.id] = c.representative_code; });
      const invoices = db.getInvoices().filter(i => {
          const d = i.date.split('T')[0];
          return d >= startDate && d <= endDate;
      });
      const repStats: Record<string, { sales: number, count: number, customers: Set<string> }> = {};
      const repProducts: Record<string, Record<string, { qty: number, total: number }>> = {};
      invoices.forEach(inv => {
          const repCode = custToRep[inv.customer_id];
          if (repCode) {
              if (!repStats[repCode]) repStats[repCode] = { sales: 0, count: 0, customers: new Set() };
              repStats[repCode].sales += inv.net_total;
              repStats[repCode].count += 1;
              repStats[repCode].customers.add(inv.customer_id);
              if (!repProducts[repCode]) repProducts[repCode] = {};
              inv.items.forEach(item => {
                  if (!repProducts[repCode][item.product.name]) repProducts[repCode][item.product.name] = { qty: 0, total: 0 };
                  const itemNet = (item.quantity * item.batch.selling_price) * (1 - (item.discount_percentage || 0) / 100);
                  repProducts[repCode][item.product.name].qty += item.quantity;
                  repProducts[repCode][item.product.name].total += itemNet;
              });
          }
      });
      const finalData = reps.map(r => ({
          code: r.code,
          name: r.name,
          commission_rate: r.commission_rate || 0,
          commission_target: r.commission_target || 0,
          sales: repStats[r.code]?.sales || 0,
          invoiceCount: repStats[r.code]?.count || 0,
          uniqueCustomers: repStats[r.code]?.customers.size || 0,
          products: repProducts[r.code] ? Object.entries(repProducts[r.code]).map(([pName, stats]) => ({
              name: pName,
              qty: stats.qty,
              total: stats.total
          })).sort((a,b) => b.qty - a.qty) : []
      })).sort((a, b) => b.sales - a.sales);
      return finalData;
  }, [startDate, endDate]);

  const filteredRepsData = useMemo(() => {
      if (!selectedRepFilter) return repsData;
      return repsData.filter(r => r.code === selectedRepFilter);
  }, [repsData, selectedRepFilter]);

  const telesalesData = useMemo(() => {
      // ... (Existing Logic) ...
      const telesalesUsers = authService.getUsers().filter(u => u.role === 'TELESALES' || u.role === 'ADMIN');
      const allCustomers = db.getCustomers();
      const invoices = db.getInvoices().filter(i => {
          const d = i.date.split('T')[0];
          return d >= startDate && d <= endDate;
      });
      const userStats: Record<string, { id: string, name: string, totalSales: number, invoiceCount: number, invoices: any[] }> = {};
      telesalesUsers.forEach(u => { userStats[u.id] = { id: u.id, name: u.name, totalSales: 0, invoiceCount: 0, invoices: [] }; });
      invoices.forEach(inv => {
          if (inv.created_by && userStats[inv.created_by]) {
              userStats[inv.created_by].totalSales += inv.net_total;
              userStats[inv.created_by].invoiceCount += 1;
              const customerName = allCustomers.find(c => c.id === inv.customer_id)?.name || 'Unknown';
              userStats[inv.created_by].invoices.push({
                  id: inv.id, number: inv.invoice_number, date: inv.date, customer: customerName, amount: inv.net_total
              });
          }
      });
      return Object.values(userStats).filter(u => u.totalSales > 0 || u.invoiceCount > 0).sort((a, b) => b.totalSales - a.totalSales);
  }, [startDate, endDate]);

  const allRepresentatives = db.getRepresentatives();
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-6">
         <div className="flex justify-between items-center">
             <div>
                 <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                     <TrendingUp className="w-7 h-7 text-blue-600" />
                     {t('nav.reports')}
                 </h1>
                 <p className="text-sm text-gray-500 mt-1">Strategic insights for management</p>
             </div>
         </div>

         {/* Hide Date Filter for Inventory, Partners & Monthly Summary (it has its own) */}
         {activeTab !== 'INVENTORY' && activeTab !== 'PARTNERS' && activeTab !== 'MONTHLY_SUMMARY' && (
             <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                 <div className="flex items-center gap-2 text-slate-700 font-bold whitespace-nowrap">
                     <Filter className="w-4 h-4" />
                     {t('rep.period')}
                 </div>
                 
                 <div className="flex items-center gap-2 w-full md:w-auto">
                     <div className="flex flex-col w-1/2 md:w-auto">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1">{t('rep.from')}</label>
                        <input type="date" className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                     </div>
                     <div className="pt-4 text-gray-400">-</div>
                     <div className="flex flex-col w-1/2 md:w-auto">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1">{t('rep.to')}</label>
                        <input type="date" className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                     </div>
                 </div>

                 <div className="w-px h-8 bg-gray-300 mx-2 hidden md:block"></div>

                 <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                     <button onClick={() => handleQuickDate('TODAY')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.today')}</button>
                     <button onClick={() => handleQuickDate('MONTH')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.this_month')}</button>
                     <button onClick={() => handleQuickDate('LAST_MONTH')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.last_month')}</button>
                     <button onClick={() => handleQuickDate('YEAR')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.this_year')}</button>
                 </div>
             </div>
         )}
      </div>

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto pb-2">
          {[
              { id: 'FINANCIAL', label: t('rep.tab.financial'), icon: DollarSign },
              { id: 'MONTHLY_SUMMARY', label: t('rep.tab.monthly'), icon: Table2 },
              { id: 'TELESALES', label: t('rep.tab.telesales'), icon: Phone },
              { id: 'SALES', label: t('rep.tab.sales'), icon: TrendingUp },
              { id: 'PURCHASES', label: t('rep.tab.purchases'), icon: Truck },
              { id: 'REPRESENTATIVES', label: t('rep.tab.reps'), icon: Briefcase },
              { id: 'INVENTORY', label: t('rep.tab.inventory'), icon: Package },
              { id: 'PARTNERS', label: t('rep.tab.partners'), icon: Users },
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold transition-all whitespace-nowrap
                ${activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
              >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
              </button>
          ))}
      </div>

      {/* --- CONTENT --- */}

      {/* MONTHLY SUMMARY TAB */}
      {activeTab === 'MONTHLY_SUMMARY' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <span className="font-bold text-gray-700">{t('rep.mon.select')}:</span>
                  <input 
                    type="month" 
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left rtl:text-right">
                          <thead className="bg-slate-800 text-white uppercase text-xs">
                              <tr>
                                  <th className="p-4 w-32 border-r border-slate-700">{t('common.date')}</th>
                                  <th className="p-4 text-center border-r border-slate-700">{t('rep.mon.sales')}</th>
                                  <th className="p-4 text-center border-r border-slate-700">{t('rep.mon.cash')}</th>
                                  <th className="p-4 text-center border-r border-slate-700 text-orange-200">{t('rep.mon.credit')}</th>
                                  <th className="p-4 text-center border-r border-slate-700 text-red-200">{t('rep.mon.expenses')}</th>
                                  <th className="p-4 text-center text-blue-200">{t('rep.mon.purchases')}</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {monthlySummaryData.dailyData.map((day, idx) => (
                                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                      <td className="p-4 font-bold text-gray-600 border-r border-gray-100">
                                          {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'numeric' })}
                                      </td>
                                      <td className="p-4 text-center font-medium border-r border-gray-100">
                                          {day.sales > 0 ? <span className="text-emerald-600 font-bold">{currency}{day.sales.toLocaleString()}</span> : '-'}
                                      </td>
                                      <td className="p-4 text-center font-medium border-r border-gray-100">
                                          {day.cashIn > 0 ? <span className="text-blue-600">{currency}{day.cashIn.toLocaleString()}</span> : '-'}
                                      </td>
                                      <td className="p-4 text-center font-medium border-r border-gray-100">
                                          {day.credit > 0 ? <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded">{currency}{day.credit.toLocaleString()}</span> : '-'}
                                      </td>
                                      <td className="p-4 text-center font-medium border-r border-gray-100">
                                          {day.expenses > 0 ? <span className="text-red-600">{currency}{day.expenses.toLocaleString()}</span> : '-'}
                                      </td>
                                      <td className="p-4 text-center font-medium">
                                          {day.purchases > 0 ? <span className="text-slate-800">{currency}{day.purchases.toLocaleString()}</span> : '-'}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                              <tr>
                                  <td className="p-4 border-r border-slate-300 text-lg">TOTAL</td>
                                  <td className="p-4 text-center text-emerald-700 border-r border-slate-300 text-lg">{currency}{monthlySummaryData.totals.sales.toLocaleString()}</td>
                                  <td className="p-4 text-center text-blue-700 border-r border-slate-300 text-lg">{currency}{monthlySummaryData.totals.cashIn.toLocaleString()}</td>
                                  <td className="p-4 text-center text-orange-700 border-r border-slate-300 text-lg">{currency}{monthlySummaryData.totals.credit.toLocaleString()}</td>
                                  <td className="p-4 text-center text-red-700 border-r border-slate-300 text-lg">{currency}{monthlySummaryData.totals.expenses.toLocaleString()}</td>
                                  <td className="p-4 text-center text-slate-800 text-lg">{currency}{monthlySummaryData.totals.purchases.toLocaleString()}</td>
                              </tr>
                          </tfoot>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* TELESALES VIEW */}
      {activeTab === 'TELESALES' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left rtl:text-right">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                          <tr>
                              <th className="p-4 w-10"></th>
                              <th className="p-4">{t('rep.agent')}</th>
                              <th className="p-4 text-center">{t('rep.orders_count')}</th>
                              <th className="p-4 text-right rtl:text-left">{t('rep.total_value')}</th>
                              <th className="p-4 text-center">{t('rep.details')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {telesalesData.map(agent => (
                              <React.Fragment key={agent.id}>
                                  <tr className={`hover:bg-gray-50 transition-colors ${expandedAgentId === agent.id ? 'bg-blue-50/50' : ''}`}>
                                      <td className="p-4 text-center">
                                          <button 
                                            onClick={() => setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id)}
                                            className="text-gray-400 hover:text-blue-600"
                                          >
                                              {expandedAgentId === agent.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                          </button>
                                      </td>
                                      <td className="p-4 font-bold text-gray-800 flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                              {agent.name.charAt(0)}
                                          </div>
                                          {agent.name}
                                      </td>
                                      <td className="p-4 text-center font-bold text-slate-600">{agent.invoiceCount}</td>
                                      <td className="p-4 text-right rtl:text-left font-mono font-bold text-emerald-600">
                                          {currency}{agent.totalSales.toLocaleString()}
                                      </td>
                                      <td className="p-4 text-center">
                                          <button 
                                            onClick={() => setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id)}
                                            className="text-xs text-blue-600 hover:underline"
                                          >
                                              {expandedAgentId === agent.id ? 'Hide' : 'View Orders'}
                                          </button>
                                      </td>
                                  </tr>
                                  
                                  {/* Detailed Rows */}
                                  {expandedAgentId === agent.id && (
                                      <tr>
                                          <td colSpan={5} className="bg-slate-50 p-4 border-b border-gray-200 shadow-inner">
                                              <div className="bg-white border rounded-lg overflow-hidden">
                                                  <table className="w-full text-xs">
                                                      <thead className="bg-gray-100 text-gray-500 uppercase">
                                                          <tr>
                                                              <th className="p-3 text-left rtl:text-right">{t('common.date')}</th>
                                                              <th className="p-3 text-left rtl:text-right">Invoice #</th>
                                                              <th className="p-3 text-left rtl:text-right">{t('inv.customer')}</th>
                                                              <th className="p-3 text-right rtl:text-left">{t('inv.total')}</th>
                                                          </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-gray-100">
                                                          {agent.invoices.map((inv: any) => (
                                                              <tr key={inv.id} className="hover:bg-gray-50">
                                                                  <td className="p-3 text-gray-600">
                                                                      {new Date(inv.date).toLocaleDateString()} 
                                                                      <span className="text-gray-400 ml-1 text-[10px]">{new Date(inv.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                  </td>
                                                                  <td className="p-3 font-mono text-gray-500">{inv.number}</td>
                                                                  <td className="p-3 font-medium text-gray-800">{inv.customer}</td>
                                                                  <td className="p-3 text-right rtl:text-left font-bold text-slate-700">{currency}{inv.amount.toLocaleString()}</td>
                                                              </tr>
                                                          ))}
                                                      </tbody>
                                                  </table>
                                              </div>
                                          </td>
                                      </tr>
                                  )}
                              </React.Fragment>
                          ))}
                          {telesalesData.length === 0 && (
                              <tr>
                                  <td colSpan={5} className="p-8 text-center text-gray-400">No telesales activity found in this period.</td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* 1. FINANCIAL VIEW */}
      {activeTab === 'FINANCIAL' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
              
              {/* KPIS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                      <p className="text-gray-500 text-sm font-medium relative">{t('rep.total_revenue')}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-2 relative">{currency}{financialData.revenue.toLocaleString()}</h3>
                      <ArrowUpRight className="text-green-500 w-5 h-5 absolute bottom-6 right-6" />
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                      <p className="text-gray-500 text-sm font-medium relative">{t('rep.cogs')}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-2 relative">{currency}{financialData.cogs.toLocaleString()}</h3>
                      <p className="text-xs text-red-400 mt-1 relative">Direct Costs</p>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                      <p className="text-gray-500 text-sm font-medium relative">{t('rep.gross_profit')}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-2 relative">{currency}{financialData.grossProfit.toLocaleString()}</h3>
                      <p className="text-xs text-orange-400 mt-1 relative">Margin: {financialData.revenue > 0 ? ((financialData.grossProfit/financialData.revenue)*100).toFixed(1) : 0}%</p>
                  </div>

                   <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                      <p className="text-slate-300 text-sm font-medium relative">{t('rep.net_profit')}</p>
                      <h3 className="text-3xl font-bold mt-2 relative">{currency}{financialData.netProfit.toLocaleString()}</h3>
                      <div className="mt-4 text-xs text-slate-400 bg-white/10 px-2 py-1 rounded w-fit relative">
                          After Expenses: {currency}{financialData.expenses.toLocaleString()}
                      </div>
                  </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6">Financial Overview</h3>
                      <div className="h-72 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: 'Revenue', value: financialData.revenue, fill: '#10b981' },
                                    { name: 'COGS', value: financialData.cogs, fill: '#f43f5e' },
                                    { name: 'Expenses', value: financialData.expenses, fill: '#f97316' },
                                    { name: 'Net Profit', value: financialData.netProfit, fill: '#3b82f6' }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${currency}${val}`} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50} />
                                </BarChart>
                           </ResponsiveContainer>
                      </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6">Expense Breakdown</h3>
                      <div className="h-72 w-full">
                           {financialData.expenseChartData.length > 0 ? (
                               <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={financialData.expenseChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {financialData.expenseChartData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                               </ResponsiveContainer>
                           ) : (
                               <div className="h-full flex items-center justify-center text-gray-400 text-sm">No expense data</div>
                           )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 2. SALES VIEW */}
      {activeTab === 'SALES' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                    {/* Filters... (Same as before) */}
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Supervisor</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedSupervisor}
                            onChange={(e) => setSelectedSupervisor(e.target.value)}
                        >
                            <option value="">All Supervisors</option>
                            {supervisors.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    {/* ... other filters ... */}
                     <button 
                        onClick={() => { setSelectedCustomer(''); setSelectedArea(''); setSelectedSupervisor(''); }}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                     >
                        Reset
                     </button>
               </div>
               
               {/* Sales Charts & Tables (Same as before) */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-6 flex justify-between items-center">
                            <span>{t('dash.sales_trend')}</span>
                            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                {currency}{salesData.totalFilteredRevenue.toLocaleString()}
                            </span>
                        </h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={salesData.trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}`} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                         <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                             <Package className="w-5 h-5 text-blue-500" />
                             {t('rep.product_breakdown')}
                         </h3>
                         <div className="flex-1 overflow-y-auto pr-2">
                             <table className="w-full text-sm text-left rtl:text-right">
                                 <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                     <tr>
                                         <th className="px-3 py-2">Product</th>
                                         <th className="px-3 py-2 text-center">{t('rep.units')}</th>
                                         <th className="px-3 py-2 text-right rtl:text-left">Total</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                    {salesData.topProducts.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-3 py-2 font-medium text-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {idx + 1}
                                                    </span>
                                                    {p.name}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{p.qty}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right rtl:text-left font-bold text-gray-800">{currency}{p.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                 </tbody>
                             </table>
                         </div>
                    </div>
               </div>
          </div>
      )}

      {/* 3. PURCHASES VIEW (Existing) */}
      {activeTab === 'PURCHASES' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               {/* ... (Existing Content) ... */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                         <p className="text-gray-500 font-medium">Total Purchased</p>
                         <h3 className="text-2xl font-bold text-gray-800 mt-1">{currency}{purchasesData.totalPurchases.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm">
                         <p className="text-gray-500 font-medium">Returns</p>
                         <h3 className="text-2xl font-bold text-red-600 mt-1">-{currency}{purchasesData.totalReturns.toLocaleString()}</h3>
                    </div>
                    <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
                         <p className="text-slate-400 font-medium">Net Purchases</p>
                         <h3 className="text-3xl font-bold mt-1">{currency}{purchasesData.netPurchases.toLocaleString()}</h3>
                    </div>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-6">Top Suppliers (Volume)</h3>
                        {purchasesData.topSuppliers.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart layout="vertical" data={purchasesData.topSuppliers}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Bar dataKey="amount" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="h-40 flex items-center justify-center text-gray-400">No purchase data</div>
                        )}
                   </div>
               </div>
          </div>
      )}

      {/* 4. INVENTORY VIEW (Existing) */}
      {activeTab === 'INVENTORY' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               {/* ... (Existing Content) ... */}
               <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3">
                   <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                       <Package className="w-5 h-5" />
                   </div>
                   <p className="text-sm text-blue-800">Note: Inventory reports show current snapshot state.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg">
                        <p className="text-indigo-200 text-sm font-medium">{t('rep.stock_value')} (Selling Price)</p>
                        <h3 className="text-3xl font-bold mt-2">{currency}{inventoryData.totalStockValue.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-gray-500 text-sm font-medium">Potential Profit (Value - Cost)</p>
                        <h3 className="text-3xl font-bold text-emerald-600 mt-2">{currency}{inventoryData.potentialProfit.toLocaleString()}</h3>
                    </div>
                     <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">{t('dash.low_stock')}</p>
                                <h3 className="text-3xl font-bold text-orange-500 mt-2">{inventoryData.lowStockCount}</h3>
                            </div>
                             <div>
                                <p className="text-gray-500 text-sm font-medium">{t('stock.expired')}</p>
                                <h3 className="text-3xl font-bold text-red-500 mt-2">{inventoryData.expiredCount}</h3>
                            </div>
                        </div>
                    </div>
               </div>
           </div>
      )}

      {/* 5. PARTNERS VIEW (Existing) */}
      {activeTab === 'PARTNERS' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                {/* ... (Existing Content) ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-gray-500 font-medium">{t('rep.receivables')}</p>
                                 <h3 className="text-3xl font-bold text-gray-800 mt-1">{currency}{partnersData.totalReceivables.toLocaleString()}</h3>
                             </div>
                             <div className="bg-blue-50 p-2 rounded text-blue-600">
                                 <ArrowDownLeft className="w-6 h-6" />
                             </div>
                         </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-gray-500 font-medium">{t('rep.payables')}</p>
                                 <h3 className="text-3xl font-bold text-gray-800 mt-1">{currency}{partnersData.totalPayables.toLocaleString()}</h3>
                             </div>
                             <div className="bg-red-50 p-2 rounded text-red-600">
                                 <ArrowUpRight className="w-6 h-6" />
                             </div>
                         </div>
                    </div>
                </div>
           </div>
      )}

      {/* 6. REPRESENTATIVES VIEW (Existing) */}
      {activeTab === 'REPRESENTATIVES' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100">
                   <div className="flex items-center gap-3">
                       <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                           <Briefcase className="w-5 h-5" />
                       </div>
                       <p className="text-sm text-gray-600 hidden md:block">Performance based on assigned customers.</p>
                   </div>
                   
                   <div className="w-full md:w-auto">
                        <select 
                            className="w-full md:w-64 border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedRepFilter}
                            onChange={(e) => setSelectedRepFilter(e.target.value)}
                        >
                            <option value="">{t('rep.all_reps')}</option>
                            {allRepresentatives.map(r => (
                                <option key={r.id} value={r.code}>{r.name}</option>
                            ))}
                        </select>
                   </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-6">Top Performers (Sales Volume)</h3>
                        {filteredRepsData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart layout="vertical" data={filteredRepsData.slice(0, 5)}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <Tooltip cursor={{fill: 'transparent'}} formatter={(value) => `${currency}${value.toLocaleString()}`} />
                                    <Bar dataKey="sales" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={30}>
                                        {filteredRepsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="h-40 flex items-center justify-center text-gray-400">No sales data</div>
                        )}
                   </div>

                   <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-6">Performance Details</h3>
                        <div className="flex-1 overflow-y-auto max-h-[300px]">
                            <table className="w-full text-sm text-left rtl:text-right">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2">{t('rep.name')}</th>
                                        <th className="px-3 py-2 text-center">{t('rep.target')}</th>
                                        <th className="px-3 py-2 text-right rtl:text-left">{t('rep.sales_volume')}</th>
                                        <th className="px-3 py-2 text-right rtl:text-left">{t('rep.commission_amount')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRepsData.map((rep, idx) => {
                                        const isTargetMet = rep.sales >= rep.commission_target;
                                        const commissionAmount = isTargetMet ? (rep.sales * rep.commission_rate) / 100 : 0;
                                        
                                        return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 font-medium">
                                                <div>{rep.name}</div>
                                                <div className="text-[10px] text-gray-400">{rep.code} ({rep.commission_rate}%)</div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="font-bold text-gray-700">{rep.commission_target > 0 ? `${currency}${rep.commission_target.toLocaleString()}` : '-'}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right rtl:text-left font-bold text-slate-800">{currency}{rep.sales.toLocaleString()}</td>
                                            <td className={`px-3 py-2 text-right rtl:text-left font-bold ${isTargetMet ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                {currency}{commissionAmount.toLocaleString()}
                                                {!isTargetMet && rep.commission_target > 0 && <span className="text-[9px] text-red-400 block font-normal">(Below Target)</span>}
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                   </div>
               </div>
          </div>
      )}

    </div>
  );
}
