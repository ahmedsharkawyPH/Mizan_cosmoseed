
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
// @ts-ignore
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    product: any;
    onSave: (pData: any, bData: any) => Promise<any>;
    warehouses: any[];
}

const AddProductModal: React.FC<Props> = ({ isOpen, onClose, product, onSave, warehouses }) => {
    const [form, setForm] = useState({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (product) {
            setForm({ 
                name: product.name, 
                code: product.code || '', 
                purchase_price: product.purchase_price || 0, 
                selling_price: product.selling_price || 0, 
                initial_qty: 0, 
                warehouse_id: warehouses[0]?.id || '' 
            });
        } else {
            setForm({ name: '', code: '', purchase_price: 0, selling_price: 0, initial_qty: 0, warehouse_id: warehouses[0]?.id || '' });
        }
    }, [product, warehouses]);

    const handleSave = async () => {
        if (!form.name) return toast.error("اسم الصنف مطلوب");
        setIsSubmitting(true);
        const res = await onSave(
            { name: form.name, code: form.code }, 
            { quantity: form.initial_qty, purchase_price: form.purchase_price, selling_price: form.selling_price, warehouse_id: form.warehouse_id }
        );
        if (res.success) {
            toast.success(product ? "تم التحديث" : "تمت الإضافة");
            onClose();
        } else toast.error(res.message);
        setIsSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                    <h3 className="text-xl font-black">{product ? "تعديل الصنف" : "صنف جديد"}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-8 grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">اسم الصنف</label>
                        <input className="w-full border-2 p-3 rounded-xl font-bold focus:border-blue-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase">الكود</label>
                        <input className="w-full border-2 p-3 rounded-xl font-mono focus:border-blue-500 outline-none" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
                    </div>
                    {!product && (
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase">الرصيد الافتتاحي</label>
                            <input type="number" className="w-full border-2 p-3 rounded-xl font-black focus:border-blue-500 outline-none" value={form.initial_qty} onChange={e => setForm({...form, initial_qty: parseInt(e.target.value)||0})} />
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase">سعر التكلفة</label>
                        <input type="number" className="w-full border-2 p-3 rounded-xl font-black text-red-600 focus:border-red-500 outline-none" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: parseFloat(e.target.value)||0})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase">سعر البيع</label>
                        <input type="number" className="w-full border-2 p-3 rounded-xl font-black text-emerald-600 focus:border-emerald-500 outline-none" value={form.selling_price} onChange={e => setForm({...form, selling_price: parseFloat(e.target.value)||0})} />
                    </div>
                    <button onClick={handleSave} disabled={isSubmitting} className="col-span-2 bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-400">
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ الصنف في المخزن"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddProductModal;
