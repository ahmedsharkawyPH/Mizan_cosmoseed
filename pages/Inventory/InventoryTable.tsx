import React from 'react';
import { ClipboardList, Edit, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';

interface Props {
    products: any[];
    currency: string;
    onViewCard: (p: any) => void;
    onEdit: (p: any) => void;
    onDelete: (id: string) => void;
    warehouseFilter: string;
    warehouses: any[];
}

const InventoryTable: React.FC<Props> = ({ 
    products, currency, onViewCard, onEdit, onDelete, warehouseFilter, warehouses 
}) => {
    const getWarehouseName = () => {
        if (warehouseFilter === 'ALL') return 'كافة المخازن';
        return warehouses.find(w => w.id === warehouseFilter)?.name || 'مخزن غير معروف';
    };

    return (
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b">
                        <tr>
                            <th className="px-6 py-4">الصنف / المخزن</th>
                            <th className="px-6 py-4 text-center">كود</th>
                            <th className="px-6 py-4 text-center">أفضل مورد</th>
                            <th className="px-6 py-4 text-center">سعر البيع المعتمد</th>
                            <th className="px-6 py-4 text-center">الرصيد</th>
                            <th className="px-6 py-4 text-center">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                        {products.map((p) => (
                            <tr key={p.id} className="hover:bg-blue-50/50 group transition-colors">
                                <td className="px-6 py-4">
                                    <div className="text-slate-800 text-base">{p.name}</div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <WarehouseIcon className="w-3 h-3 text-slate-300" />
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                                            {getWarehouseName()}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">{p.code || '---'}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg border border-emerald-100">
                                        {p.best_supplier_name}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="text-blue-600 font-black">{currency}{(p.display_selling_price || 0).toLocaleString()}</span>
                                        {p.display_selling_price !== p.selling_price && (
                                            <span className="text-[9px] text-slate-300 line-through">قاعدة: {p.selling_price}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center justify-center min-w-[45px] px-3 py-1 rounded-lg text-sm font-black ${p.display_quantity <= 0 ? 'text-red-600 bg-red-50 border border-red-100' : 'text-emerald-600 bg-emerald-50 border border-emerald-100'}`}>
                                        {p.display_quantity}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-1">
                                        <button onClick={() => onViewCard(p)} className="p-2 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all shadow-sm bg-white border border-slate-100" title="عرض الحركة"><ClipboardList className="w-4 h-4" /></button>
                                        <button onClick={() => onEdit(p)} className="p-2 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm bg-white border border-slate-100" title="تعديل"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(p.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm bg-white border border-slate-100" title="حذف"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {products.length === 0 && (
                <div className="py-20 text-center text-slate-300">
                    <WarehouseIcon className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="font-black">لا توجد بيانات أصناف لعرضها في هذا المخزن</p>
                </div>
            )}
        </div>
    );
};

export default React.memo(InventoryTable);