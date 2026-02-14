
import React, { useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { CashTransaction } from '../../types';

interface Props {
    transactions: CashTransaction[];
    currency: string;
    filter: string;
}

const StatsCards: React.FC<Props> = ({ transactions, currency, filter }) => {
    const stats = useMemo(() => {
        const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.category === filter);
        const income = filtered.filter(t => t.type === 'RECEIPT' && t.status !== 'CANCELLED').reduce((sum, t) => sum + t.amount, 0);
        const expenses = filtered.filter(t => t.type === 'EXPENSE' && t.status !== 'CANCELLED').reduce((sum, t) => sum + t.amount, 0);
        return { income, expenses, net: income - expenses };
    }, [transactions, filter]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
            <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><ArrowDownLeft className="w-16 h-16 text-emerald-600" /></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">إجمالي المقبوضات</p>
                <h3 className="text-3xl font-black text-emerald-600 mt-2">{currency}{stats.income.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><ArrowUpRight className="w-16 h-16 text-rose-600" /></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">إجمالي المصروفات</p>
                <h3 className="text-3xl font-black text-rose-600 mt-2">{currency}{stats.expenses.toLocaleString()}</h3>
            </div>
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet className="w-16 h-16 text-white" /></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">صافي السيولة الحالية</p>
                <h3 className={`text-3xl font-black mt-2 ${stats.net < 0 ? 'text-rose-400' : 'text-blue-400'}`}>{currency}{stats.net.toLocaleString()}</h3>
            </div>
        </div>
    );
};

export default StatsCards;
