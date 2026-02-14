
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
  representatives: Representative[];
  settings: any;
  isLoading: boolean;
  loadingMessage: string;
  refreshData: () => void;
  addProduct: (pData: any, bData: any) => Promise<any>;
  updateProduct: (id: string, data: any) => Promise<any>;
  deleteProduct: (id: string) => Promise<any>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("جاري الاتصال بقاعدة بيانات ميزان...");

  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [settings, setSettings] = useState(db.getSettings());

  const loadAndPatchData = useCallback(async () => {
    setIsLoading(true);
    try {
        // --- الخطوة 1: جلب القائمة الكاملة وقائمة التحديثات (بالتوازي) ---
        setLoadingMessage("جاري جلب بيانات الـ 23,000 صنف والأسعار المحدثة...");
        
        const [
            allProductsFromDB, // القائمة الكاملة (Baseline)
            latestPricesMap,   // تحديثات الأسعار من التشغيلات (Patch)
            allBatches,
            allCustomers,
            allSuppliers,
            allInvoices,
            allPurchaseInvoices,
            allWarehouses,
            allReps,
            allTxs
        ] = await Promise.all([
            db.fetchAllFromTable('products'),
            db.fetchLatestPricesMap(),
            db.fetchAllFromTable('batches'),
            db.fetchAllFromTable('customers'),
            db.fetchAllFromTable('suppliers'),
            db.fetchAllFromTable('invoices'),
            db.fetchAllFromTable('purchase_invoices'),
            db.fetchAllFromTable('warehouses'),
            db.fetchAllFromTable('representatives'),
            db.fetchAllFromTable('cash_transactions')
        ]);

        // --- الخطوة 2: عملية التحديث الانتقائي للأصناف (The Pyramid of Truth) ---
        setLoadingMessage("جاري تطبيق تحديثات الأسعار الذكية...");

        const patchedProducts: ProductWithBatches[] = allProductsFromDB.map((product: Product) => {
            const priceUpdate = latestPricesMap.get(product.id);
            const productBatches = allBatches.filter((b: any) => b.product_id === product.id);

            if (priceUpdate) {
                // الأولوية القصوى: السعر الأحدث من التشغيلات
                return {
                    ...product,
                    selling_price: priceUpdate.selling,
                    purchase_price: priceUpdate.purchase,
                    batches: productBatches
                };
            } else {
                // الحقيقة الاحتياطية: السعر الافتراضي من جدول المنتجات
                return {
                    ...product,
                    batches: productBatches
                };
            }
        });

        // تحديث الحالات (State)
        setProducts(patchedProducts);
        setCustomers(allCustomers);
        setSuppliers(allSuppliers);
        setInvoices(allInvoices);
        setPurchaseInvoices(allPurchaseInvoices);
        setWarehouses(allWarehouses);
        setRepresentatives(allReps);
        setCashTransactions(allTxs);
        
        // مزامنة قاعدة البيانات المحلية
        db.products = allProductsFromDB;
        db.batches = allBatches;
        db.customers = allCustomers;
        db.suppliers = allSuppliers;
        db.invoices = allInvoices;
        db.purchaseInvoices = allPurchaseInvoices;
        db.warehouses = allWarehouses;
        db.representatives = allReps;
        db.cashTransactions = allTxs;
        db.saveToLocalCache(true);

        setLoadingMessage("اكتمل التحميل بنجاح.");
    } catch (error) {
        console.error("Fatal Error during data loading:", error);
        setLoadingMessage("فشل تحميل البيانات. يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAndPatchData();
  }, [loadAndPatchData]);

  const refreshData = useCallback(() => {
    setProducts(db.getProductsWithBatches());
    setCustomers(db.getCustomers());
    setSuppliers(db.getSuppliers());
    setInvoices(db.getInvoices());
    setPurchaseInvoices(db.getPurchaseInvoices());
    setWarehouses(db.getWarehouses());
    setRepresentatives(db.getRepresentatives());
    setCashTransactions(db.getCashTransactions());
    setSettings(db.getSettings());
  }, []);

  // Actions
  const addProduct = async (pData: any, bData: any) => {
    const res = await db.addProduct(pData, bData);
    if (res.success) refreshData();
    return res;
  };

  const updateProduct = async (id: string, data: any) => {
    const res = await db.updateProduct(id, data);
    if (res.success) refreshData();
    return res;
  };

  const deleteProduct = async (id: string) => {
    const res = await db.deleteProduct(id);
    if (res.success) refreshData();
    return res;
  };

  const addTransaction = async (txData: any) => {
    const result = await db.addCashTransaction(txData);
    if (result.success) refreshData();
    return result;
  };

  const recalculateBalance = async (type: 'CUSTOMER' | 'SUPPLIER', id: string) => {
    await db.recalculateEntityBalance(type, id);
    refreshData();
  };

  const value = useMemo(() => ({
    txs: cashTransactions,
    customers,
    suppliers,
    products,
    invoices,
    purchaseInvoices,
    warehouses,
    representatives,
    settings,
    isLoading,
    loadingMessage,
    refreshData,
    addProduct,
    updateProduct,
    deleteProduct,
    addTransaction,
    recalculateBalance
  }), [cashTransactions, customers, suppliers, products, invoices, purchaseInvoices, warehouses, representatives, settings, isLoading, loadingMessage, refreshData]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
