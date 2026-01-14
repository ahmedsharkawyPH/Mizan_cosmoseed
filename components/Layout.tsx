
import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS, APP_NAME } from '../constants';
import { authService } from '../services/auth';
import { LogOut, User, Menu, X, ShoppingCart, FileText, Package, Activity, Truck, Users, AlertTriangle, TrendingUp, ChevronDown, ChevronRight, Phone } from 'lucide-react';
import { db } from '../services/db';
import { t, isRTL } from '../utils/t';
import AiAssistant from './AiAssistant';

export default function Layout() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['user_mgmt']);
  const user = authService.getCurrentUser();
  const settings = db.getSettings();

  const handleLogout = () => {
    authService.logout();
  };

  const toggleMenu = (key: string) => {
      setOpenMenus(prev => 
          prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
  };

  const sidebarItems = [
    { 
        label: t('nav.dashboard'), 
        path: '/', 
        icon: NAV_ITEMS[0].icon, 
        perm: 'VIEW_DASHBOARD',
        roles: ['ADMIN', 'TELESALES']
    },
    { 
        label: t('nav.new_invoice'), 
        path: '/invoice/new', 
        icon: ShoppingCart, 
        perm: 'MANAGE_SALES',
        roles: ['ADMIN', 'REP', 'TELESALES']
    },
    { 
        label: t('nav.invoices'), 
        path: '/invoices', 
        icon: FileText, 
        perm: 'MANAGE_SALES',
        roles: ['ADMIN', 'REP', 'TELESALES']
    },
    { 
        label: t('pur.list_title'), 
        path: '/purchases/list', 
        icon: FileText, 
        perm: 'MANAGE_INVENTORY',
        roles: ['ADMIN', 'TELESALES']
    },
    { 
        label: t('nav.inventory'), 
        path: '/inventory', 
        icon: Package, 
        perm: 'MANAGE_INVENTORY',
        roles: ['ADMIN', 'TELESALES']
    },
    { 
        label: t('nav.inventory_analysis'), 
        path: '/inventory/analysis', 
        icon: Activity, 
        perm: 'MANAGE_INVENTORY',
        roles: ['ADMIN'] 
    },
    { 
        label: t('cust.title'), 
        path: '/customers', 
        icon: NAV_ITEMS[4].icon, 
        perm: 'MANAGE_CUSTOMERS',
        roles: ['ADMIN', 'REP', 'TELESALES']
    },
    { 
        label: t('supp.title'), 
        path: '/suppliers', 
        icon: Truck, 
        perm: 'MANAGE_SUPPLIERS',
        roles: ['ADMIN']
    },
    {
        key: 'user_mgmt',
        label: t('nav.user_management'),
        icon: Users,
        perm: 'MANAGE_REPS', 
        roles: ['ADMIN'],
        children: [
            { 
                label: t('rep.title'), 
                path: '/representatives', 
                icon: User
            },
            { 
                label: t('nav.telesales'), 
                path: '/telesales', 
                icon: Phone 
            }
        ]
    },
    { 
        label: t('ware.title'), 
        path: '/warehouses', 
        icon: Package, 
        perm: 'MANAGE_WAREHOUSES',
        roles: ['ADMIN']
    },
    { 
        label: t('nav.cash'), 
        path: '/cash', 
        icon: NAV_ITEMS[5].icon, 
        perm: 'MANAGE_CASH',
        roles: ['ADMIN', 'REP', 'TELESALES']
    },
    { 
        label: t('nav.shortages'), 
        path: '/shortages', 
        icon: AlertTriangle, 
        perm: 'VIEW_REPORTS',
        roles: ['ADMIN', 'TELESALES']
    },
    { 
        label: t('nav.reports'), 
        path: '/reports', 
        icon: TrendingUp, 
        perm: 'VIEW_REPORTS',
        roles: ['ADMIN']
    },
    { 
        label: t('nav.settings'), 
        path: '/settings', 
        icon: NAV_ITEMS[6].icon, 
        perm: 'MANAGE_SETTINGS',
        roles: ['ADMIN']
    },
  ];
  
  return (
    <div className={`flex h-screen bg-slate-50 ${isRTL() ? 'rtl' : 'ltr'}`} dir={isRTL() ? 'rtl' : 'ltr'}>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden glass-modal"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col
        ${isRTL() ? 'right-0' : 'left-0'}
        ${isRTL() ? (isSidebarOpen ? 'translate-x-0' : 'translate-x-full') : (isSidebarOpen ? 'translate-x-0' : '-translate-x-full')}
        `}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 shrink-0">
          <span className="text-xl font-bold tracking-tight text-white">{settings.companyName || APP_NAME}</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {sidebarItems.map((item: any) => {
            if (!authService.hasPermission(item.perm)) return null;
            if (item.roles && user && !item.roles.includes(user.role)) return null;

            if (item.children) {
                const isOpen = openMenus.includes(item.key);
                return (
                    <div key={item.key} className="space-y-1">
                        <button
                            onClick={() => toggleMenu(item.key)}
                            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 group font-medium text-slate-400 hover:bg-slate-800 hover:text-white`}
                        >
                            <div className="flex items-center">
                                <item.icon className="w-5 h-5 ltr:mr-3 rtl:ml-3 shrink-0" />
                                {item.label}
                            </div>
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : isRTL() ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        
                        {isOpen && (
                            <div className={`space-y-1 ${isRTL() ? 'pr-4 border-r border-slate-700' : 'pl-4 border-l border-slate-700'} ml-3 mr-3`}>
                                {item.children.map((child: any) => (
                                    <NavLink
                                        key={child.path}
                                        to={child.path}
                                        onClick={() => setIsSidebarOpen(false)}
                                        className={({ isActive }) =>
                                            `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                                            isActive
                                                ? 'bg-blue-600 text-white'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                            }`
                                        }
                                    >
                                        <child.icon className="w-4 h-4 ltr:mr-3 rtl:ml-3 shrink-0" />
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
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group font-medium ${
                    isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                }
                >
                <item.icon className="w-5 h-5 ltr:mr-3 rtl:ml-3 shrink-0" />
                {item.label}
                </NavLink>
            );
          })}
        </nav>

        <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-3 px-2">
             <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">
                 {user?.name?.charAt(0) || 'U'}
             </div>
             <div className="overflow-hidden">
                 <p className="text-sm font-bold truncate">{user?.name}</p>
                 <p className="text-xs text-slate-500 truncate">{user?.role}</p>
             </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-5 h-5 ltr:mr-3 rtl:ml-3" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 lg:px-8">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-slate-500 rounded-lg lg:hidden hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4 ltr:ml-auto rtl:mr-auto">
             <div className="text-sm text-slate-500 hidden sm:block">
                 {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-in fade-in zoom-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Intelligent AI Assistant */}
      <AiAssistant />
    </div>
  );
}
