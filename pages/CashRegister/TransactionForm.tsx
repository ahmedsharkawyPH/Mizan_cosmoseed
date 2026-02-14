
import React, { useReducer, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { CashTransactionType } from '../../types';
import { X, Wallet, ArrowDownLeft, ArrowUpRight, Printer, Save, Plus } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';
// @ts-ignore
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    activeType: CashTransactionType;
    onSuccess: (tx: any) => void;
}

type Action = 
  | { type: 'SET_FIELD', field: string, value: any }
  | { type: 'RESET', initialType: CashTransactionType };

const reducer = (state: any, action: Action) => {
    switch (action.type) {
        case 'SET_FIELD': return { ...state, [action.field]: action.value };
        case 'RESET': return { 
            amount: '', category: action.initialType === CashTransactionType.RECEIPT ? 'CUSTOMER_PAYMENT' : 'SUPPLIER_PAYMENT', 
            relatedId: '', relatedName: '', notes: '', isAddingCat: false, newCatName: '' 
        };
        default: return state;
    }
};

const TransactionForm: React.FC<Props> = ({ isOpen, onClose, activeType, onSuccess }) => {
    const { customers, suppliers, addTransaction, settings } = useData();
    const [state, dispatch] = useReducer(reducer, {
        amount: '', category: activeType === CashTransactionType.RECEIPT ? 'CUSTOMER_PAYMENT' : 'SUPPLIER_PAYMENT',
        relatedId: '', relatedName: '', notes: '', isAddingCat: false, newCatName: ''
    });

    useEffect(() => { dispatch({ type: 'RESET', initialType: activeType }); }, [activeType, isOpen]);

    const entityOptions = useMemo(() => {
        if (state.category === 'CUSTOMER_PAYMENT') return customers.map(c => ({ value: c.id, label: c.name, subLabel: c.phone }));
        if (state.category === 'SUPPLIER_PAYMENT') return suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }));
        return [];
    }, [state.category, customers, suppliers]);

    const handleSave = async (shouldPrint: boolean) => {
        const val = parseFloat(state.amount);
        if (!state.amount || isNaN(val) || val <= 0) return toast.error('يرجى إدخال مبلغ صحيح');

        let finalName = state.relatedName;
        if (state.category === 'CUSTOMER_PAYMENT') finalName = customers.find(c => c.id === state.relatedId)?.name || '';
        if (state.category === 'SUPPLIER_PAYMENT') finalName = suppliers.find(s => s.id === state.relatedId)?.name || '';

        const txPayload = {
            type: activeType,
            category: state.category,
            amount: val,
            reference_id: state.relatedId,
            related_name: finalName,
            notes: state.notes,
            date: new Date().toISOString()
        };

        const result = await addTransaction(txPayload);
        if (result.success) {
            toast.success("تم حفظ السند بنجاح");
            onSuccess({ ...txPayload, _shouldPrint: shouldPrint });
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in no-print">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                <div className={`px-8 py-6 border-b flex justify-between items-center ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    <h3 className="font-black text-lg flex items-center gap-3">
                        {activeType === CashTransactionType.RECEIPT ? <ArrowDownLeft className="w-6 h-6 text-emerald-600" /> : <ArrowUpRight className="w-6 h-6 text-rose-600" />}
                        {activeType === CashTransactionType.RECEIPT ? 'سند قبض نقدية' : 'سند صرف نقدية'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">تصنيف الحركة</label>
                        <select className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-black outline-none focus:border-blue-500" value={state.category} onChange={e => dispatch({type: 'SET_FIELD', field: 'category', value: e.target.value})}>
                            {activeType === CashTransactionType.RECEIPT ? (
                                <>
                                    <option value="CUSTOMER_PAYMENT">تحصيل من عميل</option>
                                    <option value="OTHER">مقبوضات متنوعة</option>
                                </>
                            ) : (
                                <>
                                    <option value="SUPPLIER_PAYMENT">سداد لمورد</option>
                                    <option value="SALARY">رواتب وأجور</option>
                                    <option value="RENT">إيجارات</option>
                                    <option value="OTHER">مصاريف أخرى</option>
                                </>
                            )}
                        </select>
                    </div>

                    {(state.category === 'CUSTOMER_PAYMENT' || state.category === 'SUPPLIER_PAYMENT') && (
                        <SearchableSelect 
                            label={state.category === 'CUSTOMER_PAYMENT' ? "ابحث عن العميل" : "ابحث عن المورد"}
                            options={entityOptions} 
                            value={state.relatedId} 
                            onChange={val => dispatch({type: 'SET_FIELD', field: 'relatedId', value: val})} 
                        />
                    )}

                    {!['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT'].includes(state.category) && (
                        <input className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold outline-none focus:border-blue-500" placeholder="اسم الجهة أو البيان..." value={state.relatedName} onChange={e => dispatch({type: 'SET_FIELD', field: 'relatedName', value: e.target.value})} />
                    )}

                    <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100">
                        <label className="block text-[10px] font-black text-blue-400 uppercase mb-2">المبلغ ({settings.currency})</label>
                        <input type="number" className="w-full bg-transparent border-none p-0 text-4xl font-black text-blue-600 outline-none placeholder-blue-200" placeholder="0.00" value={state.amount} onChange={e => dispatch({type: 'SET_FIELD', field: 'amount', value: e.target.value})} autoFocus />
                    </div>

                    <textarea className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" rows={2} placeholder="ملاحظات اختيارية..." value={state.notes} onChange={e => dispatch({type: 'SET_FIELD', field: 'notes', value: e.target.value})} />
                    
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <button onClick={() => handleSave(false)} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95">حفظ فقط</button>
                        <button onClick={() => handleSave(true)} className="py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> حفظ وطباعة</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionForm;
