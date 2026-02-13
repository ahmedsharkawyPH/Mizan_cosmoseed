
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS, APP_NAME } from '../constants';
import { authService } from '../services/auth';
import { 
  LogOut, User, Menu, X, ShoppingCart, FileText, Package, Activity, 
  Truck, Users, AlertTriangle, TrendingUp, ChevronDown, ChevronRight, 
  Phone, Search, Command, ShoppingBag, PlusCircle, Warehouse as WarehouseIcon, 
  LayoutGrid, ClipboardCheck, ShieldCheck, ClipboardList, RefreshCw, CheckCircle2,
  AlertCircle, ListChecks, RotateCcw, Coins, Boxes, Wallet, Save
} from 'lucide-react';
import { db } from '../services/db';
import { t, isRTL } from '../utils/t';
import { ExitApp } from './ExitApp';
// @ts-ignore
import toast from 'react-hot-toast';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [dbFullLoaded, setDbFullLoaded] = useState(db.isFullyLoaded);
  const [isSaving, setIsSaving] = useState(db.activeOperations > 0);
  const [closingsVersion, setClosingsVersion] = useState(0); 
  
  const user = authService.getCurrentUser();
  const settings = db.getSettings();

  // تتبع حالة المزامنة اللحظية
  useEffect(() => {
    const unsub = db.onSyncStateChange((isBusy) => {
        setIsSaving(isBusy);
    });
    return unsub;
  }, []);

  const getLocalDate = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const missingClosings = useMemo(() => {
    const closings = db.getDailyClosings();
    const today = new Date();
    const missingDays: string[] = [];
    
    for (let i = 1; i <= 7; i++) {
        const checkDate = new Date();
        checkDate.setDate(today.getDate() - i);
        const dateStr = getLocalDate(checkDate);
        
        const isClosed = closings.some(c => c.date === dateStr);
        if (!isClosed) {
            missingDays.push(dateStr);
        }
    }
    return missingDays;
  }, [location.pathname, closingsVersion, db.isFullyLoaded]);

  const isPreviousDayUnclosed = missingClosings.length > 0;

  const sidebarItems = [
    { label: t('nav.dashboard'), path: '/', icon: LayoutGrid, perm: 'VIEW_DASHBOARD', roles: ['ADMIN', 'TELESALES'] },
    { label: 'لوحة المدير', path: '/settings', icon: ShieldCheck, perm: 'MANAGE_SETTINGS', roles: ['ADMIN'] },
    {
        key: 'sales_mgmt',
        label: t('nav.sales'),
        icon: ShoppingCart,
        perm: 'MANAGE_SALES',
        roles: ['ADMIN', 'REP', 'TELESALES'],
        children: [
            { label: t('nav.new_invoice'), path: '/invoice/new', icon: PlusCircle },
            { label: t('nav.invoices'), path: '/invoices', icon: FileText },
            { label: 'مرتجع مبيعات', path: '/invoice/return', icon: RotateCcw },
            { label: 'أصناف اليوم', path: '/today-items', icon: ListChecks }
        ]
    },
    {
        key: 'product_mgmt',
        label: "المخازن والأصناف",
        icon: Boxes,
        perm: 'MANAGE_INVENTORY',
        roles: ['ADMIN', 'TELESALES', 'REP'],
        children: [
            { label: "كافة الأصناف", path: '/inventory', icon: Package },
            { label: "تعريف المخازن", path: '/warehouses', icon: WarehouseIcon },
            { label: "الجرد الفعلي", path: '/stock-take', icon: ClipboardCheck },
            { label: "تحليل المخزون", path: '/inventory/analysis', icon: Activity },
            { label: "النواقص والتقارير", path: '/shortages', icon: AlertTriangle }
        ]
    },
    {
        key: 'purchase_mgmt',
        label: t('nav.purchases'),
        icon: ShoppingBag,
        perm: 'MANAGE_INVENTORY',
        roles: ['ADMIN', 'TELESALES'],
        children: [
            { label: t('stock.purchase'), path: '/purchases/new', icon: PlusCircle },
            { label: t('pur.list_title'), path: '/purchases/list', icon: FileText },
            { label: 'مرتجع مشتريات', path: '/purchases/return-from-invoice', icon: RotateCcw },
            { label: t('stock.order'), path: '/purchase-orders', icon: Truck }
        ]
    },
    { label: t('cust.title'), path: '/customers', icon: Users, perm: 'MANAGE_CUSTOMERS', roles: ['ADMIN', 'REP', 'TELESALES'] },
    { label: t('supp.title'), path: '/suppliers', icon: Truck, perm: 'MANAGE_SUPPLIERS', roles: ['ADMIN'] },
    {
        key: 'cash_mgmt',
        label: t('nav.cash'),
        icon: Coins,
        perm: 'MANAGE_CASH',
        roles: ['ADMIN', 'REP', 'TELESALES'],
        children: [
            { label: 'الخزينة (حركات)', path: '/cash', icon: Wallet },
            { label: 'تقفيل اليومية', path: '/daily-closing', icon: ClipboardList },
            { label: 'نظام العمولات', path: '/commissions', icon: Coins }
        ]
    },
    { label: t('nav.reports'), path: '/reports', icon: TrendingUp, perm: 'VIEW_REPORTS', roles: ['ADMIN'] },
  ];

  return (
    <div className={`flex h-screen bg-slate-50 ${isRTL() ? 'rtl' : 'ltr'}`} dir={isRTL() ? 'rtl' : 'ltr'}>
      {isSidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden glass-modal" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col ${isRTL() ? 'right-0' : 'left-0'} ${isRTL() ? (isSidebarOpen ? 'translate-x-0' : 'translate-x-full') : (isSidebarOpen ? 'translate-x-0' : '-translate-x-full')}`}>
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 shrink-0">
          <span className="text-xl font-bold tracking-tight text-white">{settings.companyName || APP_NAME}</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {sidebarItems.map((item: any) => {
            if (!authService.hasPermission(item.perm)) return null;
            if (item.children) {
                const isOpen = openMenu === item.key;
                return (
                    <div key={item.key} className={`space-y-1 rounded-xl transition-all duration-300 ${isOpen ? 'bg-white/5 pb-2' : ''}`}>
                        <button onClick={() => setOpenMenu(prev => prev === item.key ? null : item.key)} className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 group font-bold ${isOpen ? 'text-white bg-blue-600' : 'text-white hover:bg-slate-800'}`}>
                          <div className="flex items-center">
                            <item.icon className={`w-5 h-5 ltr:mr-3 rtl:ml-3 shrink-0 ${isOpen ? 'text-white' : 'text-blue-400'}`} />
                            {item.label}
                          </div>
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : isRTL() ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {isOpen && (
                          <div className={`space-y-1 ${isRTL() ? 'pr-4 border-r border-white/10' : 'pl-4 border-l border-white/10'} ml-3 mr-3 mt-1 animate-in slide-in-from-top-2 duration-200`}>
                            {item.children.map((child: any) => (
                              <NavLink 
                                key={child.path} 
                                to={child.path} 
                                onClick={() => setIsSidebarOpen(false)} 
                                className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${isActive ? 'bg-orange-600 text-white' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
                              >
                                <child.icon className="w-4 h-4 ltr:mr-3 rtl:ml-3 shrink-0 opacity-70" />
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                    </div>
                );
            }
            return (
              <NavLink 
                key={item.path} 
                to={item.path} 
                onClick={() => { setIsSidebarOpen(false); setOpenMenu(null); }} 
                className={({ isActive }) => `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group font-bold ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-white hover:bg-slate-800'}`}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 ltr:mr-3 rtl:ml-3 shrink-0 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white shadow-inner">{user?.name?.charAt(0) || 'U'}</div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate text-white">{user?.name}</p>
              <p className="text-xs text-white/50 truncate uppercase tracking-tighter">{user?.role}</p>
            </div>
          </div>
          <ExitApp />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* شريط حالة الحفظ السحابي (التحذير) */}
        {isSaving && (
          <div className="bg-orange-600 text-white py-2 px-6 flex items-center justify-center gap-3 animate-pulse z-[60] shadow-lg">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest">
              جاري حفظ البيانات في السحابة.. يرجى عدم إغلاق المتصفح لضمان سلامة العمليات.
            </span>
            <AlertCircle className="w-4 h-4" />
          </div>
        )}

        <header className={`${isPreviousDayUnclosed && !isSaving ? 'bg-red-600 text-white shadow-red-200' : isSaving ? 'bg-slate-50 text-slate-800' : 'bg-white text-slate-800'} shadow-sm h-16 flex items-center justify-between px-6 lg:px-8 shrink-0 transition-all duration-500 z-10`}>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg lg:hidden ${isPreviousDayUnclosed && !isSaving ? 'text-white hover:bg-red-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              {isSaving ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-full">
                  <Save className="w-3 h-3 animate-bounce" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">جاري الحفظ...</span>
                </div>
              ) : !dbFullLoaded ? ( 
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border animate-pulse ${isPreviousDayUnclosed ? 'bg-red-700 border-red-500 text-white' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="text-[10px] font-bold whitespace-nowrap uppercase">Syncing...</span>
                </div> 
              ) : ( 
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border group cursor-default ${isPreviousDayUnclosed ? 'bg-red-700 border-red-500 text-white' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-[10px] font-bold hidden group-hover:block transition-all">البيانات مكتملة</span>
                </div> 
              )}
              {isPreviousDayUnclosed && !isSaving && ( 
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full border border-white/30 text-[10px] font-black uppercase tracking-widest animate-pulse cursor-pointer hover:bg-white/30 transition-colors" onClick={() => navigate('/daily-closing')}>
                  <AlertTriangle className="w-3 h-3" /> {missingClosings.length} أيام لم تقفل
                </div> 
              )}
            </div>
          </div>
          <div className="flex-1 flex justify-center max-w-lg mx-auto">
            <div className="relative w-full hidden md:block">
              <Search className={`absolute left-3 top-2.5 h-4 w-4 ${isPreviousDayUnclosed && !isSaving ? 'text-white/70' : 'text-slate-400'}`} />
              <input readOnly onClick={() => setIsCommandOpen(true)} className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:outline-none cursor-pointer transition-colors font-medium ${isPreviousDayUnclosed && !isSaving ? 'bg-white/10 border-white/20 text-white placeholder-white/60 hover:bg-white/20' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'}`} placeholder={`${t('cust.search')} (Ctrl+K)`} />
            </div>
          </div>
          <div className="flex items-center gap-4 ltr:ml-auto rtl:mr-auto">
            <div className={`text-xs font-bold hidden sm:block ${isPreviousDayUnclosed && !isSaving ? 'text-white/80' : 'text-slate-400'}`}>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-slate-50 p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in zoom-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
