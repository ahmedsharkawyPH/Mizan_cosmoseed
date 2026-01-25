import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { Users, Briefcase, TrendingUp, DollarSign, Calendar, Wallet, CheckCircle, Search, AlertCircle, RefreshCw } from 'lucide-react';
// @ts-ignore
import toast from 'react-hot-toast';

export default function Commissions() {
  const currency = db.getSettings().currency;
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [commRatios, setCommRatios] = useState<Record<string, number>>({});
  
  const employeesData = useMemo(() => {
    const allUsers = authService.getUsers().filter(u => u.role !== 'ADMIN');
    const invoices = db.getInvoices().filter(inv => inv.date.startsWith(targetMonth) && inv.type === 'SALE');
    const customers = db.getCustomers();

    return allUsers.map(u => {
        let salesVal = 0;
        if (u.role === 'REP') {
            // Reps: sales from their assigned customers
            const repInvoices = invoices.filter(inv => {
                const c = customers.find(cust => cust.id === inv.customer_id);
                return c?.representative_code === u.code;
            });
            salesVal = repInvoices.reduce((s, inv) => s + inv.net_total, 0);
        } else {
            // Telesales/Others: sales they created
            const createdInvoices = invoices.filter(inv => inv.created_by === u.id);
            salesVal = createdInvoices.reduce((s, inv) => s + inv.net_total, 0);
        }
        
        const ratio = commRatios[u.id] || 1;
        const netComm = (salesVal * ratio) / 100;

        return {
            ...u,
            salesVal,
            ratio,
            netComm
        };
    });
  }, [targetMonth, commRatios]);

  const handleDisburse = (emp: any) => {
    if (emp.netComm <= 0) return toast.error(t('comm.no_sales'));
    
    if (confirm(`تأكيد صرف عمولة الموظف ${emp.name} بقيمة ${currency}${emp.netComm.toLocaleString()}؟`)) {
        db.addCashTransaction({
            type: 'EXPENSE',
            category: 'COMMISSION',
            amount: emp.netComm,
            related_name: emp.name,
            notes: `صرف عمولة مبيعات شهر ${targetMonth}`,
            date: new Date().toISOString()
        });
        toast.success(t('comm.success'));
    }
  };

  const updateRatio = (id: string, val: number) => {
      setCommRatios(prev => ({ ...prev, [id]: val }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-inner">
                  <TrendingUp className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                  <h1 className="text-2xl font-black text-slate-800">{t('comm.title')}</h1>
                  <p className="text-xs text-slate-400 font-bold mt-1">حساب مبيعات وعمولات المندوبين والتيليسيلز</p>
              </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border">
              <Calendar className="w-5 h-5 text-slate-400" />
              <label className="text-sm font-bold text-slate-700">{t('comm.month_select')}:</label>
              <input 
                type="month" 
                className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 font-black text-indigo-600 outline-none focus:border-indigo-500"
                value={targetMonth}
                onChange={e => setTargetMonth(e.target.value)}
              />
          </div>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                      <tr>
                          <th className="px-6 py-4">{t('comm.employee')}</th>
                          <th className="px-6 py-4">{t('comm.role')}</th>
                          <th className="px-6 py-4 text-center">{t('comm.sales_val')}</th>
                          <th className="px-6 py-4 text-center">{t('comm.ratio')}</th>
                          <th className="px-6 py-4 text-center">{t('comm.net_comm')}</th>
                          <th className="px-6 py-4 text-center">{t('common.action')}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {employeesData.map(emp => (
                          <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                  <div className="font-bold text-slate-800">{emp.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">@{emp.username}</div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${emp.role === 'REP' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                      {emp.role === 'REP' ? 'مندوب مبيعات' : 'تيليسيلز'}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-center font-black text-slate-700">
                                  {currency}{emp.salesVal.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <input 
                                    type="number"
                                    className="w-16 border-2 border-slate-100 rounded-lg p-1 text-center font-bold text-indigo-600 focus:border-indigo-400 outline-none"
                                    value={emp.ratio}
                                    onChange={e => updateRatio(emp.id, parseFloat(e.target.value) || 0)}
                                  />
                              </td>
                              <td className="px-6 py-4 text-center font-black text-emerald-600 bg-emerald-50/30">
                                  {currency}{emp.netComm.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <button 
                                    onClick={() => handleDisburse(emp)}
                                    disabled={emp.netComm <= 0}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-indigo-600 transition-all shadow-md active:scale-95 disabled:opacity-30 flex items-center gap-2 mx-auto"
                                  >
                                      <Wallet className="w-3.5 h-3.5" /> {t('comm.disburse')}
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          {employeesData.length === 0 && (
              <div className="py-20 text-center text-slate-300">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-10" />
                  <p className="font-bold">لم يتم العثور على موظفين لحساب عمولاتهم</p>
              </div>
          )}
      </div>
    </div>
  );
}