
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { db } from './services/db';
import { DataProvider, useData } from './context/DataContext';
import { Loader2, Database, ShieldCheck, RefreshCw } from 'lucide-react';
// @ts-ignore
import { Toaster } from 'react-hot-toast';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewInvoice = lazy(() => import('./pages/NewInvoice'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const CashRegister = lazy(() => import('./pages/CashRegister/index'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));

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
      <HashRouter>
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="invoice/new" element={<NewInvoice />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="suppliers" element={<Suppliers />} />
                  <Route path="cash" element={<CashRegister />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
      </HashRouter>
  );
}

function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
        await db.init();
        setIsDbReady(true);
    };
    init();
  }, []);

  if (!isDbReady) return null;

  return (
    <DataProvider>
      <Toaster position="top-right" />
      <AppContent />
    </DataProvider>
  );
}

export default App;
