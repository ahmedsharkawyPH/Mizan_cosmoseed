
import React from 'react';
import { Search } from 'lucide-react';

interface Props {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    warehouseFilter: string;
    setWarehouseFilter: (val: string) => void;
    hideZero: boolean;
    setHideZero: (val: boolean) => void;
    showLow: boolean;
    setShowLow: (val: boolean) => void;
    warehouses: any[];
    totalCount: number;
}

const InventoryControls: React.FC<Props> = ({ 
    searchQuery, setSearchQuery, warehouseFilter, setWarehouseFilter, 
    hideZero, setHideZero, showLow, setShowLow, warehouses, totalCount 
}) => (
    <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-100 space-y-4">
        <div className="relative group">
            <Search className="absolute right-4 top-4 h-6 w-6 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="🔍 ابحث في كامل المخزون..." 
                className="w-full pl-4 pr-14 py-4 text-xl border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white" 
            />
        </div>
        <div className="flex flex-wrap gap-3 items-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <select 
                value={warehouseFilter} 
                onChange={e => setWarehouseFilter(e.target.value)} 
                className="text-sm font-bold p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="ALL">كل المخازن</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button 
                onClick={() => setHideZero(!hideZero)} 
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${hideZero ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500'}`}
            >
                المتوفر فقط
            </button>
            <button 
                onClick={() => setShowLow(!showLow)} 
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${showLow ? 'bg-amber-500 text-white' : 'bg-white text-slate-500'}`}
            >
                نواقص
            </button>
            <div className="mr-auto text-xs font-bold text-slate-400">عرض {totalCount} صنف</div>
        </div>
    </div>
);

export default InventoryControls;
