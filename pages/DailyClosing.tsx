import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { 
  ClipboardCheck, Calendar, ArrowDownCircle, ArrowUpCircle, 
  Wallet, Save, History, Printer, CheckCircle2, AlertTriangle, 
  Search, FileText
} from 'lucide-react';
// @ts-ignore
import toast from 'react-hot-toast';

export default function DailyClosing() {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualCash, setActualCash] = useState<number>(0);
  const [bankBalance, setBankBalance] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const user = authService.getCurrentUser();
  const currency = db.getSettings().currency;

  const summary = useMemo(() => db.getDailySummary(targetDate), [targetDate]);
  const history = useMemo(() => db.getDailyClosings(), [isSaving]);

  const difference = actualCash - summary.expectedCash;

  const handleSave = async () => {
    if (!confirm("هل أنت متأكد من حفظ تقفيل اليوم؟")) return;
    
    setIsSaving(true);
    const success = await db.saveDailyClosing({
      date: targetDate,
      total_sales: summary.cashSales,
      total_expenses: summary.expenses + summary.cashPurchases,
      cash_balance: actualCash,
      bank_balance: bankBalance,
      inventory_value: summary.inventoryValue,
      notes: notes,
      closed_by: user?.name || 'Unknown'
    });

    if (success) {
      toast.success("تم حفظ التقفيل بنجاح");
      setActiveTab('HISTORY');
    } else {
      toast.error("فشل حفظ التقفيل في السحابة");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-blue-600" />
            تقفيل الخزينة اليومي
          </h1>
          <p className="text-sm text-slate-500 mt-1">تسوية نقدية الخزينة ومطابقة الرصيد الدفتري والفعلي</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            id="tab_new_closing"
            name="tab_new_closing"
            onClick={() => setActiveTab('NEW')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'NEW' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            تقفيل جديد
          </button>
          <button 
            id="tab_history_closing"
            name="tab_history_closing"
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            السجل
          </button>
        </div>
      </div>

      {activeTab === 'NEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <label htmlFor="closing_date_input" className="font-bold text-gray-700">تاريخ التقفيل:</label>
                <input 
                  id="closing_date_input"
                  name="target_date"
                  type="date" 
                  className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" 
                  value={targetDate} 
                  onChange={e => setTargetDate(e.target.value)} 
                />
              </div>
              <div className="text-xs text-slate-400 font-bold uppercase">الحالة: <span className="text-orange-500">جاري التسوية</span></div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-4 bg-slate-50 border-b font-bold text-slate-700">ملخص الحركات النقدية ({targetDate})</div>
               <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border text-gray-400"><History className="w-5 h-5" /></div>
                      <span className="font-bold text-gray-600">الرصيد الافتتاحي (قبل اليوم)</span>
                    </div>
                    <span className="font-black text-lg">{currency}{summary.openingCash.toLocaleString()}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30">
                      <p className="text-xs font-bold text-emerald-600 uppercase mb-1 flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" /> إيراد مبيعات</p>
                      <h4 className="text-xl font-black text-emerald-700">{currency}{summary.cashSales.toLocaleString()}</h4>
                    </div>
                    <div className="p-4 rounded-xl border border-red-100 bg-red-50/30">
                      <p className="text-xs font-bold text-red-600 uppercase mb-1 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> مصروفات</p>
                      <h4 className="text-xl font-black text-red-700">{currency}{summary.expenses.toLocaleString()}</h4>
                    </div>
                    <div className="p-4 rounded-xl border border-orange-100 bg-orange-50/30">
                      <p className="text-xs font-bold text-orange-600 uppercase mb-1 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> مشتريات نقدية</p>
                      <h4 className="text-xl font-black text-orange-700">{currency}{summary.cashPurchases.toLocaleString()}</h4>
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
                    <div>
                        <span className="text-xl font-bold text-slate-800">الرصيد الدفتري المتوقع</span>
                        <p className="text-[10px] text-slate-400 font-bold">قيمة المخزون المقدرة: {currency}{summary.inventoryValue.toLocaleString()}</p>
                    </div>
                    <span className="text-3xl font-black text-blue-600">{currency}{summary.expectedCash.toLocaleString()}</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 ring-4 ring-blue-50/50">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" /> الرصيد الفعلي
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="actual_cash_input" className="block text-xs font-bold text-slate-400 uppercase mb-1.5">موجودات الخزينة (كاش)</label>
                  <input 
                    id="actual_cash_input"
                    name="actual_cash"
                    type="number" 
                    className="w-full border-2 border-blue-100 p-4 rounded-xl text-3xl font-black text-slate-800 focus:border-blue-600 outline-none transition-all"
                    placeholder="0.00"
                    value={actualCash || ''}
                    onChange={e => setActualCash(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label htmlFor="bank_balance_input" className="block text-xs font-bold text-slate-400 uppercase mb-1.5">رصيد البنك (اختياري)</label>
                  <input 
                    id="bank_balance_input"
                    name="bank_balance"
                    type="number" 
                    className="w-full border border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none"
                    placeholder="0.00"
                    value={bankBalance || ''}
                    onChange={e => setBankBalance(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label htmlFor="closing_notes_input" className="block text-xs font-bold text-slate-400 uppercase mb-1.5">ملاحظات التقفيل</label>
                  <textarea 
                    id="closing_notes_input"
                    name="closing_notes"
                    className="w-full border border-slate-200 p-3 rounded-xl font-bold text-slate-700 outline-none text-sm"
                    rows={2}
                    placeholder="أي ملاحظات حول العجز أو الزيادة..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  ></textarea>
                </div>

                <div className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center ${difference === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : difference > 0 ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                  <p className="text-xs font-bold uppercase mb-1">الفارق (عجز / زيادة)</p>
                  <h4 className="text-2xl font-black">{difference > 0 ? '+' : ''}{currency}{difference.toLocaleString()}</h4>
                  {difference === 0 && <p className="text-[10px] font-bold flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3" /> مطابق تماماً</p>}
                  {difference !== 0 && <p className="text-[10px] font-bold flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> يوجد اختلاف</p>}
                </div>

                <button 
                  id="submit_closing_btn"
                  name="submit_closing"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSaving ? <span className="loader"></span> : <Save className="w-5 h-5" />}
                  حفظ واعتماد التقفيل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-700">سجل التقفيلات السابقة</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4 text-center">إجمالي المبيعات</th>
                  <th className="p-4 text-center">الخزينة (فعلي)</th>
                  <th className="p-4 text-center">المخزون</th>
                  <th className="p-4">المسئول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map(closing => (
                  <tr key={closing.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-700">{closing.date}</td>
                    <td className="p-4 text-center font-mono">{currency}{closing.total_sales.toLocaleString()}</td>
                    <td className="p-4 text-center font-bold text-blue-600">{currency}{closing.cash_balance.toLocaleString()}</td>
                    <td className="p-4 text-center text-slate-500">{currency}{closing.inventory_value.toLocaleString()}</td>
                    <td className="p-4">
                      <span className="text-xs text-slate-500 font-bold">{closing.closed_by || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}