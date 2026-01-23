
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { db } from './services/db';
import { Loader2 } from 'lucide-react';
// @ts-ignore
import { Toaster } from 'react-hot-toast';

// Lazy load all pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewInvoice = lazy(() => import('./pages/NewInvoice'));
const Invoices = lazy(() => import('./pages/Invoices'));
const TodayItems = lazy(() => import('./pages/TodayItems'));
const Inventory = lazy(() => import('./pages/Inventory'));
const InventoryAnalysis = lazy(() => import('./pages/InventoryAnalysis'));
const Shortages = lazy(() => import('./pages/Shortages'));
const PurchaseInvoice = lazy(() => import('./pages/PurchaseInvoice'));
const PurchaseList = lazy(() => import('./pages/PurchaseList'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Representatives = lazy(() => import('./pages/Representatives'));
const Telesales = lazy(() => import('./pages/Telesales'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const StockTake = lazy(() => import('./pages/StockTake'));
const DailyClosing = lazy(() => import('./pages/DailyClosing'));
const CashRegister = lazy(() => import('./pages/CashRegister'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const SalesReturn = lazy(() => import('./pages/SalesReturn'));

const PageLoader = () => (
    <div className="h-full w-full flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">جاري تحميل الصفحة...</p>
    </div>
);

function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
        await db.init();
        setIsDbReady(true);
    };
    init();
  }, []);

  if (!isDbReady) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
              <div className="relative">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-[10px] text-blue-700">M</div>
              </div>
              <p className="text-slate-500 font-medium">جاري تهيئة قاعدة البيانات السحابية...</p>
          </div>
      );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#334155', color: '#fff', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }} 
      />
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="invoice/new" element={<NewInvoice />} />
                  <Route path="invoice/edit/:id" element={<NewInvoice />} />
                  <Route path="invoice/return" element={<SalesReturn />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="today-items" element={<TodayItems />} />
                  
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="inventory/analysis" element={<InventoryAnalysis />} />
                  <Route path="shortages" element={<Shortages />} />
                  
                  <Route path="purchases/new" element={<PurchaseInvoice type="PURCHASE" />} />
                  <Route path="purchases/return" element={<PurchaseInvoice type="RETURN" />} />
                  <Route path="purchases/list" element={<PurchaseList />} />
                  <Route path="purchase-orders" element={<PurchaseOrders />} />
                  
                  <Route path="customers" element={<Customers />} />
                  <Route path="suppliers" element={<Suppliers />} />
                  <Route path="representatives" element={<Representatives />} />
                  <Route path="telesales" element={<Telesales />} />
                  <Route path="warehouses" element={<Warehouses />} />
                  <Route path="stock-take" element={<StockTake />} />
                  <Route path="daily-closing" element={<DailyClosing />} />
                  
                  <Route path="cash" element={<CashRegister />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="reports/*" element={<Reports />} />
                  
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
      </HashRouter>
    </>
  );
}

export default App;
