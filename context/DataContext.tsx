
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import { 
  CashTransaction, Customer, Supplier, ProductWithBatches, 
  Invoice, PurchaseInvoice, Warehouse 
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
  refreshData: () => void;
  // Actions
  addTransaction: (data: any) => Promise<any>;
  recalculateBalance: (type: 'CUSTOMER' | 'SUPPLIER', id: string) => Promise<void>;
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
      settings: { ...db.getSettings() },
    });
    setIsLoading(false);
  }, []);

  // المراقبة التلقائية لتحديثات قاعدة البيانات (سواء يدوية أو سحابية)
  useEffect(() => {
    const interval = setInterval(() => {
        if (db.isFullyLoaded && isLoading) {
            refreshData();
        }
    }, 500);

    // الاشتراك في أحداث المزامنة إذا كانت db.ts تدعم ذلك
    const unsub = db.onSyncStateChange((isBusy) => {
        if (!isBusy) refreshData();
    });

    return () => {
        clearInterval(interval);
        unsub();
    };
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

  const value = useMemo(() => ({
    ...data,
    isLoading,
    refreshData,
    addTransaction,
    recalculateBalance
  }), [data, isLoading, refreshData, addTransaction, recalculateBalance]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
