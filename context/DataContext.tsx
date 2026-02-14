
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

  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [settings, setSettings] = useState(db.getSettings());

  const loadAndPatchData = useCallback(async () => {
    setIsLoading(true);
    try {
        // --- المرحلة 1: جلب البيانات الضخمة (الـ Baseline) ---
        setLoadingMessage("جاري جلب قائمة الأصناف (23,000 صنف)...");
        
        const [
            allProductsFromDB, // الخط الأساسي
            latestPricesMap,   // خريطة التحديثات (الـ Patch)
            allBatches,
            allCustomers,
            allSuppliers,
            allInvoices,
            allPurchaseInvoices,
            allWarehouses,
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
            db.fetchAllFromTable('cash_transactions')
        ]);

        // --- المرحلة 2: عملية الدمج الانتقائي (The Pyramid of Truth) ---
        setLoadingMessage("جاري تحديث الأسعار اللحظية...");

        const patchedProducts: ProductWithBatches[] = allProductsFromDB.map((product: Product) => {
            const priceUpdate = latestPricesMap.get(product.id);
            const productBatches = allBatches.filter((b: any) => b.product_id === product.id);

            // تطبيق هرم الحقيقة
            if (priceUpdate) {
                // الأولوية القصوى: آخر سعر في التشغيلات
                return {
                    ...product,
                    selling_price: priceUpdate.selling,
                    purchase_price: priceUpdate.purchase,
                    batches: productBatches
                };
            } else {
                // الحقيقة الاحتياطية: السعر المسجل في جدول المنتجات
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
        setCashTransactions(allTxs);
        
        // مزامنة قاعدة البيانات المحلية
        db.products = allProductsFromDB;
        db.batches = allBatches;
        db.customers = allCustomers;
        db.suppliers = allSuppliers;
        db.invoices = allInvoices;
        db.purchaseInvoices = allPurchaseInvoices;
        db.warehouses = allWarehouses;
        db.cashTransactions = allTxs;
        db.saveToLocalCache(true);

        setLoadingMessage("اكتمل التحميل بنجاح.");
    } catch (error) {
        console.error("Fatal Error during data loading:", error);
        setLoadingMessage("فشل تحميل البيانات. يرجى التأكد من اتصال الإنترنت.");
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
    setCashTransactions(db.getCashTransactions());
    setSettings(db.getSettings());
  }, []);

  const value = useMemo(() => ({
    txs: cashTransactions,
    customers,
    suppliers,
    products,
    invoices,
    purchaseInvoices,
    warehouses,
    settings,
    isLoading,
    loadingMessage,
    refreshData
  }), [cashTransactions, customers, suppliers, products, invoices, purchaseInvoices, warehouses, settings, isLoading, loadingMessage, refreshData]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
