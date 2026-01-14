
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewInvoice from './pages/NewInvoice';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import CashRegister from './pages/CashRegister';
import Settings from './pages/Settings';
import PurchaseInvoice from './pages/PurchaseInvoice';
import PurchaseList from './pages/PurchaseList';
import PurchaseOrders from './pages/PurchaseOrders';
import Representatives from './pages/Representatives';
import Telesales from './pages/Telesales';
import Suppliers from './pages/Suppliers';
import Warehouses from './pages/Warehouses';
import Login from './pages/Login';
import InventoryAnalysis from './pages/InventoryAnalysis';
import Shortages from './pages/Shortages';
import Reports from './pages/Reports';
import { ProtectedRoute } from './components/ProtectedRoute';
import { db } from './services/db';
import { Loader2 } from 'lucide-react';

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
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 font-medium">Connecting to Cloud Database...</p>
          </div>
      );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="invoice/new" element={<NewInvoice />} />
            <Route path="invoice/edit/:id" element={<NewInvoice />} />
            <Route path="invoices" element={<Invoices />} />
            
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
            
            <Route path="cash" element={<CashRegister />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/*" element={<Reports />} />
            
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
