
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
  const data: any[] = [];

  products.forEach(product => {
    // إذا كان المنتج له تشغيلات، نقوم بتصدير كل تشغيلة في سطر
    if (product.batches && product.batches.length > 0) {
      product.batches.forEach(batch => {
        data.push({
          "product_id": product.code, // استخدام الكود كمعرف للمنتج في الشيت
          "product_name": product.name,
          "selling_price": batch.selling_price,
          "purchase_price": batch.purchase_price,
          "quantity": batch.quantity,
          "expiry_date": batch.expiry_date,
          "status": batch.status
        });
      });
    } else {
      // إذا لم يكن له تشغيلات، نصدر بيانات المنتج الأساسية فقط
      data.push({
        "product_id": product.code,
        "product_name": product.name,
        "selling_price": 0,
        "purchase_price": 0,
        "quantity": 0,
        "expiry_date": "-",
        "status": "NO_BATCH"
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All Products");

  // تحسين عرض الأعمدة
  ws['!cols'] = [
    { wch: 15 }, // product_id
    { wch: 30 }, // product_name
    { wch: 12 }, // selling_price
    { wch: 12 }, // purchase_price
    { wch: 10 }, // quantity
    { wch: 15 }, // expiry_date
    { wch: 12 }, // status
  ];

  XLSX.writeFile(wb, `Mizan_Master_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
};
