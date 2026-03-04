import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning';
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'تأكيد الخروج', 
  cancelText = 'البقاء في الصفحة',
  type = 'warning'
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in duration-300">
        <div className="p-6 flex justify-between items-center border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-slate-800">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8">
          <p className="text-slate-600 font-bold leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-6 bg-slate-50 flex gap-3">
          <button 
            onClick={onConfirm}
            className={`flex-1 py-4 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95 ${
              type === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {confirmText}
          </button>
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-black text-lg bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
