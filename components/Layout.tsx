
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS, APP_NAME } from '../constants';
import { authService } from '../services/auth';
import { 
  LogOut, User, Menu, X, ShoppingCart, FileText, Package, Activity, 
  Truck, Users, AlertTriangle, TrendingUp, ChevronDown, ChevronRight, 
  Phone, Search, Command, ShoppingBag, PlusCircle, Warehouse as WarehouseIcon, 
  LayoutGrid, ClipboardCheck, ShieldCheck, ClipboardList, RefreshCw, CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { db } from '../services/db';
import { t, isRTL } from '../utils/t';
import AiAssistant from './AiAssistant';
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
  
  const user = authService.getCurrentUser();
  const settings = db.getSettings();

  // التحقق من تقفيل اليوم السابق
  const isPreviousDayUnclosed = useMemo(() => {
    const closings = db.getDailyClosings();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // إذا لم يوجد تقفيل لهذا التاريخ في السجل
    return !closings.some(c => c.date === yesterdayStr);
  }, [location.pathname]); // إعادة التحقق عند تغيير المسار لضمان المزامنة

  useEffect(() => {
    // إظهار تنبيه منبثق عند فتح أي تبويب إذا لم يتم التقفيل
    if (isPreviousDayUnclosed) {
      toast.custom((t_toast: any) => (
        <div className={`${t_toast.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-r-4 border-red-500`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <div className="ml-3 rtl:mr-3 flex-1">
                <p className="text-sm font-bold text-gray-900">تحذير النظام</p>
                <p className="mt-1 text-sm text-gray-500">لم يتم تقفيل الخزينة لليوم السابق. يرجى التوجه لتبويب "تقفيل اليومية" لتسوية الحسابات.</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t_toast.id)}
              className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              إغلاق
            </button>
          </div>
        </div>
      ), { duration: 4000 });
    }
  }, [location.pathname, isPreviousDayUnclosed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsCommandOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const checkLoad = setInterval(() => {
        if (db.isFullyLoaded !== dbFullLoaded) setDbFullLoaded(db.isFullyLoaded);
    }, 2000);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        clearInterval(checkLoad);
    };
  }, [dbFullLoaded]);

  const handleLogout = () => {
    authService.logout();
  };

  const toggleMenu = (key: string) => {
      setOpenMenu(prev => prev === key ? null : key);
  };

  const sidebarItems = [
    { label: t('nav.dashboard'), path: '/', icon: NAV_ITEMS[0].icon, perm: 'VIEW_DASHBOARD', roles: ['ADMIN', 'TELESALES'] },
    { label: 'المدير', path: '/settings', icon: ShieldCheck, perm: 'MANAGE_SETTINGS', roles: ['ADMIN'] },
    {
        key: 'sales_mgmt',
        label: t('nav.sales'),
        icon: ShoppingCart,
        perm: 'MANAGE_SALES',
        roles: ['ADMIN', 'REP', 'TELESALES'],
        children: [
            { label: t('nav.new_invoice'), path: '/invoice/new', icon: PlusCircle },
            { label: t('nav.invoices'), path: '/invoices', icon: FileText }
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
            { label: t('stock.order'), path: '/purchase-orders', icon: Truck }
        ]
    },
    {
        key: 'product_mgmt',
        label: t('nav.products'),
        icon: LayoutGrid,
        perm: 'MANAGE_INVENTORY',
        roles: ['ADMIN', 'TELESALES'],
        children: [
            { label: t('nav.all_items'), path: '/inventory', icon: Package },
            { label: t('nav.inventory_analysis'), path: '/inventory/analysis', icon: Activity },
            { label: t('nav.shortages'), path: '/shortages', icon: AlertTriangle }
        ]
    },
    {
        key: 'storage_mgmt',
        label: t('nav.storage'),
        icon: WarehouseIcon,
        perm: 'MANAGE_WAREHOUSES',
        roles: ['ADMIN'],
        children: [
            { label: t('ware.title'), path: '/warehouses', icon: WarehouseIcon },
            { label: t('stock.inventory_count'), path: '/stock-take', icon: ClipboardCheck }
        ]
    },
    { label: t('cust.title'), path: '/customers', icon: NAV_ITEMS[4].icon, perm: 'MANAGE_CUSTOMERS', roles: ['ADMIN', 'REP', 'TELESALES'] },
    { label: t('supp.title'), path: '/suppliers', icon: Users, perm: 'MANAGE_SUPPLIERS', roles: ['ADMIN'] },
    {
        key: 'user_mgmt',
        label: t('nav.user_management'),
        icon: Users,
        perm: 'MANAGE_REPS', 
        roles: ['ADMIN'],
        children: [
            { label: t('rep.title'), path: '/representatives', icon: User },
            { label: t('nav.telesales'), path: '/telesales', icon: Phone }
        ]
    },
    {
        key: 'cash_mgmt',
        label: t('nav.cash'),
        icon: NAV_ITEMS[5].icon,
        perm: 'MANAGE_CASH',
        roles: ['ADMIN', 'REP', 'TELESALES'],
        children: [
            { label: 'الخزينة (حركات)', path: '/cash', icon: NAV_ITEMS[5].icon },
            { label: 'تقفيل اليومية', path: '/daily-closing', icon: ClipboardList }
        ]
    },
    { label: t('nav.reports'), path: '/reports', icon: TrendingUp, perm: 'VIEW_REPORTS', roles: ['ADMIN'] },
    { label: t('nav.settings'), path: '/settings', icon: NAV_ITEMS[6].icon, perm: 'MANAGE_SETTINGS', roles: ['ADMIN'] },
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
            if (item.roles && user && !item.roles.includes(user.role)) return null;
            if (item.children) {
                const isOpen = openMenu === item.key;
                return (
                    <div key={item.key} className={`space-y-1 rounded-xl transition-all duration-300 ${isOpen ? 'bg-white/5 pb-2' : ''}`}>
                        <button onClick={() => toggleMenu(item.key)} className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 group font-bold ${isOpen ? 'text-white bg-blue-600' : 'text-white hover:bg-slate-800'}`}>
                            <div className="flex items-center"><item.icon className={`w-5 h-5 ltr:mr-3 rtl:ml-3 shrink-0 ${isOpen ? 'text-white' : 'text-blue-400'}`} />{item.label}</div>
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : isRTL() ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {isOpen && (
                            <div className={`space-y-1 ${isRTL() ? 'pr-4 border-r border-white/10' : 'pl-4 border-l border-white/10'} ml-3 mr-3 mt-1 animate-in slide-in-from-top-2 duration-200`}>
                                {item.children.map((child: any) => (
                                    <NavLink key={child.path} to={child.path} onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${isActive ? 'bg-orange-600 text-white' : 'text-white/80 hover:text-white hover:bg-white/5'}`}>
                                        <child.icon className="w-4 h-4 ltr:mr-3 rtl:ml-3 shrink-0 opacity-70" />{child.label}
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }
            return (
                <NavLink key={item.path} to={item.path} onClick={() => { setIsSidebarOpen(false); setOpenMenu(null); }} className={({ isActive }) => `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group font-bold ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-white hover:bg-slate-800'}`}>
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
          <button onClick={handleLogout} className="flex items-center w-full px-4 py-2 text-sm font-bold text-red-400 rounded-lg hover:bg-red-950/30 transition-colors">
            <LogOut className="w-5 h-5 ltr:mr-3 rtl:ml-3" />{t('nav.logout') || 'تسجيل الخروج'}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - يتغير لونه للأحمر عند توفر الشرط */}
        <header className={`${isPreviousDayUnclosed ? 'bg-red-600 text-white' : 'bg-white text-slate-800'} shadow-sm h-16 flex items-center justify-between px-6 lg:px-8 shrink-0 transition-colors duration-500`}>
          <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg lg:hidden ${isPreviousDayUnclosed ? 'text-white hover:bg-red-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Menu className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-2">
                  {!dbFullLoaded ? (
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
                  {isPreviousDayUnclosed && (
                    <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full border border-white/30 text-[10px] font-black uppercase tracking-widest animate-pulse">
                      <AlertTriangle className="w-3 h-3" /> اليوم السابق لم يُقفل
                    </div>
                  )}
              </div>
          </div>
          
          <div className="flex-1 flex justify-center max-w-lg mx-auto">
            <div className="relative w-full hidden md:block">
              <Search className={`absolute left-3 top-2.5 h-4 w-4 ${isPreviousDayUnclosed ? 'text-white/70' : 'text-slate-400'}`} />
              <input 
                readOnly
                onClick={() => setIsCommandOpen(true)}
                className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:outline-none cursor-pointer transition-colors font-medium ${isPreviousDayUnclosed ? 'bg-white/10 border-white/20 text-white placeholder-white/60 hover:bg-white/20' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'}`}
                placeholder={`${t('cust.search')} (Ctrl+K)`}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 ltr:ml-auto rtl:mr-auto">
             <div className={`text-xs font-bold hidden sm:block ${isPreviousDayUnclosed ? 'text-white/80' : 'text-slate-400'}`}>
                 {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in zoom-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>

      {isCommandOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsCommandOpen(false)}>
           <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center p-4 border-b">
                 <Search className="w-5 h-5 text-slate-400 mr-3" />
                 <input 
                    autoFocus
                    className="flex-1 outline-none text-lg text-slate-800 font-bold"
                    placeholder="ابحث عن عملاء، أصناف، أو فواتير..."
                    value={commandSearch}
                    onChange={e => setCommandSearch(e.target.value)}
                 />
                 <X className="w-5 h-5 text-slate-400 cursor-pointer" onClick={() => setIsCommandOpen(false)} />
              </div>
              <div className="p-3 bg-slate-50 border-t flex justify-between items-center text-[10px] text-slate-400 font-bold">
                 <span>ESC للإغلاق</span>
              </div>
           </div>
        </div>
      )}

      <AiAssistant />
    </div>
  );
}
