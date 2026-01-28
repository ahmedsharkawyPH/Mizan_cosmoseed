
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { ArrowUpRight, ArrowDownLeft, X, FileText, Filter, Plus, Wallet, ChevronRight, ChevronLeft, Search, Hash, Calendar } from 'lucide-react';
import { CashTransactionType, CashTransaction } from '../types';
import SearchableSelect from '../components/SearchableSelect';

const ITEMS_PER_PAGE = 15;

interface DraftTransaction extends Omit<CashTransaction, 'id'> {
    isDraft: boolean;
}

export default function CashRegister() {
  const settings = db.getSettings();
  const currency = settings.currency;
  const [txs, setTxs] = useState(db.getCashTransactions());
  const [categories, setCategories] = useState<string[]>([]);
  
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

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

  // تصفية السجل ومنطق الصفحات
  const filteredTxs = useMemo(() => {
    return txs.filter(t => {
        const matchCategory = historyFilter === 'ALL' || t.category === historyFilter;
        const searchLower = searchTerm.toLowerCase();
        const matchSearch = t.related_name?.toLowerCase().includes(searchLower) || 
                            t.notes?.toLowerCase().includes(searchLower) ||
                            t.ref_number?.toLowerCase().includes(searchLower);
        return matchCategory && matchSearch;
    });
  }, [txs, historyFilter, searchTerm]);

  const totalPages = Math.ceil(filteredTxs.length / ITEMS_PER_PAGE);
  const paginatedTxs = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredTxs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTxs, currentPage]);

  useEffect(() => {
      setCurrentPage(1); // إعادة الترقيم عند التغيير في الفلاتر
  }, [historyFilter, searchTerm]);

  const getCategoryName = (cat: string) => {
      const map: any = {
          'CUSTOMER_PAYMENT': 'تحصيل من عميل',
          'SUPPLIER_PAYMENT': 'سداد لمورد',
          'COMMISSION': 'صرف عمولات',
          'SALARY': 'رواتب وأجور',
          'RENT': 'إيجارات',
          'ELECTRICITY': 'كهرباء ومرافق',
          'MARKETING': 'تسويق',
          'CAR': 'مصاريف سيارات',
          'OTHER': 'بنود أخرى'
      };
      return map[cat] || cat;
  };

  return (
    <div className="space-y-6 relative pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800">الخزينة والحسابات</h1>
            <p className="text-sm text-slate-400 font-bold mt-1">إدارة السيولة النقدية وسندات القبض والصرف</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => { setActiveType(CashTransactionType.RECEIPT); setIsOpen(true); }} 
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 font-black transition-all active:scale-95"
          >
            <ArrowDownLeft className="w-5 h-5" /> إنشاء سند قبض
          </button>
          <button 
            onClick={() => { setActiveType(CashTransactionType.EXPENSE); setIsOpen(true); }} 
            className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-100 font-black transition-all active:scale-95"
          >
            <ArrowUpRight className="w-5 h-5" /> إنشاء سند صرف
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
        <div className="p-6 border-b bg-slate-50/50 flex flex-col xl:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 text-slate-800 font-black">
                <FileText className="w-6 h-6 text-blue-600" /> 
                سجل حركات الخزينة
                <span className="text-[10px] bg-white px-2 py-1 rounded-lg border text-slate-400">{filteredTxs.length} حركة</span>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                <div className="relative w-full md:w-64 group">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="بحث في السجل..." 
                        className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm w-full md:w-auto">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <label htmlFor="history_filter_select" className="text-xs font-black text-slate-500 whitespace-nowrap">تصفية حسب البند:</label>
                    <select id="history_filter_select" name="history_filter" value={historyFilter} onChange={e => setHistoryFilter(e.target.value)} className="text-xs font-black outline-none bg-transparent cursor-pointer">
                        <option value="ALL">-- كل البنود --</option>
                        <option value="CUSTOMER_PAYMENT">تحصيل عملاء</option>
                        <option value="SUPPLIER_PAYMENT">سداد موردين</option>
                        <option value="COMMISSION">عمولات</option>
                        {categories.filter(c => !['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'COMMISSION'].includes(c)).map(c => (
                          <option key={c} value={c}>{getCategoryName(c)}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[800px]">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b">
                <tr>
                  <th className="px-6 py-4">تاريخ الحركة</th>
                  <th className="px-6 py-4">رقم السند</th>
                  <th className="px-6 py-4">البند</th>
                  <th className="px-6 py-4">الجهة / البيان</th>
                  <th className="px-6 py-4 text-left">القيمة</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
                {paginatedTxs.map(tx => (
                <tr key={tx.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-slate-500 text-xs">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-blue-600">{tx.ref_number || '-'}</td>
                    <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase">
                            {getCategoryName(tx.category)}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-slate-800">
                        {tx.related_name || '-'}
                        {tx.notes && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{tx.notes}</div>}
                    </td>
                    <td className={`px-6 py-4 text-left font-black text-base ${tx.type === 'RECEIPT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'RECEIPT' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}
                    </td>
                </tr>
                ))}
                {filteredTxs.length === 0 && (
                    <tr>
                        <td colSpan={5} className="p-20 text-center text-slate-300 font-black">
                            <Wallet className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            لا توجد حركات مطابقة للبحث
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>

        {/* أدوات التحكم في الصفحات */}
        {totalPages > 1 && (
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-4">
                <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
                
                <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = currentPage;
                        if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        if (pageNum <= 0 || pageNum > totalPages) return null;
                        return (
                            <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-10 h-10 rounded-xl font-black text-sm transition-all ${currentPage === pageNum ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all shadow-sm"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            </div>
        )}
      </div>

      {/* مودال إنشاء حركة جديدة */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
                <div className={`px-8 py-6 border-b flex justify-between items-center ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    <h3 className={`font-black text-lg flex items-center gap-3 ${activeType === CashTransactionType.RECEIPT ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {activeType === CashTransactionType.RECEIPT ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                        {activeType === CashTransactionType.RECEIPT ? 'إصدار سند قبض نقدية' : 'إصدار سند صرف نقدية'}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/50 rounded-full text-slate-400 hover:text-slate-600 transition-all shadow-sm"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم السند المرجعي</span>
                        <span className="font-mono font-black text-blue-600">{refNumber}</span>
                    </div>

                    <div>
                        <label htmlFor="category_selector" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">تصنيف البند</label>
                        {activeType === CashTransactionType.EXPENSE ? (
                            <div className="flex gap-2">
                                {isAddingCategory ? (
                                    <div className="flex-1 flex items-center gap-2">
                                      <input id="new_cat_name" name="new_category" className="w-full border-2 border-blue-100 p-2.5 rounded-xl font-bold focus:border-blue-500 outline-none" placeholder="اسم البند الجديد" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus />
                                      <button onClick={() => setIsAddingCategory(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button>
                                    </div>
                                ) : (
                                    <>
                                      <select id="category_selector" name="category" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-black focus:border-rose-500 outline-none cursor-pointer" value={category} onChange={(e) => setCategory(e.target.value)}>
                                          <option value="SUPPLIER_PAYMENT">سداد لمورد</option>
                                          <option value="CAR">مصاريف سيارات</option>
                                          <option value="RENT">إيجارات</option>
                                          <option value="ELECTRICITY">كهرباء ومرافق</option>
                                          <option value="SALARY">رواتب وأجور</option>
                                          <option value="COMMISSION">صرف عمولات</option>
                                          <option value="OTHER">أخرى / متنوعة</option>
                                          {categories.filter(c => !['SUPPLIER_PAYMENT','CAR','RENT','ELECTRICITY','SALARY','COMMISSION','OTHER'].includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                      <button onClick={() => setIsAddingCategory(true)} className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-600 transition-all" title="إضافة بند جديد"><Plus className="w-6 h-6" /></button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <select id="category_selector" name="category" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-black focus:border-emerald-500 outline-none cursor-pointer" value={category} onChange={(e) => setCategory(e.target.value)}>
                                <option value="CUSTOMER_PAYMENT">تحصيل من عميل</option>
                                <option value="PARTNER_CONTRIBUTION">زيادة رأس مال</option>
                                <option value="OTHER">مقبوضات متنوعة</option>
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
                        label="البحث عن العميل المستهدف" 
                      />
                    )}
                    
                    {category === 'SUPPLIER_PAYMENT' && (
                      <SearchableSelect 
                        id="tx_supplier_select"
                        name="related_id"
                        options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.phone }))} 
                        value={relatedId} 
                        onChange={setRelatedId} 
                        label="البحث عن المورد المستهدف" 
                      />
                    )}
                    
                    {!['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT'].includes(category) && (
                        <div>
                          <label htmlFor="related_name_input" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">الجهة المستفيدة / البيان</label>
                          <input id="related_name_input" name="related_name" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold focus:border-blue-500 outline-none" placeholder="اسم الجهة أو الموظف..." value={relatedName} onChange={e => setRelatedName(e.target.value)} />
                        </div>
                    )}
                    
                    <div>
                      <label htmlFor="tx_amount_input" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">القيمة النقدية ({currency})</label>
                      <input id="tx_amount_input" name="amount" type="number" className="w-full border-2 border-blue-100 p-4 rounded-2xl text-3xl font-black text-blue-600 bg-blue-50/20 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-center" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                    
                    <div>
                      <label htmlFor="tx_notes_input" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">ملاحظات إضافية</label>
                      <textarea id="tx_notes_input" name="notes" className="w-full border-2 border-slate-100 p-3 rounded-2xl text-sm font-bold focus:border-blue-500 outline-none" rows={2} placeholder="اكتب تفاصيل إضافية هنا..." value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    
                    <button 
                      onClick={handlePreview} 
                      className={`w-full py-5 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}
                    >
                      مراجعة وحفظ السند
                    </button>
                </div>
            </div>
        </div>
      )}

      {showPreview && printTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-200 border border-slate-100">
                  <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${printTx.type === 'RECEIPT' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      <Wallet className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black mb-2 text-slate-800">تأكيد العملية</h3>
                  <p className="text-sm text-slate-400 font-bold mb-6 italic">يرجى مراجعة البيانات قبل الحفظ النهائي في السجل</p>
                  
                  <div className="bg-slate-50 p-6 rounded-[1.5rem] mb-8 text-right space-y-4 shadow-inner border border-slate-100">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-slate-400 font-black text-[10px] uppercase">نوع السند</span>
                        <span className={`font-black ${printTx.type === 'RECEIPT' ? 'text-emerald-600' : 'text-rose-600'}`}>{printTx.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-slate-400 font-black text-[10px] uppercase">البند</span>
                        <span className="font-black text-blue-600">{getCategoryName(printTx.category)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-slate-400 font-black text-[10px] uppercase">الجهة</span>
                        <span className="font-black text-slate-700 truncate max-w-[150px]">{printTx.related_name || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-slate-400 font-black text-[10px] uppercase">المبلغ</span>
                        <span className="text-3xl font-black text-slate-900">{currency}{printTx.amount.toLocaleString()}</span>
                      </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button onClick={() => setShowPreview(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all">تراجع</button>
                    <button onClick={handleExecute} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-blue-600 transition-all shadow-xl shadow-slate-200">تأكيد وحفظ</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
