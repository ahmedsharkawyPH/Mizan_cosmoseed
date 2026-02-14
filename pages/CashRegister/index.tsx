
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import StatsCards from './StatsCards';
import TransactionsTable from './TransactionsTable';
import TransactionForm from './TransactionForm';
import { ArrowUpRight, ArrowDownLeft, Printer } from 'lucide-react';
import { CashTransactionType, CashTransaction } from '../../types';

const PRINT_STYLES = `
  @media print {
    @page { size: 58mm auto; margin: 0; }
    body * { visibility: hidden; }
    #thermal-receipt, #thermal-receipt * { visibility: visible; }
    #thermal-receipt { position: absolute; left: 0; top: 0; width: 58mm; padding: 2mm; font-family: 'Cairo', sans-serif; direction: rtl; background: white; }
    .no-print { display: none !important; }
  }
`;

export default function CashRegister() {
  const { txs, settings } = useData();
  const [filter, setFilter] = useState('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeType, setActiveType] = useState<CashTransactionType>(CashTransactionType.RECEIPT);
  const [printTx, setPrintTx] = useState<any>(null);

  const handleOpenForm = (type: CashTransactionType) => {
    setActiveType(type);
    setIsFormOpen(true);
  };

  const handlePrint = (tx: any) => {
      setPrintTx(tx);
      setTimeout(() => window.print(), 100);
  };

  return (
    <div className="space-y-6 relative pb-20 animate-in fade-in duration-500">
      <style>{PRINT_STYLES}</style>
      
      {/* Hidden Receipt for Print */}
      {printTx && (
          <div id="thermal-receipt" className="hidden print:block">
              <div className="receipt-container p-2 text-[11px] leading-tight">
                  <div className="text-center border-b border-dashed mb-2 pb-1 font-black">{settings.companyName}</div>
                  <div className="flex justify-between"><span>رقم السند:</span><span>{printTx.ref_number}</span></div>
                  <div className="flex justify-between"><span>التاريخ:</span><span>{new Date(printTx.date).toLocaleDateString('ar-EG')}</span></div>
                  <div className="border-t border-dashed my-2"></div>
                  <div className="flex justify-between font-bold"><span>الجهة:</span><span>{printTx.related_name}</span></div>
                  <div className="text-center my-3 text-lg font-black border p-1">{settings.currency} {printTx.amount.toLocaleString()}</div>
                  <div className="text-center text-[9px] mt-4 opacity-50">Mizan Online Pro</div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        <div>
            <h1 className="text-2xl font-black text-slate-800">الخزينة والحسابات</h1>
            <p className="text-sm text-slate-400 font-bold mt-1">إدارة السيولة النقدية وسندات القبض والصرف</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => handleOpenForm(CashTransactionType.RECEIPT)} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg font-black transition-all active:scale-95"><ArrowDownLeft className="w-5 h-5" /> إنشاء سند قبض</button>
          <button onClick={() => handleOpenForm(CashTransactionType.EXPENSE)} className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg font-black transition-all active:scale-95"><ArrowUpRight className="w-5 h-5" /> إنشاء سند صرف</button>
        </div>
      </div>

      <StatsCards transactions={txs} currency={settings.currency} filter={filter} />

      <TransactionsTable 
        transactions={txs} 
        currency={settings.currency} 
        filter={filter} 
        onFilterChange={setFilter} 
        onPrint={handlePrint}
      />

      {isFormOpen && (
        <TransactionForm 
            isOpen={isFormOpen} 
            onClose={() => setIsFormOpen(false)} 
            activeType={activeType}
            onSuccess={(tx) => { if(tx._shouldPrint) handlePrint(tx); }}
        />
      )}
    </div>
  );
}
