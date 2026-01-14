
import * as XLSX from 'xlsx';

export const readExcelFile = <T>(file: File): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Use 'array' type for better encoding support (Arabic/UTF-8)
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
    // Use readAsArrayBuffer instead of BinaryString
    reader.readAsArrayBuffer(file);
  });
};
