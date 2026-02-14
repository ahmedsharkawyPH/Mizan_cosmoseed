
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, FileText, Printer, ChevronRight, ChevronLeft } from 'lucide-react';
import { CashTransaction } from '../../types';

interface Props {
    transactions: CashTransaction[];
    currency: string;
    filter: string;
    onFilterChange: (val: string) => void;
    onPrint: (tx: CashTransaction) => void;
}

const ITEMS_PER_PAGE = 15;

const TransactionsTable: React.FC<Props> = ({ transactions, currency, filter, onFilterChange, onPrint }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const filteredTxs = useMemo(() => {
        return transactions.filter(t => {
            const matchCategory = filter === 'ALL' || t.category === filter;
            const searchLower = searchTerm.toLowerCase();
            const matchSearch = t.related_name?.toLowerCase().includes(searchLower) || 
                                t.notes?.toLowerCase().includes(searchLower) ||
                                t.ref_number?.toLowerCase().includes(searchLower);
            return matchCategory && matchSearch;
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, filter, searchTerm]);

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTxs.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredTxs, currentPage]);

    useEffect(() => setCurrentPage(1), [filter, searchTerm]);

    const getCategoryName = (cat: string) => {
        const map: any = {
            'CUSTOMER_PAYMENT': 'تحصيل من عميل',
            'SUPPLIER_PAYMENT': 'سداد لمورد',
            'COMMISSION': 'صرف عمولات',
            'SALARY': 'رواتب وأجور',
            'RENT': 'إيجارات',
            'OTHER': 'بنود أخرى'
        };
        return map[cat] || cat;
    };

    return (
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden no-print">
            <div className="p-6 border-b bg-slate-50/50 flex flex-col xl:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-3 text-slate-800 font-black">
                    <FileText className="w-6 h-6 text-blue-600" /> سجل حركات الخزينة
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                    <div className="relative w-full md:w-64 group">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input type="text" placeholder="بحث..." className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm w-full md:w-auto">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select value={filter} onChange={e => onFilterChange(e.target.value)} className="text-xs font-black outline-none bg-transparent cursor-pointer">
                            <option value="ALL">-- الكل --</option>
                            <option value="CUSTOMER_PAYMENT">تحصيل عملاء</option>
                            <option value="SUPPLIER_PAYMENT">سداد موردين</option>
                            <option value="COMMISSION">عمولات</option>
                            <option value="SALARY">رواتب</option>
                            <option value="OTHER">أخرى</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right min-w-[800px]">
                    <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b">
                        <tr>
                            <th className="px-6 py-4">التاريخ</th>
                            <th className="px-6 py-4">رقم السند</th>
                            <th className="px-6 py-4">البند</th>
                            <th className="px-6 py-4">الجهة / البيان</th>
                            <th className="px-6 py-4 text-left">القيمة</th>
                            <th className="px-6 py-4 text-center">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                        {paginated.map(tx => (
                            <tr key={tx.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4 text-slate-500 text-xs">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                                <td className="px-6 py-4 font-mono text-[11px] text-blue-600">{tx.ref_number}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-slate-100 px-2 py-1 rounded-lg text-[10px] uppercase">{getCategoryName(tx.category)}</span>
                                </td>
                                <td className="px-6 py-4 truncate max-w-[200px]">{tx.related_name}</td>
                                <td className={`px-6 py-4 text-left font-black ${tx.type === 'RECEIPT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {tx.type === 'RECEIPT' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button onClick={() => onPrint(tx)} className="p-2 text-slate-400 hover:text-blue-600"><Printer className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredTxs.length > ITEMS_PER_PAGE && (
                <div className="p-4 bg-slate-50 flex items-center justify-center gap-4 border-t">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded-xl bg-white"><ChevronRight className="w-4 h-4" /></button>
                    <span className="text-xs font-bold">صفحة {currentPage} من {Math.ceil(filteredTxs.length / ITEMS_PER_PAGE)}</span>
                    <button disabled={currentPage >= Math.ceil(filteredTxs.length / ITEMS_PER_PAGE)} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded-xl bg-white"><ChevronLeft className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
};

export default TransactionsTable;
