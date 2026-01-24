import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArrowUpRight, ArrowDownLeft, X, Save, FileText, Wallet, Plus, Printer, Hash, Eye, CheckCircle } from 'lucide-react';
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
  const stats = useMemo(() => {
      const income = txs.filter(t => t.type === 'RECEIPT').reduce((sum, t) => sum + t.amount, 0);
      const expenses = txs.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      return { income, expenses, net: income - expenses };
  }, [txs]);

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
    setRelatedId('');
    setRelatedName('');
    setIsAddingCategory(false);
    setNewCategoryName('');
    setAmount('');
    setNotes('');
    if (isOpen) { setRefNumber(db.getNextTransactionRef(activeType)); }
  }, [activeType, isOpen]);

  const openModal = (type: CashTransactionType) => {
    setActiveType(type);
    setIsOpen(true);
    setShowPreview(false);
  };

  const handlePreview = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { alert(t('inv.total') + ' invalid'); return; }
    if (category === 'CUSTOMER_PAYMENT' && !relatedId) { alert(t('inv.select_customer')); return; }
    if (category === 'SUPPLIER_PAYMENT' && !relatedId) { alert(t('pur.select_supplier')); return; }
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
      const newTxData = {
          type: printTx.type,
          category: printTx.category,
          reference_id: printTx.reference_id,
          related_name: printTx.related_name,
          amount: printTx.amount,
          date: new Date().toISOString(),
          notes: printTx.notes,
          ref_number: refNumber
      };
      db.addCashTransaction(newTxData);
      const updatedTxs = db.getCashTransactions();
      setTxs(updatedTxs);
      const savedTx = updatedTxs[0]; 
      setPrintTx(savedTx);
      setTimeout(() => {
          window.print();
          setIsOpen(false);
          setShowPreview(false);
      }, 100);
  };

  const getFinancialPreview = () => {
      if (!printTx || !printTx.reference_id) return null;
      let prevBalance = 0;
      let finalBalance = 0;
      let entityName = '';
      if (printTx.category === 'CUSTOMER_PAYMENT') {
          const c = customers.find(x => x.id === printTx.reference_id);
          if (c) {
              entityName = c.name;
              prevBalance = c.current_balance;
              finalBalance = prevBalance - printTx.amount;
          }
      } else if (printTx.category === 'SUPPLIER_PAYMENT') {
          const s = suppliers.find(x => x.id === printTx.reference_id);
          if (s) {
              entityName = s.name;
              prevBalance = s.current_balance;
              finalBalance = prevBalance - printTx.amount;
          }
      } else { return null; }
      return { prevBalance, finalBalance, entityName };
  };

  const financialData = getFinancialPreview();
  const handleReprintHistory = (tx: CashTransaction) => { setPrintTx(tx); setShowPreview(true); };
  const customerOptions = useMemo(() => customers.map(c => ({ value: c.id, label: c.name, subLabel: `${currency}${c.current_balance}` })), [customers, currency]);
  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.name, subLabel: `${currency}${s.current_balance}` })), [suppliers, currency]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t('cash.title')}</h1>
        <div className="flex gap-2">
          <button onClick={() => openModal(CashTransactionType.RECEIPT)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"><ArrowDownLeft className="w-4 h-4" /> {t('cash.receipt')}</button>
          <button onClick={() => openModal(CashTransactionType.EXPENSE)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"><ArrowUpRight className="w-4 h-4" /> {t('cash.expense')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2"><ArrowDownLeft className="w-16 h-16 text-emerald-600" /></div>
               <div className="relative z-10"><p className="text-sm font-bold text-slate-500 uppercase">{t('cash.income')}</p><h3 className="text-2xl font-bold text-emerald-600 mt-2">{currency}{stats.income.toLocaleString()}</h3></div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2"><ArrowUpRight className="w-16 h-16 text-red-600" /></div>
               <div className="relative z-10"><p className="text-sm font-bold text-slate-500 uppercase">{t('cash.total_expenses')}</p><h3 className="text-2xl font-bold text-red-600 mt-2">{currency}{stats.expenses.toLocaleString()}</h3></div>
          </div>
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full mix-blend-overlay filter blur-2xl opacity-20 -mr-8 -mt-8"></div>
               <div className="relative z-10 flex justify-between items-center h-full"><div><p className="text-sm font-bold text-slate-400 uppercase">{t('cash.net')}</p><h3 className={`text-3xl font-bold mt-2 ${stats.net < 0 ? 'text-red-400' : 'text-blue-400'}`}>{currency}{stats.net.toLocaleString()}</h3></div><div className="p-3 bg-white/10 rounded-xl"><Wallet className="w-6 h-6 text-white" /></div></div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 text-gray-600 font-medium"><FileText className="w-4 h-4" /> {t('cash.history')}</div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[800px]">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr><th className="p-4 w-32">{t('common.date')}</th><th className="p-4">Ref No.</th><th className="p-4">{t('cash.category')}</th><th className="p-4">{t('cash.entity')}</th><th className="p-4">Note</th><th className="p-4 text-right rtl:text-left">{t('inv.total')}</th><th className="p-4 text-center w-20">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {txs.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 text-gray-500">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{tx.ref_number || '-'}</td>
                    <td className="p-4 font-medium text-gray-700">{t(`cat.${tx.category}`) !== `cat.${tx.category}` ? t(`cat.${tx.category}`) : tx.category.replace(/_/g, ' ')}</td>
                    <td className="p-4 text-gray-600 font-medium">{tx.related_name || '-'}</td>
                    <td className="p-4 text-gray-600">{tx.notes}</td>
                    <td className={`p-4 text-right rtl:text-left font-bold font-mono ${tx.type === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'}`}>{tx.type === 'RECEIPT' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}</td>
                    <td className="p-4 text-center"><button onClick={() => handleReprintHistory(tx)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors opacity-0 group-hover:opacity-100" title="Print Voucher"><Printer className="w-4 h-4" /></button></td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {isOpen && !showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className={`px-6 py-4 border-b flex justify-between items-center ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${activeType === CashTransactionType.RECEIPT ? 'text-emerald-800' : 'text-red-800'}`}><ArrowDownLeft className="w-5 h-5" />{activeType === CashTransactionType.RECEIPT ? t('cash.receipt') : t('cash.expense')}</h3>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label htmlFor="tx_ref_number" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Tracking / Ref No.</label>
                        <input id="tx_ref_number" name="tx_ref_number" className="w-full border p-2 rounded-lg font-mono text-sm bg-slate-50 focus:bg-white transition-colors focus:ring-2 focus:ring-blue-500 outline-none" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} placeholder="e.g. REC-001" />
                    </div>
                    <div>
                        <label htmlFor="tx_category_select" className="block text-sm font-medium text-gray-700 mb-1">{t('cash.category')}</label>
                        {activeType === CashTransactionType.EXPENSE ? (
                            <div className="flex gap-2">
                                {isAddingCategory ? (
                                    <div className="flex-1 flex items-center gap-2">
                                        <input id="new_tx_cat" name="new_tx_cat" className="w-full border p-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter new category name..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus />
                                        <button onClick={() => setIsAddingCategory(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <select id="tx_category_select" name="tx_category_select" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={category} onChange={(e) => setCategory(e.target.value as CashCategory)}>
                                            <option value="SUPPLIER_PAYMENT">{t('cat.SUPPLIER_PAYMENT')}</option>
                                            {categories.filter(c => c !== 'SUPPLIER_PAYMENT').map(c => (
                                                <option key={c} value={c}>{t(`cat.${c}`) !== `cat.${c}` ? t(`cat.${c}`) : c.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => { setIsAddingCategory(true); setNewCategoryName(''); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg border border-gray-300"><Plus className="w-5 h-5" /></button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <select id="tx_receipt_cat" name="tx_receipt_cat" className="w-full border p-2 rounded-lg" value={category} onChange={(e) => setCategory(e.target.value as CashCategory)}>
                                <option value="CUSTOMER_PAYMENT">{t('cat.CUSTOMER_PAYMENT')}</option>
                                <option value="PARTNER_CONTRIBUTION">{t('cat.PARTNER_CONTRIBUTION')}</option>
                                <option value="OTHER">{t('cat.OTHER')}</option>
                            </select>
                        )}
                    </div>
                    {category === 'CUSTOMER_PAYMENT' && ( <div><SearchableSelect id="cash_customer_select" name="cash_customer_select" label={t('inv.customer')} placeholder={t('inv.select_customer')} options={customerOptions} value={relatedId} onChange={setRelatedId} autoFocus={true} /></div> )}
                    {category === 'SUPPLIER_PAYMENT' && ( <div><SearchableSelect id="cash_supplier_select" name="cash_supplier_select" label={t('inv.supplier')} placeholder={t('pur.select_supplier')} options={supplierOptions} value={relatedId} onChange={setRelatedId} autoFocus={true} /></div> )}
                    {category !== 'CUSTOMER_PAYMENT' && category !== 'SUPPLIER_PAYMENT' && (
                        <div><label htmlFor="tx_related_name" className="block text-sm font-medium text-gray-700 mb-1">{t('cash.entity')}</label><input id="tx_related_name" name="tx_related_name" className="w-full border p-2 rounded-lg" placeholder={category === 'SALARY' ? 'Employee Name' : 'Name / Details'} value={relatedName} onChange={e => setRelatedName(e.target.value)} /></div>
                    )}
                    <div><label htmlFor="tx_amount" className="block text-sm font-medium text-gray-700 mb-1">{t('inv.total')} ({currency})</label><input id="tx_amount" name="tx_amount" type="number" className="w-full border p-2 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none border-gray-300" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                    <div><label htmlFor="tx_notes" className="block text-sm font-medium text-gray-700 mb-1">Note</label><textarea id="tx_notes" name="tx_notes" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300" rows={3} placeholder="Description..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
                    <div className="pt-2"><button onClick={handlePreview} className={`w-full py-3 text-white rounded-lg font-bold shadow-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-600' : 'bg-red-600'}`}><Eye className="w-5 h-5" />{activeType === CashTransactionType.RECEIPT ? 'معاينة الإيصال' : 'معاينة السند'}</button></div>
                </div>
            </div>
        </div>
      )}

      {showPreview && printTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[90vh]">
                  <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg flex items-center gap-2"><Eye className="w-5 h-5" /> معاينة الإيصال</h3><button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button></div>
                  <div className="flex-1 overflow-y-auto bg-gray-100 p-6 flex justify-center">
                      <div id="receipt-print-area" className="bg-white p-8 shadow-sm border border-gray-200 w-full max-w-sm text-sm relative" dir="rtl">
                          <div className="text-center border-b-2 border-black pb-4 mb-4"><h2 className="text-xl font-bold uppercase tracking-wide">{settings.companyName}</h2><p className="text-xs text-gray-500 mt-1">{settings.companyAddress}</p><p className="text-xs text-gray-500">{settings.companyPhone}</p></div>
                          <div className="flex justify-between items-center mb-4"><div className="text-center border border-black px-2 py-1 rounded"><span className="font-bold block text-xs">رقم السند</span><span className="font-mono text-sm">{refNumber || 'مسودة'}</span></div><div className="text-left"><div className="text-xs text-gray-500">التاريخ</div><div className="font-bold font-mono">{new Date().toLocaleDateString('en-GB')}</div></div></div>
                          <div className="mb-6 text-center"><span className="bg-black text-white px-4 py-1 font-bold rounded-full text-xs">{printTx.type === 'RECEIPT' ? 'سند قبض نقدية' : 'سند صرف نقدية'}</span></div>
                          <div className="space-y-4 mb-6"><div className="flex justify-between border-b border-dotted border-gray-400 pb-1"><span className="font-bold text-gray-600">{printTx.type === 'RECEIPT' ? 'استلمنا من' : 'صرفنا إلى'}</span><span className="font-bold text-lg">{printTx.related_name || printTx.category}</span></div><div className="flex justify-between border-b border-dotted border-gray-400 pb-1"><span className="font-bold text-gray-600">البند / التصنيف</span><span>{t(`cat.${printTx.category}`) !== `cat.${printTx.category}` ? t(`cat.${printTx.category}`) : printTx.category}</span></div>{printTx.notes && ( <div className="flex justify-between border-b border-dotted border-gray-400 pb-1"><span className="font-bold text-gray-600">وذلك عن</span><span className="text-left max-w-[60%]">{printTx.notes}</span></div> )}</div>
                          {financialData ? ( <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg space-y-2 mb-6"><div className="flex justify-between text-gray-600"><span>الرصيد السابق</span><span className="font-mono">{currency}{financialData.prevBalance.toLocaleString()}</span></div><div className="flex justify-between text-gray-600"><span>إجمالي المستحق</span><span className="font-mono">{currency}{financialData.prevBalance.toLocaleString()}</span></div><div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2"><span>المبلغ المدفوع</span><span>{currency}{printTx.amount.toLocaleString()}</span></div><div className="flex justify-between items-center border-t-2 border-black pt-2 mt-2"><span className="font-bold text-xs uppercase">الرصيد المتبقي</span><div className="text-left"><span className={`block font-bold text-lg ${financialData.finalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{currency}{Math.abs(financialData.finalBalance).toLocaleString()}</span><span className="text-[10px] text-gray-500 uppercase font-bold">{financialData.finalBalance > 0 ? 'مدين (عليه)' : financialData.finalBalance < 0 ? 'دائن (له)' : 'خالص'}</span></div></div></div> ) : ( <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-6 text-center"><div className="text-gray-500 text-xs uppercase mb-1">المبلغ</div><div className="text-2xl font-bold">{currency}{printTx.amount.toLocaleString()}</div></div> )}
                          <div className="flex justify-between mt-8 pt-4 border-t border-gray-300 text-xs text-center text-gray-500"><div className="w-1/3"><p className="mb-4">التوقيع / المدير</p><div className="border-b border-gray-400 h-4"></div></div><div className="w-1/3"><p className="mb-4">المستلم / الخزينة</p><div className="border-b border-gray-400 h-4"></div></div></div>
                      </div>
                  </div>
                  <div className="bg-white p-4 border-t flex gap-3 shrink-0"><button onClick={() => setShowPreview(false)} className="flex-1 py-3 text-slate-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition-colors">إغلاق</button><button onClick={handleExecute} className="flex-1 py-3 text-white bg-slate-900 hover:bg-slate-800 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition-all"><CheckCircle className="w-5 h-5" />تأكيد وطباعة</button></div>
              </div>
          </div>
      )}
      <style>{` @media print { body * { visibility: hidden; } #receipt-print-area, #receipt-print-area * { visibility: visible; } #receipt-print-area { position: absolute; left: 0; top: 0; width: 80mm; margin: 0 auto; box-shadow: none; border: none; direction: rtl; } .fixed { position: static !important; } .overflow-y-auto { overflow: visible !important; height: auto !important; } } `}</style>
    </div>
  );
}