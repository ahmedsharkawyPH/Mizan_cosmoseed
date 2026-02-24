
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { useData } from '../context/DataContext';
import { Supplier } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Upload, Truck, X, Printer, Edit, Trash2 } from 'lucide-react';
import { readExcelFile } from '../utils/excel';
import { supplierSchema } from '../utils/validation';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { useLocation } from 'react-router-dom';
// @ts-ignore
import toast from 'react-hot-toast';

interface StatementItem {
  date: string;
  description: string;
  debit: number; // - (Payment/Return) - Decrease Liability
  credit: number; // + (Purchase) - Increase Liability
  balance: number;
}

export default function Suppliers() {
  const { suppliers: contextSuppliers, refreshData } = useData();
  const currency = db.getSettings().currency;
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({ code: '', name: '', phone: '', contact_person: '', address: '', opening_balance: 0 });

  // Filtered suppliers based on search
  const filteredSuppliers = useMemo(() => {
    return contextSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [contextSuppliers, search]);

  // Statement State
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  // Auto-open modal from navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
        handleOpenAdd();
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditingId(null);
    setForm({ code: '', name: '', phone: '', contact_person: '', address: '', opening_balance: 0 });
    setIsOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setIsEditMode(true);
    setEditingId(s.id);
    setForm({ 
      code: s.code || '', 
      name: s.name, 
      phone: s.phone || '', 
      contact_person: s.contact_person || '', 
      address: s.address || '', 
      opening_balance: s.opening_balance 
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    // التحقق من صحة البيانات باستخدام Zod
    const validation = supplierSchema.safeParse(form);
    if (!validation.success) {
      return toast.error(validation.error.issues[0].message);
    }

    if (isEditMode && editingId) {
      await db.updateSupplier(editingId, form);
      toast.success("تم تحديث بيانات المورد");
    } else {
      await db.addSupplier(form);
      toast.success("تم إضافة المورد بنجاح");
    }
    
    refreshData();
    setIsOpen(false);
    setForm({ code: '', name: '', phone: '', contact_person: '', address: '', opening_balance: 0 });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("هل أنت متأكد من حذف هذا المورد؟ سيتم حذف السجل نهائياً.")) {
      await db.deleteSupplier(id);
      refreshData();
      toast.success("تم حذف المورد");
    }
  };

  const handleImport = async (e: any) => {
    if(e.target.files[0]) {
      try {
        const data = await readExcelFile<any>(e.target.files[0]);
        for (const s of data) {
          await db.addSupplier({ ...s, opening_balance: s.opening_balance || 0 });
        }
        refreshData();
        toast.success(t('common.success_import'));
      } catch (err) {
        toast.error(t('common.error_excel'));
      }
    }
  };

  const statementData = useMemo(() => {
    if (!statementSupplier) return [];
    
    const items: any[] = [];
    const purchases = db.getPurchaseInvoices().filter((p: any) => p.supplier_id === statementSupplier.id);
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

    const payments = db.getCashTransactions().filter(tx => 
      tx.category === 'SUPPLIER_PAYMENT' && tx.reference_id === statementSupplier.id
    );
    payments.forEach(pay => {
       if (pay.type === 'EXPENSE') {
           items.push({
                date: pay.date,
                description: `Payment: ${pay.notes || '-'}`,
                debit: pay.amount,
                credit: 0,
                rawDate: new Date(pay.date)
           });
       } else {
           items.push({
                date: pay.date,
                description: `Refund: ${pay.notes || '-'}`,
                debit: 0,
                credit: pay.amount,
                rawDate: new Date(pay.date)
           });
       }
    });

    items.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    let balance = statementSupplier.opening_balance;
    const finalStatement: StatementItem[] = [];

    finalStatement.push({
        date: '',
        description: t('common.opening'),
        debit: 0,
        credit: 0,
        balance: balance
    });

    items.forEach(item => {
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
          <label htmlFor="import_supplier_file" className="cursor-pointer bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700">
            <Upload className="w-4 h-4" /> Import
            <input id="import_supplier_file" name="import_supplier_file" type="file" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
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
          <h3 className="font-bold text-lg">{isEditMode ? 'تعديل بيانات مورد' : t('supp.add')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="supp_code" className="block text-xs font-bold text-slate-500 mb-1">{t('cust.code')}</label>
              <input id="supp_code" name="code" placeholder={t('cust.code')} className="w-full border p-2 rounded" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
            </div>
            <div>
              <label htmlFor="supp_name" className="block text-xs font-bold text-slate-500 mb-1">{t('cust.name')}</label>
              <input id="supp_name" name="name" placeholder={t('cust.name')} className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label htmlFor="supp_phone" className="block text-xs font-bold text-slate-500 mb-1">{t('cust.phone')}</label>
              <input id="supp_phone" name="phone" placeholder={t('cust.phone')} className="w-full border p-2 rounded" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <label htmlFor="supp_contact" className="block text-xs font-bold text-slate-500 mb-1">{t('supp.contact')}</label>
              <input id="supp_contact" name="contact_person" placeholder={t('supp.contact')} className="w-full border p-2 rounded" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} />
            </div>
            <div>
              <label htmlFor="supp_address" className="block text-xs font-bold text-slate-500 mb-1">العنوان</label>
              <input id="supp_address" name="address" placeholder="Address" className="w-full border p-2 rounded" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            {!isEditMode && (
              <div>
                <label htmlFor="supp_balance" className="block text-xs font-bold text-slate-500 mb-1">{t('cust.balance')}</label>
                <input id="supp_balance" name="opening_balance" type="number" placeholder={t('cust.balance')} className="w-full border p-2 rounded" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: +e.target.value})} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('common.cancel')}</button>
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('set.save')}</button>
          </div>
        </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
            <input 
              id="supplier_main_search"
              name="supplier_search"
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
                <th className="p-4 text-center" title="حالة المزامنة">سحابة</th>
                <th className="p-4 text-center">{t('common.action')}</th>
                </tr>
            </thead>
            <tbody>
                {filteredSuppliers.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50 group">
                    <td className="p-4 font-mono text-gray-500">{s.code}</td>
                    <td className="p-4 font-bold">{s.name}</td>
                    <td className="p-4">{s.contact_person}</td>
                    <td className="p-4">{s.phone}</td>
                    <td className={`p-4 text-right rtl:text-left font-bold ${s.current_balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currency}{s.current_balance.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                        <SyncStatusIndicator status={s.sync_status} error={s.sync_error} />
                    </td>
                    <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                              onClick={() => setStatementSupplier(s)}
                              className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-xs font-medium border border-blue-200"
                          >
                              {t('common.statement')}
                          </button>
                          <button 
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="تعديل"
                          >
                              <Edit className="w-4 h-4" />
                          </button>
                          <button 
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="حذف"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                    </td>
                </tr>
                ))}
                {filteredSuppliers.length === 0 && (
                    <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400">لا يوجد موردين مسجلين</td>
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
