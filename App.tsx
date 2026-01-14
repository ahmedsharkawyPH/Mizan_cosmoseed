import React, { useEffect, useState } from 'react';
import { HashRouter, Switch, Route, Redirect } from 'react-router-dom';
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
      <Switch>
        <Route path="/login" component={Login} />
        
        <Route path="/">
          <ProtectedRoute>
            <Layout>
              <Switch>
                <Route exact path="/" component={Dashboard} />
                
                <Route path="/invoice/new" component={NewInvoice} />
                <Route path="/invoice/edit/:id" component={NewInvoice} />
                <Route path="/invoices" component={Invoices} />
                
                <Route path="/inventory/analysis" component={InventoryAnalysis} />
                <Route path="/inventory" component={Inventory} />
                <Route path="/shortages" component={Shortages} />
                
                <Route path="/purchases/new">
                    <PurchaseInvoice type="PURCHASE" />
                </Route>
                <Route path="/purchases/return">
                    <PurchaseInvoice type="RETURN" />
                </Route>
                <Route path="/purchases/list" component={PurchaseList} />
                <Route path="/purchase-orders" component={PurchaseOrders} />
                
                <Route path="/customers" component={Customers} />
                <Route path="/suppliers" component={Suppliers} />
                <Route path="/representatives" component={Representatives} />
                <Route path="/telesales" component={Telesales} />
                <Route path="/warehouses" component={Warehouses} />
                
                <Route path="/cash" component={CashRegister} />
                <Route path="/reports" component={Reports} />
                
                <Route path="/settings" component={Settings} />
                
                <Redirect to="/" />
              </Switch>
            </Layout>
          </ProtectedRoute>
        </Route>
      </Switch>
    </HashRouter>
  );
}

export default App;