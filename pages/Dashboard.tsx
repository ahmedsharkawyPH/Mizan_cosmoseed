
import React, { useMemo } from 'react';
import { db } from '../services/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, Package, AlertTriangle, PlusCircle, FileText, UserPlus, PackagePlus, Coins, Truck, ArrowRight, Building2 } from 'lucide-react';
import { t } from '../utils/t';
import { useNavigate } from 'react-router-dom';

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string; subtext?: string }> = ({ title, value, icon: Icon, color, subtext }) => (
  <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 flex flex-col justify-between hover:shadow-lg transition-shadow duration-300 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-24 h-24 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div className="flex items-start justify-between relative z-10">
        <div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-2 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg shadow-blue-500/20`}>
            <Icon className="w-6 h-6" />
        </div>
    </div>
    {subtext && <p className="text-xs text-slate-400 mt-4 font-medium relative z-10">{subtext}</p>}
  </div>
);

const QuickAction: React.FC<{ label: string; icon: React.ElementType; color: string; onClick: () => void }> = ({ label, icon: Icon, color, onClick }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center justify-center p-5 bg-white border border-slate-100 rounded-2xl shadow-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 gap-3 group h-36 w-full"
  >
    <div className={`p-4 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')} ${color} group-hover:scale-110 group-hover:bg-opacity-20 transition-all duration-300`}>
        <Icon className="w-7 h-7" />
    </div>
    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors text-center">{label}</span>
  </button>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const settings = db.getSettings();
  const currency = settings.currency;
  
  const stats = useMemo(() => {
    const invoices = db.getInvoices();
    const products = db.getProductsWithBatches();
    const customers = db.getCustomers();
    const cash = db.getCashBalance();
    
    // تصحيح منطق حساب المبيعات (خصم المرتجع)
    const totalSales = invoices.reduce((sum, inv) => 
        inv.type === 'SALE' ? sum + inv.net_total : sum - inv.net_total, 0
    );

    const lowStockThreshold = db.getSettings().lowStockThreshold;
    const lowStockCount = products.filter(p => p.batches.reduce((sum, b) => sum + b.quantity, 0) < lowStockThreshold).length;
    
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().split('T')[0];
    }).reverse();
    
    const salesData = last7Days.map(date => {
      const dayInvoices = invoices.filter(i => i.date.startsWith(date));
      const dayNetSales = dayInvoices.reduce((sum, i) => i.type === 'SALE' ? sum + i.net_total : sum - i.net_total, 0);
      return {
        date: new Date(date).toLocaleDateString(undefined, {weekday: 'short'}),
        sales: dayNetSales
      };
    });

    return { totalSales, customerCount: customers.length, lowStockCount, cash, salesData, lowStockThreshold };
  }, []);

  return (
    <div className="space-y-8 pb-10">
      
      {/* 0. Company Identity Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
          
          <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
             {settings.companyLogo ? (
                 <img src={settings.companyLogo} alt="Company Logo" className="w-full h-full object-contain" />
             ) : (
                 <Building2 className="w-10 h-10 text-slate-300" />
             )}
          </div>
          
          <div className="flex-1 text-center md:text-left rtl:md:text-right">
             <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{settings.companyName}</h1>
             <p className="text-slate-500 mt-1">{settings.companyAddress}</p>
             <p className="text-slate-400 text-sm mt-0.5">{settings.companyPhone}</p>
          </div>

          <div className="flex flex-col gap-2 items-end">
             <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-100">
                 {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
             </div>
             <button onClick={() => navigate('/settings')} className="text-xs text-slate-400 hover:text-blue-600 underline">
                 تعديل بيانات الشركة
             </button>
          </div>
      </div>

      {/* 1. Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('dash.total_sales')} value={`${currency}${stats.totalSales.toLocaleString()}`} icon={TrendingUp} color="bg-emerald-500" />
        <StatCard title={t('dash.cash_balance')} value={`${currency}${stats.cash.toLocaleString()}`} icon={Coins} color="bg-blue-600" />
        <StatCard title={t('dash.customers')} value={stats.customerCount.toString()} icon={Users} color="bg-indigo-500" />
        <StatCard title={t('dash.low_stock')} value={stats.lowStockCount.toString()} icon={AlertTriangle} color="bg-amber-500" subtext={`أقل من ${stats.lowStockThreshold} قطعة`} />
      </div>

      {/* 2. Quick Actions Shortcuts */}
      <div>
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                {t('dash.quick_actions')}
            </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            <QuickAction 
                label={t('nav.new_invoice')} 
                icon={PlusCircle} 
                color="text-blue-600" 
                onClick={() => navigate('/invoice/new')} 
            />
            <QuickAction 
                label={t('cust.statement')} 
                icon={FileText} 
                color="text-indigo-600" 
                onClick={() => navigate('/customers')} 
            />
            <QuickAction 
                label={t('stock.new')} 
                icon={PackagePlus} 
                color="text-emerald-600" 
                onClick={() => navigate('/inventory')} 
            />
            <QuickAction 
                label={t('nav.cash')} 
                icon={Coins} 
                color="text-amber-600" 
                onClick={() => navigate('/cash')} 
            />
            <QuickAction 
                label={t('cust.add')} 
                icon={UserPlus} 
                color="text-purple-600" 
                onClick={() => navigate('/customers', { state: { openAdd: true } })} 
            />
             <QuickAction 
                label={t('dash.supplier_stmt')} 
                icon={Truck} 
                color="text-orange-600" 
                onClick={() => navigate('/suppliers')} 
            />
        </div>
      </div>

      {/* 3. Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-card border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">{t('dash.sales_trend')} (صافي المبيعات)</h3>
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl shadow-xl flex flex-col justify-between text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -mr-16 -mt-16"></div>
             
             <div className="relative z-10">
                 <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/10">
                     <FileText className="w-6 h-6 text-blue-300" />
                 </div>
                 <h3 className="text-2xl font-bold mb-3">{t('dash.insights')}</h3>
                 <p className="text-slate-300 mb-8 leading-relaxed text-sm">
                     يساعدك النظام على تتبع الأرباح، النواقص، وأداء المناديب بشكل لحظي لتحسين كفاءة العمل.
                 </p>
             </div>
             
             <button 
                onClick={() => navigate('/reports')} 
                className="relative z-10 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2 group"
             >
                 {t('dash.view_reports')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </button>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
