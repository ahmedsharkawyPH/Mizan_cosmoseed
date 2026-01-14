
import React, { useState, useEffect } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { NAV_ITEMS, APP_NAME } from '../constants';
import { authService } from '../services/auth';
import { LogOut, User, Menu, X, ShoppingCart, FileText, Package, Activity, Truck, Users, AlertTriangle, TrendingUp, ChevronDown, ChevronRight, Phone, Search, Command, ShoppingBag } from 'lucide-react';
import { db } from '../services/db';
import { t, isRTL } from '../utils/t';
import AiAssistant from './AiAssistant';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const history = useHistory();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['user_mgmt']);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const user = authService.getCurrentUser();
  const settings = db.getSettings();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsCommandOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    authService.logout();
  };

  const toggleMenu = (key: string) => {
      setOpenMenus(prev => 
          prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
  };

  const sidebarItems = [
    { label: t('nav.dashboard'), path: '/', icon: NAV_ITEMS[0].icon, perm: 'VIEW_DASHBOARD', roles: ['ADMIN', 'TELESALES'] },
    { label: t('nav.new_invoice'), path: '/invoice/new', icon: ShoppingCart, perm: 'MANAGE_SALES', roles: ['ADMIN', 'REP', 'TELESALES'] },
    { label: t('nav.invoices'), path: '/invoices', icon: FileText, perm: 'MANAGE_SALES', roles: ['ADMIN', 'REP', 'TELESALES'] },
    { label: t('pur.list_title'), path: '/purchases/list', icon: FileText, perm: 'MANAGE_INVENTORY', roles: ['ADMIN', 'TELESALES'] },
    { label: t('stock.order'), path: '/purchase-orders', icon: ShoppingBag, perm: 'MANAGE_INVENTORY', roles: ['ADMIN', 'TELESALES'] },
    { label: t('nav.inventory'), path: '/inventory', icon: Package, perm: 'MANAGE_INVENTORY', roles: ['ADMIN', 'TELESALES'] },
    { label: t('nav.inventory_analysis'), path: '/inventory/analysis', icon: Activity, perm: 'MANAGE_INVENTORY', roles: ['ADMIN'] },
    { label: t('cust.title'), path: '/customers', icon: NAV_ITEMS[4].icon, perm: 'MANAGE_CUSTOMERS', roles: ['ADMIN', 'REP', 'TELESALES'] },
    { label: t('supp.title'), path: '/suppliers', icon: Truck, perm: 'MANAGE_SUPPLIERS', roles: ['ADMIN'] },
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
    { label: t('ware.title'), path: '/warehouses', icon: Package, perm: 'MANAGE_WAREHOUSES', roles: ['ADMIN'] },
    { label: t('nav.cash'), path: '/cash', icon: NAV_ITEMS[5].icon, perm: 'MANAGE_CASH', roles: ['ADMIN', 'REP', 'TELESALES'] },
    { label: t('nav.shortages'), path: '/shortages', icon: AlertTriangle, perm: 'VIEW_REPORTS', roles: ['ADMIN', 'TELESALES'] },
    { label: t('nav.reports'), path: '/reports', icon: TrendingUp, perm: 'VIEW_REPORTS', roles: ['ADMIN'] },
    { label: t('nav.settings'), path: '/settings', icon: NAV_ITEMS[6].icon, perm: 'MANAGE_SETTINGS', roles: ['ADMIN'] },
  ];

  const searchResults = commandSearch.length > 2 ? [
    ...db.getCustomers().filter(c => c.name.toLowerCase().includes(commandSearch.toLowerCase())).map(c => ({ type: 'Customer', name: c.name, path: '/customers' })),
    ...db.getProductsWithBatches().filter(p => p.name.toLowerCase().includes(commandSearch.toLowerCase())).map(p => ({ type: 'Product', name: p.name, path: '/inventory' }))
  ] : [];
  
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
                const isOpen = openMenus.includes(item.key);
                return (
                    <div key={item.key} className="space-y-1">
                        <button onClick={() => toggleMenu(item.key)} className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 group font-medium text-slate-400 hover:bg-slate-800 hover:text-white`}>
                            <div className="flex items-center"><item.icon className="w-5 h-5 ltr:mr-3 rtl:ml-3 shrink-0" />{item.label}</div>
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : isRTL() ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {isOpen && (
                            <div className={`space-y-1 ${isRTL() ? 'pr-4 border-r border-slate-700' : 'pl-4 border-l border-slate-700'} ml-3 mr-3`}>
                                {item.children.map((child: any) => {
                                    const isActive = location.pathname === child.path;
                                    return (
                                        <Link key={child.path} to={child.path} onClick={() => setIsSidebarOpen(false)} className={`flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                                            <child.icon className="w-4 h-4 ltr:mr-3 rtl:ml-3 shrink-0" />{child.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            }
            
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
                <Link key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group font-medium ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <item.icon className="w-5 h-5 ltr:mr-3 rtl:ml-3 shrink-0" />{item.label}
                </Link>
            );
          })}
        </nav>

        <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-3 px-2">
             <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">{user?.name?.charAt(0) || 'U'}</div>
             <div className="overflow-hidden">
                 <p className="text-sm font-bold truncate">{user?.name}</p>
                 <p className="text-xs text-slate-500 truncate">{user?.role}</p>
             </div>
          </div>
          <button onClick={handleLogout} className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 rounded-lg hover:bg-slate-800 transition-colors">
            <LogOut className="w-5 h-5 ltr:mr-3 rtl:ml-3" />Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 lg:px-8">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-lg lg:hidden hover:bg-slate-100">
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1 flex justify-center max-w-lg mx-auto">
            <div className="relative w-full hidden md:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                readOnly
                onClick={() => setIsCommandOpen(true)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                placeholder={`${t('cust.search')} (Ctrl+K)`}
              />
              <div className="absolute right-3 top-2 flex gap-1 pointer-events-none">
                 <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-400 font-mono">⌘</kbd>
                 <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-400 font-mono">K</kbd>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 ltr:ml-auto rtl:mr-auto">
             <div className="text-sm text-slate-500 hidden sm:block">
                 {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-in fade-in zoom-in duration-300">
            {children}
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
                    className="flex-1 outline-none text-lg text-slate-800"
                    placeholder="Type to search customers, products, invoices..."
                    value={commandSearch}
                    onChange={e => setCommandSearch(e.target.value)}
                 />
                 <X className="w-5 h-5 text-slate-400 cursor-pointer" onClick={() => setIsCommandOpen(false)} />
              </div>
              <div className="max-h-[400px] overflow-y-auto p-2">
                 {searchResults.length > 0 ? (
                    searchResults.map((res, i) => (
                      <div key={i} onClick={() => { history.push(res.path); setIsCommandOpen(false); }} className="flex items-center justify-between p-3 hover:bg-blue-50 rounded-xl cursor-pointer group">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${res.type === 'Customer' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {res.type === 'Customer' ? <Users className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-700">{res.name}</div>
                            <div className="text-xs text-slate-400">{res.type}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100" />
                      </div>
                    ))
                 ) : (
                   <div className="p-10 text-center text-slate-400 flex flex-col items-center">
                      <Command className="w-12 h-12 mb-2 opacity-10" />
                      <p>Start typing to search Mizan system...</p>
                   </div>
                 )}
              </div>
              <div className="p-3 bg-slate-50 border-t flex justify-between items-center text-[10px] text-slate-400 font-bold">
                 <div className="flex gap-4">
                    <span>↑↓ TO NAVIGATE</span>
                    <span>ENTER TO SELECT</span>
                 </div>
                 <span>ESC TO CLOSE</span>
              </div>
           </div>
        </div>
      )}

      <AiAssistant />
    </div>
  );
}
