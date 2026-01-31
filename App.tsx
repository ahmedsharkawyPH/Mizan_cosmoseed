
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { db } from './services/db';
import { Loader2, Cloud, ShieldCheck, Sparkles } from 'lucide-react';
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
const PurchaseReturn = lazy(() => import('./pages/PurchaseReturn'));
const Commissions = lazy(() => import('./pages/Commissions'));

const PageLoader = () => (
    <div className="h-full w-full flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-400 text-sm font-medium font-sans">جاري تحميل الصفحة...</p>
    </div>
);

function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
        const startTime = Date.now();
        await db.init();
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (duration < 2000) {
            await new Promise(resolve => setTimeout(resolve, 2000 - duration));
        }
        setIsDbReady(true);
    };
    init();
  }, []);

  // إضافة حماية الخروج (Exit Guard)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (db.activeOperations > 0) {
            const msg = "هناك عمليات مزامنة سحابية جارية. هل أنت متأكد من رغبتك في الإغلاق؟ قد تفقد بعض البيانات غير المحفوظة.";
            e.preventDefault();
            e.returnValue = msg; 
            return msg;
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  if (!isDbReady) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 relative overflow-hidden text-white font-sans">
              {/* Background Glows */}
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full mix-blend-overlay filter blur-[120px] opacity-20 animate-pulse"></div>
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600 rounded-full mix-blend-overlay filter blur-[120px] opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
              
              <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
                  {/* Animated Logo */}
                  <div className="relative mb-10 group">
                      <div className="absolute inset-0 bg-blue-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse"></div>
                      <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-[2rem] flex items-center justify-center shadow-2xl border border-white/10">
                          <span className="text-5xl font-black text-white drop-shadow-lg">M</span>
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full border-4 border-slate-900 shadow-lg">
                          <ShieldCheck className="w-5 h-5 text-white" />
                      </div>
                  </div>

                  {/* Welcome Message */}
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <h2 className="text-2xl font-bold text-blue-100 mb-2">السلام عليكم ورحمة الله</h2>
                      <div className="flex items-center justify-center gap-2 text-slate-300">
                         <Cloud className="w-5 h-5 text-blue-400 animate-bounce" />
                         <p className="text-lg font-medium">جاري التهيئه وجلب المعلومات من السيرفر</p>
                      </div>
                      
                      {/* Modern Progress Bar */}
                      <div className="w-64 h-1.5 bg-white/10 rounded-full mx-auto mt-8 overflow-hidden relative border border-white/5 shadow-inner">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400 to-transparent w-full h-full animate-[progress_2s_infinite_linear]"></div>
                          <style>{`
                            @keyframes progress {
                                0% { transform: translateX(-100%); }
                                100% { transform: translateX(100%); }
                            }
                          `}</style>
                      </div>

                      <div className="pt-8">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                              <Sparkles className="w-4 h-4 text-amber-400" />
                              <p className="text-sm font-bold text-blue-200 tracking-wide">رزقكم الله الخير فى الدارين</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Footer info */}
              <div className="absolute bottom-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Mizan Online Pro • Enterprise Cloud System
              </div>
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
                  <Route path="purchases/edit/:id" element={<PurchaseInvoice type="PURCHASE" />} />
                  <Route path="purchases/return" element={<PurchaseInvoice type="RETURN" />} />
                  <Route path="purchases/return-from-invoice" element={<PurchaseReturn />} />
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
                  <Route path="commissions" element={<Commissions />} />
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
