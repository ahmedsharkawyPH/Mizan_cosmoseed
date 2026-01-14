
import * as XLSX from 'xlsx';

/**
 * يقرأ ملف إكسيل ويحوله إلى مصفوفة بيانات
 */
export const readExcelFile = <T>(file: File): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // استخدام النوع array لدعم أفضل للترميز العربي UTF-8
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

  // إضافة عرض للأعمدة لجعل النموذج أكثر وضوحاً
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
