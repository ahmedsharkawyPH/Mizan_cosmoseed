import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onExport: (priceType: 'retail' | 'wholesale' | 'half_wholesale') => void;
}

export default function ExportPdfModal({ isOpen, onClose, onExport }: Props) {
  const [selectedType, setSelectedType] = useState<'retail' | 'wholesale' | 'half_wholesale'>('retail');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-800">تصدير قائمة الأسعار (PDF)</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">اختر نوع السعر المراد ظهوره في الملف:</label>
            <div className="space-y-3">
              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedType === 'retail' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                <input type="radio" name="priceType" value="retail" checked={selectedType === 'retail'} onChange={() => setSelectedType('retail')} className="w-4 h-4 text-blue-600" />
                <span className="mr-3 font-bold text-slate-800">سعر القطاعي</span>
              </label>
              
              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedType === 'half_wholesale' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                <input type="radio" name="priceType" value="half_wholesale" checked={selectedType === 'half_wholesale'} onChange={() => setSelectedType('half_wholesale')} className="w-4 h-4 text-blue-600" />
                <span className="mr-3 font-bold text-slate-800">سعر نص الجملة</span>
              </label>

              <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedType === 'wholesale' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                <input type="radio" name="priceType" value="wholesale" checked={selectedType === 'wholesale'} onChange={() => setSelectedType('wholesale')} className="w-4 h-4 text-blue-600" />
                <span className="mr-3 font-bold text-slate-800">سعر الجملة</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
            إلغاء
          </button>
          <button onClick={() => { onExport(selectedType); onClose(); }} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm">
            تصدير الآن
          </button>
        </div>
      </div>
    </div>
  );
}
