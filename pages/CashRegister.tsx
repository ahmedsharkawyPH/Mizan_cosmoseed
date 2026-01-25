import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArrowUpRight, ArrowDownLeft, X, Save, FileText, Wallet, Plus, Printer, Hash, Eye, CheckCircle, Filter } from 'lucide-react';
import { CashTransactionType, CashCategory, CashTransaction } from '../types';
import SearchableSelect from '../components/SearchableSelect';

interface DraftTransaction extends Omit<CashTransaction, 'id'> {
    isDraft: boolean;
}

export default function CashRegister() {
  const settings = db.getSettings();
  const currency = settings.currency;
  const [txs, setTxs] = useState(db.getCashTransactions());
  const [categories, setCategories] = useState<string[]>([]);
  
  // History Filter
  const [historyFilter, setHistoryFilter] = useState('ALL');

  const stats = useMemo(() => {
      const filtered = historyFilter === 'ALL' ? txs : txs.filter(t => t.category === historyFilter);
      const income = filtered.filter(t => t.type === 'RECEIPT').reduce((sum, t) => sum + t.amount, 0);
      const expenses = filtered.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      return { income, expenses, net: income - expenses };
  }, [txs, historyFilter]);

  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeType, setActiveType] = useState<CashTransactionType>(CashTransactionType.RECEIPT);
  const [printTx, setPrintTx] = useState<CashTransaction | DraftTransaction | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CashCategory>('OTHER');
  const [relatedId, setRelatedId] = useState('');
  const [relatedName, setRelatedName] = useState('');
  const [notes, setNotes] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const customers = db.getCustomers();
  const suppliers = db.getSuppliers();

  useEffect(() => {
    const settings = db.getSettings();
    setCategories(settings.expenseCategories);
    if (activeType === CashTransactionType.RECEIPT) setCategory('CUSTOMER_PAYMENT');
    else setCategory('SUPPLIER_PAYMENT');
    setRelatedId(''); setRelatedName(''); setIsAddingCategory(false); setNewCategoryName(''); setAmount(''); setNotes('');
    if (isOpen) setRefNumber(db.getNextTransactionRef(activeType));
  }, [activeType, isOpen]);

  const handlePreview = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { alert('Invalid Amount'); return; }
    let finalName = relatedName;
    if (category === 'CUSTOMER_PAYMENT') finalName = customers.find(c => c.id === relatedId)?.name || '';
    if (category === 'SUPPLIER_PAYMENT') finalName = suppliers.find(s => s.id === relatedId)?.name || '';
    let finalCategory = category;
    if (activeType === CashTransactionType.EXPENSE && isAddingCategory && newCategoryName.trim()) {
        finalCategory = newCategoryName.trim().toUpperCase().replace(/\s+/g, '_');
    }
    const draft: DraftTransaction = { isDraft: true, type: activeType, category: finalCategory, reference_id: relatedId, related_name: finalName, amount: val, date: new Date().toISOString(), notes: notes, ref_number: refNumber || 'DRAFT' };
    setPrintTx(draft); setShowPreview(true);
  };

  const handleExecute = () => {
      if (!printTx) return;
      if (activeType === CashTransactionType.EXPENSE && isAddingCategory && newCategoryName.trim()) db.addExpenseCategory(printTx.category);
      db.addCashTransaction({ type: printTx.type, category: printTx.category, reference_id: printTx.reference_id, related_name: printTx.related_name, amount: printTx.amount, date: new Date().toISOString(), notes: printTx.notes, ref_number: refNumber });
      setTxs(db.getCashTransactions());
      setIsOpen(false); setShowPreview(false);
  };

  const filteredTxs = useMemo(() => historyFilter === 'ALL' ? txs : txs.filter(t => t.category === historyFilter), [txs, historyFilter]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t('cash.title')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setActiveType(CashTransactionType.RECEIPT) || setIsOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"><ArrowDownLeft className="w-4 h-4" /> {t('cash.receipt')}</button>
          <button onClick={() => setActiveType(CashTransactionType.EXPENSE) || setIsOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"><ArrowUpRight className="w-4 h-4" /> {t('cash.expense')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <p className="text-sm font-bold text-slate-500 uppercase">{historyFilter === 'ALL' ? t('cash.income') : 'مقبوضات البند'}</p>
               <h3 className="text-2xl font-bold text-emerald-600 mt-2">{currency}{stats.income.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <p className="text-sm font-bold text-slate-500 uppercase">{historyFilter === 'ALL' ? t('cash.total_expenses') : 'مصروفات البند'}</p>
               <h3 className="text-2xl font-bold text-red-600 mt-2">{currency}{stats.expenses.toLocaleString()}</h3>
          </div>
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
               <p className="text-sm font-bold text-slate-400 uppercase">الصافي حسب التصفية</p>
               <h3 className={`text-3xl font-bold mt-2 ${stats.net < 0 ? 'text-red-400' : 'text-blue-400'}`}>{currency}{stats.net.toLocaleString()}</h3>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600 font-medium"><FileText className="w-4 h-4" /> {t('cash.history')}</div>
            <div className="flex items-center gap-2 bg-white border px-3 py-1.5 rounded-xl shadow-inner">
                <Filter className="w-3 h-3 text-slate-400" />
                <label className="text-xs font-bold text-slate-500">{t('cash.filter_category')}:</label>
                <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value)} className="text-xs font-black outline-none bg-transparent">
                    <option value="ALL">-- كل البنود --</option>
                    <option value="CUSTOMER_PAYMENT">تحصيل عملاء</option>
                    <option value="SUPPLIER_PAYMENT">سداد موردين</option>
                    {categories.map(c => <option key={c} value={c}>{t(`cat.${c}`) !== `cat.${c}` ? t(`cat.${c}`) : c}</option>)}
                </select>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr><th className="p-4 w-32">{t('common.date')}</th><th className="p-4">Ref No.</th><th className="p-4">{t('cash.category')}</th><th className="p-4">{t('cash.entity')}</th><th className="p-4 text-right rtl:text-left">{t('inv.total')}</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredTxs.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-500">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{tx.ref_number || '-'}</td>
                    <td className="p-4 font-bold text-gray-700">{t(`cat.${tx.category}`) !== `cat.${tx.category}` ? t(`cat.${tx.category}`) : tx.category}</td>
                    <td className="p-4 text-gray-600">{tx.related_name || '-'}</td>
                    <td className={`p-4 text-right rtl:text-left font-black ${tx.type === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'}`}>{tx.type === 'RECEIPT' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}</td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className={`px-6 py-4 border-b flex justify-between items-center ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${activeType === CashTransactionType.RECEIPT ? 'text-emerald-800' : 'text-red-800'}`}><ArrowDownLeft className="w-5 h-5" />{activeType === CashTransactionType.RECEIPT ? t('cash.receipt') : t('cash.expense')}</h3>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('cash.category')}</label>
                        {activeType === CashTransactionType.EXPENSE ? (
                            <div className="flex gap-2">
                                {isAddingCategory ? (
                                    <div className="flex-1 flex items-center gap-2"><input className="w-full border p-2 rounded-lg" placeholder="اسم البند الجديد" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus /><button onClick={() => setIsAddingCategory(false)} className="p-2 text-gray-400"><X className="w-4 h-4" /></button></div>
                                ) : (
                                    <><select className="w-full border p-2 rounded-lg" value={category} onChange={(e) => setCategory(e.target.value as CashCategory)}>
                                        <option value="SUPPLIER_PAYMENT">سداد موردين</option>
                                        <option value="CAR">مصاريف عربية</option>
                                        <option value="RENT">إيجار</option>
                                        <option value="ELECTRICITY">كهرباء</option>
                                        <option value="SALARY">مرتبات</option>
                                        <option value="COMMISSION">عمولات</option>
                                        {categories.filter(c => !['SUPPLIER_PAYMENT','CAR','RENT','ELECTRICITY','SALARY','COMMISSION'].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select><button onClick={() => setIsAddingCategory(true)} className="bg-slate-100 p-2 rounded-lg border"><Plus className="w-5 h-5" /></button></>
                                )}
                            </div>
                        ) : (
                            <select className="w-full border p-2 rounded-lg" value={category} onChange={(e) => setCategory(e.target.value as CashCategory)}>
                                <option value="CUSTOMER_PAYMENT">تحصيل عملاء</option>
                                <option value="PARTNER_CONTRIBUTION">إيداع شريك</option>
                                <option value="OTHER">أخرى</option>
                            </select>
                        )}
                    </div>
                    {category === 'CUSTOMER_PAYMENT' && ( <SearchableSelect options={customers.map(c=>({value:c.id,label:c.name}))} value={relatedId} onChange={setRelatedId} label="اختر العميل" /> )}
                    {category === 'SUPPLIER_PAYMENT' && ( <SearchableSelect options={suppliers.map(s=>({value:s.id,label:s.name}))} value={relatedId} onChange={setRelatedId} label="اختر المورد" /> )}
                    {category !== 'CUSTOMER_PAYMENT' && category !== 'SUPPLIER_PAYMENT' && (
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">البيان / المستلم</label><input className="w-full border p-2 rounded-lg" placeholder="اسم الجهة أو تفاصيل إضافية" value={relatedName} onChange={e => setRelatedName(e.target.value)} /></div>
                    )}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">المبلغ ({currency})</label><input type="number" className="w-full border p-2 rounded-lg text-lg font-black text-blue-600" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label><textarea className="w-full border p-2 rounded-lg" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
                    <button onClick={handlePreview} className={`w-full py-3 text-white rounded-lg font-bold shadow-md ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-600' : 'bg-red-600'}`}>معاينة وحفظ</button>
                </div>
            </div>
        </div>
      )}

      {showPreview && printTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
                  <h3 className="text-xl font-black mb-4">تأكيد العملية</h3>
                  <p className="text-sm text-slate-500 mb-6">هل أنت متأكد من تسجيل {printTx.type === 'RECEIPT' ? 'مقبوضات' : 'مصروفات'} بقيمة <span className="text-blue-600 font-bold">{currency}{printTx.amount}</span> لبند {printTx.category}؟</p>
                  <div className="flex gap-2"><button onClick={() => setShowPreview(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold">إلغاء</button><button onClick={handleExecute} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold">تأكيد</button></div>
              </div>
          </div>
      )}
    </div>
  );
}