
import * as XLSX from 'xlsx';
import { ProductWithBatches } from '../types';

/**
 * يقرأ ملف إكسيل ويحوله إلى مصفوفة بيانات
 */
export const readExcelFile = <T>(file: File): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<T>(sheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * يقوم بإنشاء وتحميل نموذج إكسيل فارغ للأصناف
 */
export const downloadInventoryTemplate = () => {
  const headers = [
    {
      "code": "P001",
      "name": "اسم الصنف التجريبي",
      "quantity": 100,
      "purchase_price": 50,
      "selling_price": 75,
      "batch_number": "BATCH-01",
      "expiry_date": "2026-12-31"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory Template");

  ws['!cols'] = [
    { wch: 15 }, // code
    { wch: 30 }, // name
    { wch: 10 }, // quantity
    { wch: 15 }, // purchase_price
    { wch: 15 }, // selling_price
    { wch: 15 }, // batch_number
    { wch: 15 }, // expiry_date
  ];

  XLSX.writeFile(wb, "Mizan_Inventory_Template.xlsx");
};

/**
 * تصدير كافة المنتجات الحالية بالبيانات الأساسية المطلوبة
 */
export const exportAllProductsToExcel = (products: ProductWithBatches[]) => {
  exportFilteredProductsToExcel(products, "Master_Inventory");
};

/**
 * تصدير البيانات المصفاة (Search results / Filtered view)
 */
export const exportFilteredProductsToExcel = (products: ProductWithBatches[], fileName = "Inventory_Export") => {
    const data: any[] = [];
  
    products.forEach(product => {
      if (product.batches && product.batches.length > 0) {
        product.batches.forEach(batch => {
          data.push({
            "كود الصنف": product.code,
            "اسم الصنف": product.name,
            "سعر البيع": batch.selling_price,
            "سعر الشراء": batch.purchase_price,
            "الكمية": batch.quantity,
            "رقم التشغيلة": batch.batch_number,
            "تاريخ الصلاحية": batch.expiry_date,
            "الحالة": batch.status
          });
        });
      } else {
        data.push({
          "كود الصنف": product.code,
          "اسم الصنف": product.name,
          "سعر البيع": product.selling_price || 0,
          "سعر الشراء": product.purchase_price || 0,
          "الكمية": 0,
          "رقم التشغيلة": "-",
          "تاريخ الصلاحية": "-",
          "الحالة": "NO_BATCH"
        });
      }
    });
  
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  
    ws['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
    ];
  
    XLSX.writeFile(wb, `Mizan_${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
