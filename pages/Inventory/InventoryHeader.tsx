
import React from 'react';
import { Package, FileText, FileSpreadsheet, PlusCircle } from 'lucide-react';
import { t } from '../../utils/t';

interface Props {
    onExportPdf: () => void;
    onExportExcel: () => void;
    onAddNew: () => void;
}

const InventoryHeader: React.FC<Props> = ({ onExportPdf, onExportExcel, onAddNew }) => (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" /> {t('stock.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
            <button onClick={onExportPdf} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-red-700 transition-all active:scale-95">
                <FileText className="w-5 h-5" /> PDF
            </button>
            <button onClick={onExportExcel} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95">
                <FileSpreadsheet className="w-5 h-5" /> Excel
            </button>
            <button onClick={onAddNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                <PlusCircle className="w-5 h-5" /> {t('stock.new')}
            </button>
        </div>
    </div>
);

export default InventoryHeader;
