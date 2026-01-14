
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Supplier } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Upload, Truck, X, Printer } from 'lucide-react';
import { readExcelFile } from '../utils/excel';
import { useLocation } from 'react-router-dom';

interface StatementItem {
  date: string;
  description: string;
  debit: number; // - (Payment/Return) - Decrease Liability
  credit: number; // + (Purchase) - Increase Liability
  balance: number;
}

export default function Suppliers() {
  const currency = db.getSettings().currency;
  const location = useLocation();
  const [suppliers, setSuppliers] = useState(db.getSuppliers());
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', phone: '', contact_person: '', address: '', opening_balance: 0 });

  // Statement State
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  // Auto-open modal from navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
        setIsOpen(true);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleAdd = () => {
    db.addSupplier(form);
    setSuppliers(db.getSuppliers());
    setIsOpen(false);
    setForm({ code: '', name: '', phone: '', contact_person: '', address: '', opening_balance: 0 });
  };

  const handleImport = async (e: any) => {
    if(e.target.files[0]) {
      try {
        const data = await readExcelFile<any>(e.target.files[0]);
        data.forEach(s => db.addSupplier({ ...s, opening_balance: s.opening_balance || 0 }));
        setSuppliers(db.getSuppliers());
        alert(t('common.success_import'));
      } catch (err) {
        alert(t('common.error_excel'));
      }
    }
  };

  const statementData = useMemo(() => {
    if (!statementSupplier) return [];
    
    const items: any[] = [];
    
    // 1. Purchase Invoices (Credit -> Increase Balance) & Returns (Debit -> Decrease Balance)
    const purchases = (db as any).purchaseInvoices.filter((p: any) => p.supplier_id === statementSupplier.id);
    purchases.forEach((inv: any) => {
      if (inv.type === 'RETURN') {
         items.push({
            date: inv.date,
            description: `Return #${inv.invoice_number}`,
            debit: inv.total_amount, // Return reduces debt
            credit: 0,
            rawDate: new Date(inv.date)
         });
      } else {
         items.push({
            date: inv.date,
            description: `Purchase #${inv.invoice_number}`,
            debit: 0,
            credit: inv.total_amount, // Purchase increases debt
            rawDate: new Date(inv.date)
         });
      }
    });

    // 2. Payments (Debit -> Decrease Balance)
    const payments = db.getCashTransactions().filter(tx => 
      tx.category === 'SUPPLIER_PAYMENT' && tx.reference_id === statementSupplier.id
    );
    payments.forEach(pay => {
       // Check if it's a refund (Receipt) or payment (Expense)
       // Usually Supplier Payment is Expense (We pay them) -> Reduces Debt (Debit)
       // Supplier Refund is Receipt (They pay us) -> Increases Debt (Credit) if we consider Balance as "What we owe them"
       
       if (pay.type === 'EXPENSE') {
           items.push({
                date: pay.date,
                description: `Payment: ${pay.notes || '-'}`,
                debit: pay.amount,
                credit: 0,
                rawDate: new Date(pay.date)
           });
       } else {
           // Receipt (Refund from supplier)
           items.push({
                date: pay.date,
                description: `Refund: ${pay.notes || '-'}`,
                debit: 0,
                credit: pay.amount,
                rawDate: new Date(pay.date)
           });
       }
    });

    // Sort by Date
    items.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // Calculate Running Balance
    let balance = statementSupplier.opening_balance;
    const finalStatement: StatementItem[] = [];

    // Add Opening Balance Row
    finalStatement.push({
        date: '',
        description: t('common.opening'),
        debit: 0,
        credit: 0,
        balance: balance
    });

    items.forEach(item => {
        // For Supplier: Balance = Previous + Credit (Purchase) - Debit (Payment/Return)
        balance = balance + item.credit - item.debit;
        finalStatement.push({
            date: item.date,
            description: item.description,
            debit: item.debit,
            credit: item.credit,
            balance: balance
        });
    });

    return finalStatement;

  }, [statementSupplier]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            {t('supp.title')}
        </h1>
        <div className="flex gap-2">
          <label className="cursor-pointer bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700">
            <Upload className="w-4 h-4" /> Import
            <input type="file" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={() => setIsOpen(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> {t('supp.add')}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
             <div className="bg-white p-6 rounded-xl border shadow-lg space-y-4 animate-in fade-in zoom-in duration-200 w-full max-w-lg relative">
             <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
            </button>
          <h3 className="font-bold text-lg">{t('supp.add')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder={t('cust.code')} className="border p-2 rounded" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
            <input placeholder={t('cust.name')} className="border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input placeholder={t('cust.phone')} className="border p-2 rounded" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <input placeholder={t('supp.contact')} className="border p-2 rounded" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} />
            <input placeholder="Address" className="border p-2 rounded" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            <input type="number" placeholder={t('cust.balance')} className="border p-2 rounded" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: +e.target.value})} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('common.action')}</button>
            <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('set.save')}</button>
          </div>
        </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
            <input 
              className="pl-10 pr-4 py-2 border rounded-lg w-full rtl:pr-10 rtl:pl-4" 
              placeholder={t('cust.search')} 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[700px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                <th className="p-4">{t('cust.code')}</th>
                <th className="p-4">{t('cust.name')}</th>
                <th className="p-4">{t('supp.contact')}</th>
                <th className="p-4">{t('cust.phone')}</th>
                <th className="p-4 text-right rtl:text-left">{t('cust.balance')}</th>
                <th className="p-4 text-center">{t('common.action')}</th>
                </tr>
            </thead>
            <tbody>
                {suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-mono text-gray-500">{s.code}</td>
                    <td className="p-4 font-bold">{s.name}</td>
                    <td className="p-4">{s.contact_person}</td>
                    <td className="p-4">{s.phone}</td>
                    <td className={`p-4 text-right rtl:text-left font-bold ${s.current_balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currency}{s.current_balance.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                        <button 
                            onClick={() => setStatementSupplier(s)}
                            className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-xs font-medium border border-blue-200"
                        >
                            {t('common.statement')}
                        </button>
                    </td>
                </tr>
                ))}
                {suppliers.length === 0 && (
                    <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400">No suppliers found</td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

       {/* Account Statement Modal */}
       {statementSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static">
             <style>
                {`
                @media print {
                  @page { size: portrait; margin: 1cm; }
                  body * { visibility: hidden; }
                  #statement-modal, #statement-modal * { visibility: visible; }
                  #statement-modal { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 0; background: white; z-index: 9999; }
                  .print-hidden { display: none !important; }
                }
                `}
            </style>
            
            <div id="statement-modal" className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none">
                <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center shrink-0 print:bg-white print:border-b-2 print:border-black">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{t('common.statement')}</h3>
                        <p className="text-sm text-gray-500">{statementSupplier.name} - {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 print-hidden">
                         <button onClick={() => window.print()} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full">
                            <Printer className="w-5 h-5" />
                        </button>
                        <button onClick={() => setStatementSupplier(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                     <div className="overflow-x-auto">
                         <table className="w-full text-sm text-left rtl:text-right border-collapse min-w-[600px]">
                            <thead className="bg-gray-100 text-gray-700 sticky top-0 print:static">
                                <tr>
                                    <th className="p-3 border">{t('common.date')}</th>
                                    <th className="p-3 border">{t('common.desc')}</th>
                                    <th className="p-3 border text-right rtl:text-left text-green-600">{t('common.debit')} (-)</th>
                                    <th className="p-3 border text-right rtl:text-left text-red-600">{t('common.credit')} (+)</th>
                                    <th className="p-3 border text-right rtl:text-left">{t('common.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statementData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 border-b">
                                        <td className="p-3 border text-gray-600">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                                        <td className="p-3 border font-medium">{row.description}</td>
                                        <td className="p-3 border text-right rtl:text-left">{row.debit > 0 ? `${currency}${row.debit.toLocaleString()}` : '-'}</td>
                                        <td className="p-3 border text-right rtl:text-left">{row.credit > 0 ? `${currency}${row.credit.toLocaleString()}` : '-'}</td>
                                        <td className={`p-3 border text-right rtl:text-left font-bold ${row.balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {currency}{row.balance.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                     </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
