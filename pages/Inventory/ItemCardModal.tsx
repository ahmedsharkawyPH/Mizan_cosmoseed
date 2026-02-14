
import React from 'react';
import { X, ClipboardList, Printer } from 'lucide-react';
import { useProductMovements } from '../../hooks/useProductMovements';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    product: any;
    currency: string;
}

const ItemCardModal: React.FC<Props> = ({ isOpen, onClose, product, currency }) => {
    const movements = useProductMovements(product?.id);
    
    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <h3 className="text-xl font-black flex items-center gap-3">
                        <ClipboardList className="w-6 h-6 text-blue-400" /> كارت حركة: {product.name}
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="bg-blue-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><Printer className="w-4 h-4" /> طباعة</button>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-8 space-y-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div><span className="text-[10px] font-black text-slate-400 uppercase">كود الصنف</span><div className="font-mono text-blue-600 text-lg">{product.code || '---'}</div></div>
                        <div><span className="text-[10px] font-black text-slate-400 uppercase">الرصيد الإجمالي</span><div className="font-black text-emerald-600 text-lg">{product.batches?.reduce((s:any,b:any)=>s+b.quantity,0) || 0}</div></div>
                        <div><span className="text-[10px] font-black text-slate-400 uppercase">سعر البيع الحالي</span><div className="font-black text-slate-800 text-lg">{currency}{product.selling_price}</div></div>
                    </div>
                    <table className="w-full text-xs text-right border-collapse">
                        <thead className="bg-slate-800 text-white font-black uppercase sticky top-0">
                            <tr>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3 text-center">النوع</th>
                                <th className="p-3">المرجع</th>
                                <th className="p-3">البيان</th>
                                <th className="p-3 text-center text-emerald-400">وارد</th>
                                <th className="p-3 text-center text-rose-400">صادر</th>
                                <th className="p-3 text-center bg-slate-700">الرصيد</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {movements.map((m, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-slate-500">{new Date(m.date).toLocaleDateString('ar-EG')}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${m.type.includes('PURCHASE') ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {m.type.includes('PURCHASE') ? 'شراء' : 'بيع'}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-blue-600">{m.ref}</td>
                                    <td className="p-3 text-slate-800 truncate max-w-[150px]">{m.entityName}</td>
                                    <td className="p-3 text-center text-emerald-600">{m.qtyIn || '-'}</td>
                                    <td className="p-3 text-center text-rose-600">{m.qtyOut || '-'}</td>
                                    <td className="p-3 text-center bg-slate-50 font-black">{m.balanceAfter}</td>
                                </tr>
                            ))}
                            {movements.length === 0 && (
                                <tr><td colSpan={7} className="p-10 text-center text-slate-300 italic">لا توجد حركات مسجلة لهذا الصنف بعد</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ItemCardModal;
