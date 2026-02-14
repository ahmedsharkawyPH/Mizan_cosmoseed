
import React from 'react';
import { ClipboardList, Edit, Trash2 } from 'lucide-react';

interface Props {
    products: any[];
    currency: string;
    warehouseFilter: string;
    bestSuppliers: Record<string, string>;
    onViewCard: (p: any) => void;
    onEdit: (p: any) => void;
    onDelete: (id: string) => void;
}

const InventoryTable: React.FC<Props> = ({ 
    products, currency, warehouseFilter, bestSuppliers, onViewCard, onEdit, onDelete 
}) => (
    <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b">
                    <tr>
                        <th className="px-6 py-4">الصنف</th>
                        <th className="px-6 py-4 text-center">كود</th>
                        <th className="px-6 py-4 text-center">أفضل مورد</th>
                        <th className="px-6 py-4 text-center">سعر البيع</th>
                        <th className="px-6 py-4 text-center">الرصيد</th>
                        <th className="px-6 py-4 text-center">إجراء</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                    {products.map((p) => {
                        const totalQty = warehouseFilter === 'ALL' 
                            ? (p.batches?.reduce((s:any, b:any) => s + b.quantity, 0) || 0)
                            : (p.batches?.find((b:any) => b.warehouse_id === warehouseFilter)?.quantity || 0);
                            
                        return (
                            <tr key={p.id} className="hover:bg-blue-50/50 group transition-colors">
                                <td className="px-6 py-4 text-slate-800">{p.name}</td>
                                <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">{p.code || '---'}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-lg border">
                                        {bestSuppliers[p.id] || '---'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center text-blue-600">{currency}{(p.selling_price || 0).toLocaleString()}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-lg text-sm font-black ${totalQty <= 0 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                        {totalQty}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-1">
                                        <button onClick={() => onViewCard(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><ClipboardList className="w-4 h-4" /></button>
                                        <button onClick={() => onEdit(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(p.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

export default React.memo(InventoryTable);
