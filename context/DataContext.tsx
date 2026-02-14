
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import { 
  CashTransaction, Customer, Supplier, ProductWithBatches, 
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
  representatives: Representative[];
  settings: any;
  isLoading: boolean;
  refreshData: () => void;
  // Actions
  addTransaction: (data: any) => Promise<any>;
  recalculateBalance: (type: 'CUSTOMER' | 'SUPPLIER', id: string) => Promise<void>;
  addProduct: (pData: any, bData: any) => Promise<any>;
  updateProduct: (id: string, data: any) => Promise<any>;
  deleteProduct: (id: string) => Promise<any>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState({
    txs: db.getCashTransactions(),
    customers: db.getCustomers(),
    suppliers: db.getSuppliers(),
    products: db.getProductsWithBatches(),
    invoices: db.getInvoices(),
    purchaseInvoices: db.getPurchaseInvoices(),
    warehouses: db.getWarehouses(),
    representatives: db.getRepresentatives(),
    settings: db.getSettings(),
  });
  
  const [isLoading, setIsLoading] = useState(!db.isFullyLoaded);

  const refreshData = useCallback(() => {
    setData({
      txs: [...db.getCashTransactions()],
      customers: [...db.getCustomers()],
      suppliers: [...db.getSuppliers()],
      products: [...db.getProductsWithBatches()],
      invoices: [...db.getInvoices()],
      purchaseInvoices: [...db.getPurchaseInvoices()],
      warehouses: [...db.getWarehouses()],
      representatives: [...db.getRepresentatives()],
      settings: { ...db.getSettings() },
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
        if (db.isFullyLoaded && isLoading) refreshData();
    }, 500);
    const unsub = db.onSyncStateChange((isBusy) => {
        if (!isBusy) refreshData();
    });
    return () => { clearInterval(interval); unsub(); };
  }, [refreshData, isLoading]);

  const addTransaction = useCallback(async (txData: any) => {
    const result = await db.addCashTransaction(txData);
    if (result.success) refreshData();
    return result;
  }, [refreshData]);

  const recalculateBalance = useCallback(async (type: 'CUSTOMER' | 'SUPPLIER', id: string) => {
    await db.recalculateEntityBalance(type, id);
    refreshData();
  }, [refreshData]);

  const addProduct = useCallback(async (pData: any, bData: any) => {
    const res = await db.addProduct(pData, bData);
    if (res.success) refreshData();
    return res;
  }, [refreshData]);

  const updateProduct = useCallback(async (id: string, pData: any) => {
    const res = await db.updateProduct(id, pData);
    if (res.success) refreshData();
    return res;
  }, [refreshData]);

  const deleteProduct = useCallback(async (id: string) => {
    const res = await db.deleteProduct(id);
    if (res.success) refreshData();
    return res;
  }, [refreshData]);

  const value = useMemo(() => ({
    ...data,
    isLoading,
    refreshData,
    addTransaction,
    recalculateBalance,
    addProduct,
    updateProduct,
    deleteProduct
  }), [data, isLoading, refreshData, addTransaction, recalculateBalance, addProduct, updateProduct, deleteProduct]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
