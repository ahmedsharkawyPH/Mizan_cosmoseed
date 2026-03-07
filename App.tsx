
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { db } from './services/db';
import { DataProvider, useData } from './context/DataContext';
import { Loader2, Database, ShieldCheck, RefreshCw } from 'lucide-react';
// @ts-ignore
import { Toaster } from 'react-hot-toast';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

// --- CRITICAL PAGES (Direct Import for Offline Support) ---
import Dashboard from './pages/Dashboard';
import NewInvoice from './pages/NewInvoice';
import PurchaseInvoice from './pages/PurchaseInvoice';
import CashRegister from './pages/CashRegister/index';
import Login from './pages/Login';
import Invoices from './pages/Invoices';

// --- NON-CRITICAL PAGES (Lazy Load) ---
const Inventory = lazy(() => import('./pages/Inventory'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const CustomerReport = lazy(() => import('./pages/CustomerReport'));
const SupplierReport = lazy(() => import('./pages/SupplierReport'));
const PurchaseList = lazy(() => import('./pages/PurchaseList'));
const PurchaseReturn = lazy(() => import('./pages/PurchaseReturn'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const SalesReturn = lazy(() => import('./pages/SalesReturn'));
const TodayItems = lazy(() => import('./pages/TodayItems'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const StockTake = lazy(() => import('./pages/StockTake'));
const InventoryAnalysis = lazy(() => import('./pages/InventoryAnalysis'));
const Shortages = lazy(() => import('./pages/Shortages'));
const DailyClosing = lazy(() => import('./pages/DailyClosing'));
const Commissions = lazy(() => import('./pages/Commissions'));

const router = createHashRouter([
  {
    path: '/login',
    element: <Login />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'invoice/new', element: <NewInvoice /> },
          { path: 'invoice/edit/:id', element: <NewInvoice /> },
          { path: 'invoices', element: <Invoices /> },
          { path: 'invoice/return', element: <SalesReturn /> },
          { path: 'today-items', element: <TodayItems /> },
          { path: 'inventory', element: <Inventory /> },
          { path: 'warehouses', element: <Warehouses /> },
          { path: 'stock-take', element: <StockTake /> },
          { path: 'inventory/analysis', element: <InventoryAnalysis /> },
          { path: 'shortages', element: <Shortages /> },
          { path: 'purchases/new', element: <PurchaseInvoice type="PURCHASE" /> },
          { path: 'purchases/edit/:id', element: <PurchaseInvoice type="PURCHASE" /> },
          { path: 'purchases/list', element: <PurchaseList /> },
          { path: 'purchases/return-from-invoice', element: <PurchaseReturn /> },
          { path: 'purchase-orders', element: <PurchaseOrders /> },
          { path: 'customers', element: <Customers /> },
          { path: 'suppliers', element: <Suppliers /> },
          { path: 'cash', element: <CashRegister /> },
          { path: 'daily-closing', element: <DailyClosing /> },
          { path: 'commissions', element: <Commissions /> },
          { path: 'reports', element: <Reports /> },
          { path: 'reports/customer', element: <CustomerReport /> },
          { path: 'reports/supplier', element: <SupplierReport /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

const AppContent = () => {
  const { isLoading, loadingMessage } = useData();

  if (isLoading) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white p-10 text-center font-sans">
              <div className="relative mb-12">
                  <div className="absolute inset-0 bg-blue-500 blur-[80px] opacity-20 animate-pulse"></div>
                  <div className="relative bg-slate-800 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
                      <RefreshCw className="w-16 h-16 text-blue-500 animate-spin" />
                  </div>
              </div>
              
              <h2 className="text-3xl font-black mb-3 tracking-tight">MIZAN ONLINE PRO</h2>
              <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20 mb-8">
                  <Database className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Citadel Engine V4.3</span>
              </div>

              <div className="max-w-sm w-full space-y-4">
                  <p className="text-slate-400 font-bold animate-pulse text-lg">{loadingMessage}</p>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 animate-[loading_2s_infinite] w-1/2"></div>
                  </div>
              </div>

              <div className="mt-16 pt-8 border-t border-white/5 w-full max-w-xs flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-500">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase tracking-widest">End-to-End Encryption Active</span>
                  </div>
              </div>

              <style>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
              `}</style>
          </div>
      );
  }

  return (
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>}>
          <RouterProvider router={router} />
      </Suspense>
  );
}

function App() {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Standard way to trigger the browser's confirmation dialog
      e.preventDefault();
      e.returnValue = ''; // Required for some browsers
      return ''; // Required for others
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <DataProvider>
      <Toaster position="top-right" />
      <AppContent />
    </DataProvider>
  );
}

export default App;
