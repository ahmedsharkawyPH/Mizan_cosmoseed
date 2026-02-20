
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import { 
  CashTransaction, Customer, Supplier, ProductWithBatches, Product,
  Invoice, PurchaseInvoice, Warehouse, Representative 
} from '../types';

interface DataContextType {
  txs: CashTransaction[];
  customers: Customer[];
  suppliers: Supplier[];
  products: ProductWithBatches[];
  invoices: Invoice[];
  purchaseInvoices: PurchaseInvoice[];
  warehouses: Warehouse[];
  settings: any;
  isLoading: boolean;
  loadingMessage: string;
  refreshData: () => void;
  // Actions
  addProduct: (p: any, b: any) => Promise<any>;
  updateProduct: (id: string, data: any) => Promise<any>;
  deleteProduct: (id: string) => Promise<any>;
  addCustomer: (data: any) => Promise<any>;
  updateCustomer: (id: string, data: any) => Promise<any>;
  deleteCustomer: (id: string) => Promise<any>;
  addTransaction: (data: any) => Promise<any>;
  createInvoice: (cId: string, items: any[], cash: number, isRet: boolean, disc: number, user?: any, commission?: number, cashDiscPercent?: number, manualPrevBalance?: number) => Promise<{ success: boolean; id: string; message?: string }>;
  updateInvoice: (id: string, cId: string, items: any[], cash: number, cashDiscPercent?: number, manualPrevBalance?: number) => Promise<{ success: boolean; id: string; message?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("جاري الاتصال...");
  const [dataVersion, setDataVersion] = useState(0);

  const refreshData = useCallback(() => {
    setDataVersion(v => v + 1);
  }, []);

  const data = useMemo(() => ({
      txs: db.getCashTransactions(),
      customers: db.getCustomers(),
      suppliers: db.getSuppliers(),
      products: db.getProductsWithBatches(),
      invoices: db.getInvoices(),
      purchaseInvoices: db.getPurchaseInvoices(),
      warehouses: db.getWarehouses(),
      settings: db.getSettings()
  }), [dataVersion]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setLoadingMessage("جاري جلب البيانات...");
      await db.init((msg) => setLoadingMessage(msg));
      setIsLoading(false);
      refreshData();
    };
    init();
  }, [refreshData]);

  // Wrapped Actions
  const actions = {
      addProduct: async (p: any, b: any) => { const r = await db.addProduct(p, b); refreshData(); return r; },
      updateProduct: async (id: string, d: any) => { const r = await db.updateProduct(id, d); refreshData(); return r; },
      deleteProduct: async (id: string) => { const r = await db.deleteProduct(id); refreshData(); return r; },
      addCustomer: async (d: any) => { const r = await db.addCustomer(d); refreshData(); return r; },
      updateCustomer: async (id: string, d: any) => { const r = await db.updateCustomer(id, d); refreshData(); return r; },
      deleteCustomer: async (id: string) => { const r = await db.deleteCustomer(id); refreshData(); return r; },
      addTransaction: async (d: any) => { const r = await db.addCashTransaction(d); refreshData(); return r; },
      createInvoice: async (cId: string, i: any[], c: number, r: boolean, d: number, u?: any, comm?: number, cdP?: number, mPB?: number) => { 
          const res = await db.createInvoice(cId, i, c, r, d, u, comm, cdP, mPB); 
          refreshData(); 
          return res; 
      },
      updateInvoice: async (id: string, cId: string, i: any[], c: number, cdP?: number, mPB?: number) => { 
          const res = await db.updateInvoice(id, cId, i, c, cdP, mPB); 
          refreshData(); 
          return res; 
      }
  };

  const value = useMemo(() => ({
    ...data,
    ...actions,
    isLoading,
    loadingMessage,
    refreshData
  }), [data, isLoading, loadingMessage, refreshData, actions]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
