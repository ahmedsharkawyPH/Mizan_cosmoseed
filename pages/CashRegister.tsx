import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArrowUpRight, ArrowDownLeft, X, FileText, Filter, Plus, Wallet } from 'lucide-react';
import { CashTransactionType, CashTransaction } from '../types';
import SearchableSelect from '../components/SearchableSelect';

interface DraftTransaction extends Omit<CashTransaction, 'id'> {
    isDraft: boolean;
}

export default function CashRegister() {
  const settings = db.getSettings();
  const currency = settings.currency;
  const [txs, setTxs] = useState(db.getCashTransactions());
  const [categories, setCategories] = useState<string[]>([]);
  
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
  const [printTx, setPrintTx] = useState<DraftTransaction | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('OTHER');
  const [relatedId, setRelatedId] = useState('');
  const [relatedName, setRelatedName] = useState('');
  const [notes, setNotes] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const customers = db.getCustomers();
  const suppliers = db.getSuppliers();

  useEffect(() => {
    const s = db.getSettings();
    setCategories(s.expenseCategories || []);
    
    if (activeType === CashTransactionType.RECEIPT) {
      setCategory('CUSTOMER_PAYMENT');
    } else {
      setCategory('SUPPLIER_PAYMENT');
    }
    
    setRelatedId(''); 
    setRelatedName(''); 
    setIsAddingCategory(false); 
    setNewCategoryName(''); 
    setAmount(''); 
    setNotes('');
    
    if (isOpen) {
      setRefNumber(db.getNextTransactionRef(activeType));
    }
  }, [activeType, isOpen]);

  const handlePreview = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    let finalName = relatedName;
    if (category === 'CUSTOMER_PAYMENT') finalName = customers.find(c => c.id === relatedId)?.name || '';
    if (category === 'SUPPLIER_PAYMENT') finalName = suppliers.find(s => s.id === relatedId)?.name || '';

    let finalCategory = category;
    if (activeType === CashTransactionType.EXPENSE && isAddingCategory && newCategoryName.trim()) {
        finalCategory = newCategoryName.trim().toUpperCase().replace(/\s+/g, '_');
    }

    const draft: DraftTransaction = { 
      isDraft: true, 
      type: activeType, 
      category: finalCategory, 
      reference_id: relatedId, 
      related_name: finalName, 
      amount: val, 
      date: new Date().toISOString(), 
      notes: notes, 
      ref_number: refNumber || 'DRAFT' 
    };

    setPrintTx(draft); 
    setShowPreview(true);
  };

  const handleExecute = () => {
      if (!printTx) return;
      if (activeType === CashTransactionType.EXPENSE && isAddingCategory && newCategoryName.trim()) {
        db.addExpenseCategory(printTx.category);
      }
      
      db.addCashTransaction({ 
        type: printTx.type, 
        category: printTx.category, 
        reference_id: printTx.reference_id, 
        related_name: printTx.related_name, 
        amount: printTx.amount, 
        date: new Date().toISOString(), 
        notes: printTx.notes, 
        ref_number: refNumber 
      });
      
      setTxs(db.getCashTransactions());
      setIsOpen(false); 
      setShowPreview(false);
  };

  const filteredTxs = useMemo(() => 
    historyFilter === 'ALL' ? txs : txs.filter(t => t.category === historyFilter)
  , [txs, historyFilter]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t('cash.title')}</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => { setActiveType(CashTransactionType.RECEIPT); setIsOpen(true); }} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"
          >
            <ArrowDownLeft className="w-4 h-4" /> {t('cash.receipt')}
          </button>
          <button 
            onClick={() => { setActiveType(CashTransactionType.EXPENSE); setIsOpen(true); }} 
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"
          >
            <ArrowUpRight className="w-4 h-4" /> {t('cash.expense')}
          </button>
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
                <label htmlFor="history_filter_select" className="text-xs font-bold text-slate-500">{t('cash.filter_category')}:</label>
                <select id="history_filter_select" name="history_filter" value={historyFilter} onChange={e => setHistoryFilter(e.target.value)} className="text-xs font-black outline-none bg-transparent">
                    <option value="ALL">-- كل البنود --</option>
                    <option value="CUSTOMER_PAYMENT">{t('cat.CUSTOMER_PAYMENT')}</option>
                    <option value="SUPPLIER_PAYMENT">{t('cat.SUPPLIER_PAYMENT')}</option>
                    <option value="COMMISSION">{t('cat.COMMISSION')}</option>
                    {categories.filter(c => !['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'COMMISSION'].includes(c)).map(c => (
                      <option key={c} value={c}>{t(`cat.${c}`) !== `cat.${c}` ? t(`cat.${c}`) : c}</option>
                    ))}
                </select>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-4 w-32">{t('common.date')}</th>
                  <th className="p-4">Ref No.</th>
                  <th className="p-4">{t('cash.category')}</th>
                  <th className="p-4">{t('cash.entity')}</th>
                  <th className="p-4 text-right">{t('inv.total')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredTxs.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors text-right">
                    <td className="p-4 text-gray-500 text-xs">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="p-4 font-mono text-[10px] text-slate-500">{tx.ref_number || '-'}</td>
                    <td className="p-4 font-bold text-gray-700">{t(`cat.${tx.category}`) !== `cat.${tx.category}` ? t(`cat.${tx.category}`) : tx.category}</td>
                    <td className="p-4 text-gray-600 font-medium">{tx.related_name || '-'}</td>
                    <td className={`p-4 text-left font-black ${tx.type === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'}`}>{tx.type === 'RECEIPT' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}</td>
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
                        <label htmlFor="category_selector" className="block text-sm font-bold text-gray-700 mb-1">{t('cash.category')}</label>
                        {activeType === CashTransactionType.EXPENSE ? (
                            <div className="flex gap-2">
                                {isAddingCategory ? (
                                    <div className="flex-1 flex items-center gap-2">
                                      <input id="new_cat_name" name="new_category" className="w-full border p-2 rounded-lg" placeholder="اسم البند الجديد" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus />
                                      <button onClick={() => setIsAddingCategory(false)} className="p-2 text-gray-400"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                      <select id="category_selector" name="category" className="w-full border p-2 rounded-lg font-bold" value={category} onChange={(e) => setCategory(e.target.value)}>
                                          <option value="SUPPLIER_PAYMENT">{t('cat.SUPPLIER_PAYMENT')}</option>
                                          <option value="CAR">{t('cat.CAR')}</option>
                                          <option value="RENT">{t('cat.RENT')}</option>
                                          <option value="ELECTRICITY">{t('cat.ELECTRICITY')}</option>
                                          <option value="SALARY">{t('cat.SALARY')}</option>
                                          <option value="COMMISSION">{t('cat.COMMISSION')}</option>
                                          <option value="OTHER">{t('cat.OTHER')}</option>
                                          {categories.filter(c => !['SUPPLIER_PAYMENT','CAR','RENT','ELECTRICITY','SALARY','COMMISSION','OTHER'].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                      <button onClick={() => setIsAddingCategory(true)} className="bg-slate-100 p-2 rounded-lg border hover:bg-slate-200" title="إضافة بند جديد"><Plus className="w-5 h-5" /></button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <select id="category_selector" name="category" className="w-full border p-2 rounded-lg font-bold" value={category} onChange={(e) => setCategory(e.target.value)}>
                                <option value="CUSTOMER_PAYMENT">{t('cat.CUSTOMER_PAYMENT')}</option>
                                <option value="PARTNER_CONTRIBUTION">{t('cat.PARTNER_CONTRIBUTION')}</option>
                                <option value="OTHER">{t('cat.OTHER')}</option>
                            </select>
                        )}
                    </div>
                    
                    {category === 'CUSTOMER_PAYMENT' && (
                      <SearchableSelect 
                        id="tx_customer_select"
                        name="related_id"
                        options={customers.map(c => ({ value: c.id, label: c.name, subLabel: c.phone }))} 
                        value={relatedId} 
                        onChange={setRelatedId} 
                        label="اختر العميل" 
                      />
                    )}
                    
                    {category === 'SUPPLIER_PAYMENT' && (
                      <SearchableSelect 
                        id="tx_supplier_select"
                        name="related_id"
                        options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))} 
                        value={relatedId} 
                        onChange={setRelatedId} 
                        label="اختر المورد" 
                      />
                    )}
                    
                    {!['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT'].includes(category) && (
                        <div>
                          <label htmlFor="related_name_input" className="block text-sm font-bold text-gray-700 mb-1">البيان / المستلم</label>
                          <input id="related_name_input" name="related_name" className="w-full border p-2 rounded-lg" placeholder="اسم الجهة أو تفاصيل إضافية" value={relatedName} onChange={e => setRelatedName(e.target.value)} />
                        </div>
                    )}
                    
                    <div>
                      <label htmlFor="tx_amount_input" className="block text-sm font-bold text-gray-700 mb-1">المبلغ ({currency})</label>
                      <input id="tx_amount_input" name="amount" type="number" className="w-full border p-2 rounded-lg text-lg font-black text-blue-600 bg-blue-50/20" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                    
                    <div>
                      <label htmlFor="tx_notes_input" className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                      <textarea id="tx_notes_input" name="notes" className="w-full border p-2 rounded-lg text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    
                    <button 
                      onClick={handlePreview} 
                      className={`w-full py-4 text-white rounded-xl font-black shadow-lg transition-all active:scale-95 ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      معاينة وحفظ العملية
                    </button>
                </div>
            </div>
        </div>
      )}

      {showPreview && printTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in duration-200">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${printTx.type === 'RECEIPT' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      <Wallet className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black mb-2 text-slate-800">تأكيد العملية</h3>
                  <div className="bg-slate-50 p-4 rounded-xl mb-6 text-right space-y-2">
                      <div className="flex justify-between border-b pb-1 border-slate-200"><span className="text-slate-400 font-bold text-xs">النوع:</span><span className="font-bold">{printTx.type === 'RECEIPT' ? 'مقبوضات' : 'مصروفات'}</span></div>
                      <div className="flex justify-between border-b pb-1 border-slate-200"><span className="text-slate-400 font-bold text-xs">البند:</span><span className="font-bold text-blue-600">{t(`cat.${printTx.category}`) !== `cat.${printTx.category}` ? t(`cat.${printTx.category}`) : printTx.category}</span></div>
                      <div className="flex justify-between border-b pb-1 border-slate-200"><span className="text-slate-400 font-bold text-xs">الجهة:</span><span className="font-bold">{printTx.related_name || '-'}</span></div>
                      <div className="flex justify-between pt-1"><span className="text-slate-400 font-bold text-xs">المبلغ:</span><span className="text-xl font-black text-slate-900">{currency}{printTx.amount.toLocaleString()}</span></div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowPreview(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">إلغاء</button>
                    <button onClick={handleExecute} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">تأكيد الحفظ</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}