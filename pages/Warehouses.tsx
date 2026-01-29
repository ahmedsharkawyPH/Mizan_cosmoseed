
import React, { useState } from 'react';
import { db } from '../services/db';
import { Warehouse } from '../types';
import { t } from '../utils/t';
import { Plus, Edit2, Trash2, Warehouse as WarehouseIcon, X, CheckCircle2, ShieldAlert } from 'lucide-react';
// @ts-ignore
import toast from 'react-hot-toast';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState(db.getWarehouses());
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [name, setName] = useState('');

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setName('');
    setIsOpen(true);
  };

  const handleOpenEdit = (w: Warehouse) => {
    setIsEditMode(true);
    setCurrentId(w.id);
    setName(w.name);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
        toast.error("يرجى إدخال اسم المخزن");
        return;
    }
    
    if (isEditMode) {
      await db.updateWarehouse(currentId, name);
      toast.success("تم تحديث بيانات المخزن");
    } else {
      await db.addWarehouse(name);
      toast.success("تم إضافة المخزن الجديد بنجاح");
    }
    
    setWarehouses(db.getWarehouses());
    setIsOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('ware.delete_confirm'))) {
        const result = await db.deleteWarehouse(id);
        if (result.success) {
            toast.success("تم حذف المخزن بنجاح");
            setWarehouses(db.getWarehouses());
        } else {
            toast.error(result.message || "حدث خطأ أثناء الحذف");
        }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <WarehouseIcon className="w-8 h-8 text-blue-600" />
                {t('ware.title')}
            </h1>
            <p className="text-sm text-slate-500 font-bold mt-1">تعريف وإدارة كافة مستودعات المنشأة</p>
        </div>
        <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black shadow-lg shadow-blue-100 transition-all active:scale-95">
            <Plus className="w-5 h-5" /> {t('ware.add')}
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[500px]">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                <tr>
                    <th className="p-6">معرف المخزن</th>
                    <th className="p-6">{t('ware.name')}</th>
                    <th className="p-6 text-center">{t('ware.type')}</th>
                    <th className="p-6 text-center">الإجراءات</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
                {warehouses.map(w => (
                <tr key={w.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-6 font-mono text-slate-400 text-xs">#{w.id}</td>
                    <td className="p-6 font-black text-slate-800">{w.name}</td>
                    <td className="p-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${w.is_default ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                            {w.is_default ? <CheckCircle2 className="w-3 h-3" /> : null}
                            {w.is_default ? t('ware.default') : t('ware.sub')}
                        </span>
                    </td>
                    <td className="p-6 text-center">
                        <div className="flex justify-center gap-2">
                            <button onClick={() => handleOpenEdit(w)} className="p-2 border border-slate-100 rounded-lg bg-white text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm transition-all" title="تعديل">
                                <Edit2 className="w-4 h-4" />
                            </button>
                            {!w.is_default && (
                                <button onClick={() => handleDelete(w.id)} className="p-2 border border-slate-100 rounded-lg bg-white text-red-500 hover:bg-red-500 hover:text-white shadow-sm transition-all" title="حذف">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {/* Modal - إضافة/تعديل مخزن */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-slate-100">
            <div className="bg-slate-50 px-8 py-6 border-b flex justify-between items-center">
                <h3 className="font-black text-xl text-slate-800 flex items-center gap-3">
                    {isEditMode ? <Edit2 className="w-6 h-6 text-blue-600" /> : <Plus className="w-6 h-6 text-blue-600" />}
                    {isEditMode ? t('ware.edit') : t('ware.add')}
                </h3>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                    <X className="w-6 h-6" />
                </button>
            </div>
            
            <div className="p-8 space-y-6">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 font-bold leading-relaxed">يرجى التأكد من اسم المخزن جيداً، حيث يتم ربط فواتير المشتريات والمبيعات به لتتبع حركة المخزون بدقة.</p>
                </div>

                <div>
                    <label htmlFor="warehouse_name_input" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{t('ware.name')}</label>
                    <input 
                        id="warehouse_name_input"
                        placeholder="أدخل اسم المخزن هنا..." 
                        className="w-full border-2 border-slate-100 p-4 rounded-2xl font-black text-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        autoFocus
                    />
                </div>
            </div>

            <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row gap-3">
                <button onClick={() => setIsOpen(false)} className="flex-1 py-4 text-slate-500 font-black hover:bg-slate-200 rounded-2xl transition-all uppercase tracking-widest">{t('common.cancel')}</button>
                <button onClick={handleSave} className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" />
                    {t('set.save')}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// أيقونة الحفظ للاستخدام داخل الزر
const Save = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);
