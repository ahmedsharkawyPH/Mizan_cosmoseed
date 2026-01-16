
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PlusCircle, RotateCcw, ArrowRightLeft, X, PackagePlus, Search, Trash2, AlertOctagon, Package, Calendar, Hash, ShoppingBag, Download, FileSpreadsheet, Loader2, Edit2, Save } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Batch } from '../types';
import { readExcelFile, downloadInventoryTemplate } from '../utils/excel';

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState(db.getProductsWithBatches());
  const warehouses = db.getWarehouses();
  const settings = db.getSettings();
  const currency = settings.currency;
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Quick Edit State
  const [editModal, setEditModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [editForm, setEditForm] = useState({ purchase_price: 0, selling_price: 0, quantity: 0 });

  const [transferModal, setTransferModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [transferQty, setTransferQty] = useState(0);
  const [targetWarehouse, setTargetWarehouse] = useState('');

  const [spoilageModal, setSpoilageModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [damagedQty, setDamagedQty] = useState(0);
  const [reason, setReason] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ 
    code: '', 
    name: '', 
    quantity: 1, 
    purchase_price: 0, 
    selling_price: 0,
    batch_number: 'AUTO',
    expiry_date: '2099-12-31'
  });

  useEffect(() => {
    if (location.state && (location.state as any).openAdd) setIsAddOpen(true);
  }, [location]);

  const handleManualAdd = async () => {
      if(!addForm.name || !addForm.code) return alert("Fill required fields");
      await db.addProduct(
        { code: String(addForm.code), name: addForm.name }, 
        { 
          quantity: addForm.quantity, 
          purchase_price: addForm.purchase_price, 
          selling_price: addForm.selling_price,
          batch_number: addForm.batch_number,
          expiry_date: addForm.expiry_date
        }
      );
      setProducts(db.getProductsWithBatches());
      setIsAddOpen(false);
      setAddForm({ code: '', name: '', quantity: 1, purchase_price: 0, selling_price: 0, batch_number: 'AUTO', expiry_date: '2099-12-31' });
  };

  const chunkArray = (array: any[], size: number) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    
    setIsImporting(true);
    setImportProgress(0);
    try {
      const data = await readExcelFile<any>(e.target.files[0]);
      const totalItems = data.length;
      
      const chunks = chunkArray(data, 100); // 100 صنف في المرة لسرعة أكبر
      let processedCount = 0;

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (row) => {
          // جلب البيانات بناءً على الرؤوس الجديدة التي أرسلتها
          const name = row.name;
          const code = row.code;
          
          // استخدام 0 بدلاً من || 0 لضمان معالجة الرقم 0 برمجياً
          const qty = isNaN(Number(row.quantity)) ? 0 : Number(row.quantity);
          const p_price = isNaN(Number(row.purchase_price)) ? 0 : Number(row.purchase_price);
          const s_price = isNaN(Number(row.selling_price)) ? 0 : Number(row.selling_price);
          
          const batch = row.batch_number || 'AUTO';
          const expiry = row.expiry_date || '2099-12-31';

          if (name && code) {
            await db.addProduct(
              { code: String(code), name: String(name) },
              {
                quantity: qty,
                purchase_price: p_price,
                selling_price: s_price,
                batch_number: String(batch),
                expiry_date: expiry
              }
            );
          }
        }));
        processedCount += chunk.length;
        setImportProgress(Math.min(100, Math.round((processedCount / totalItems) * 100)));
      }
      
      await db.init();
      setProducts(db.getProductsWithBatches());
      alert(`تم بنجاح رفع وتحديث ${processedCount} صنف ببيانات مخزونهم.`);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاستيراد. تأكد من أن أسماء الأعمدة في الإكسيل هي: code, name, quantity, purchase_price, selling_price, batch_number, expiry_date");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      e.target.value = ''; 
    }
  };

  const openQuickEdit = (batch: Batch) => {
      setEditForm({ 
          purchase_price: batch.purchase_price, 
          selling_price: batch.selling_price, 
          quantity: batch.quantity 
      });
      setEditModal({ isOpen: true, batch });
  };

  const handleQuickSave = async () => {
      if (!editModal.batch) return;
      await db.updateBatchPrices(editModal.batch.id, editForm.purchase_price, editForm.selling_price, editForm.quantity);
      setProducts(db.getProductsWithBatches());
      setEditModal({ isOpen: false, batch: null });
  };

  const handleTransfer = async () => {
      if (!transferModal.batch || !targetWarehouse || transferQty <= 0) return;
      const res = await db.transferStock(transferModal.batch.id, targetWarehouse, transferQty);
      if (res.success) { setProducts(db.getProductsWithBatches()); setTransferModal({ isOpen: false, batch: null }); }
  };

  const handleSpoilageReport = async () => {
    if (!spoilageModal.batch || damagedQty <= 0) return;
    const res = await db.reportSpoilage(spoilageModal.batch.id, damagedQty, reason);
    if (res.success) { setProducts(db.getProductsWithBatches()); setSpoilageModal({ isOpen: false, batch: null }); }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t('stock.title')}</h1>
        <div className="flex flex-wrap gap-2">
            <button 
              onClick={downloadInventoryTemplate}
              className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all hover:bg-slate-50 shadow-sm"
            >
                <Download className="w-4 h-4 text-blue-500" />
                <span className="hidden sm:inline">تحميل النموذج</span>
            </button>

            <div className="relative">
                <label className={`cursor-pointer bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all hover:bg-emerald-700 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isImporting ? `جاري الرفع ${importProgress}%` : t('stock.import')}</span>
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={isImporting} />
                </label>
                {isImporting && (
                    <div className="absolute -bottom-2 left-0 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                    </div>
                )}
            </div>

            <button onClick={() => setIsAddOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all hover:bg-blue-700">
                <PlusCircle className="w-4 h-4" />{t('stock.new')}
            </button>
            
            <div className="flex bg-purple-50 p-1 rounded-xl border border-purple-100 shadow-sm gap-2">
                <button onClick={() => navigate('/purchase-orders')} className="bg-purple-600 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-all hover:bg-purple-700">
                    <ShoppingBag className="w-4 h-4" />{t('stock.order')}
                </button>
                <button 
                  onClick={() => navigate('/purchases/new')}
                  className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all hover:bg-cyan-700"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{t('stock.purchase')}</span>
                </button>
            </div>
        </div>
      </div>

      <div className="relative max-w-md">
         <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
         <input type="text" placeholder={t('cust.search')} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid gap-6">
        {filteredProducts.map(product => {
          const totalQty = product.batches.reduce((sum, b) => sum + b.quantity, 0);
          return (
            <div key={product.id} className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/50 flex justify-between items-center border-b">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{product.name.charAt(0)}</div>
                        <div><h3 className="font-bold text-slate-800">{product.name}</h3><span className="text-xs text-slate-400 font-mono">{product.code}</span></div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold uppercase">{t('stock.total')}</p>
                        <span className="text-xl font-bold text-slate-800">{totalQty}</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="bg-slate-50/30 text-slate-500 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-3">{t('stock.warehouse')}</th>
                                <th className="px-6 py-3 text-right">{t('stock.cost')}</th>
                                <th className="px-6 py-3 text-right">{t('stock.price')}</th>
                                <th className="px-6 py-3 text-right">{t('stock.qty')}</th>
                                <th className="px-6 py-3 text-center">{t('common.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {product.batches.map(batch => (
                            <tr key={batch.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-blue-700">{warehouses.find(w => w.id === batch.warehouse_id)?.name || 'Unknown'}</td>
                                <td className="px-6 py-4 text-right text-slate-400 font-mono">{currency}{batch.purchase_price}</td>
                                <td className="px-6 py-4 text-right font-bold text-slate-700">{currency}{batch.selling_price}</td>
                                <td className="px-6 py-4 text-right font-black text-slate-900">{batch.quantity}</td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => openQuickEdit(batch)} className="text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="تعديل سريع"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => { setTransferQty(0); setTargetWarehouse(''); setTransferModal({ isOpen: true, batch }); }} className="text-slate-600 p-2 rounded-lg hover:bg-slate-50 transition-colors"><ArrowRightLeft className="w-4 h-4" /></button>
                                        <button onClick={() => { setDamagedQty(0); setReason(''); setSpoilageModal({ isOpen: true, batch }); }} className="text-amber-600 p-2 rounded-lg hover:bg-amber-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )
        })}
      </div>

      {/* Quick Edit Prices Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
                <div className="flex justify-between items-center p-5 border-b bg-blue-600 text-white font-bold">
                    <h3>تعديل الأسعار والرصيد</h3>
                    <button onClick={() => setEditModal({isOpen: false, batch: null})}><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">سعر التكلفة</label>
                        <input type="number" className="w-full border p-2.5 rounded-lg font-bold" value={editForm.purchase_price} onChange={e => setEditForm({...editForm, purchase_price: +e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">سعر البيع</label>
                        <input type="number" className="w-full border p-2.5 rounded-lg font-bold text-blue-600" value={editForm.selling_price} onChange={e => setEditForm({...editForm, selling_price: +e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">الرصيد الحالي</label>
                        <input type="number" className="w-full border p-2.5 rounded-lg font-bold text-emerald-600" value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: +e.target.value})} />
                    </div>
                    <button onClick={handleQuickSave} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"><Save className="w-4 h-4" /> حفظ التغييرات</button>
                </div>
            </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b bg-blue-50">
                    <h3 className="font-bold text-blue-900">{t('stock.transfer_title')}</h3>
                    <button onClick={() => setTransferModal({isOpen: false, batch: null})}><X className="w-5 h-5 text-blue-400" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('stock.to_warehouse')}</label>
                        <select className="w-full border p-2.5 rounded-lg bg-slate-50" value={targetWarehouse} onChange={e => setTargetWarehouse(e.target.value)}>
                            <option value="">-- Choose Store --</option>
                            {warehouses.filter(w => w.id !== transferModal.batch?.warehouse_id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('stock.transfer_qty')}</label>
                        <input type="number" className="w-full border p-2.5 rounded-lg text-lg font-bold" value={transferQty} onChange={e => setTransferQty(Number(e.target.value))} />
                    </div>
                    <button onClick={handleTransfer} disabled={!targetWarehouse || transferQty <= 0} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30">{t('stock.confirm_transfer')}</button>
                </div>
            </div>
        </div>
      )}

      {/* Spoilage Modal */}
      {spoilageModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b bg-amber-50"><h3 className="font-bold text-amber-800 flex items-center gap-2"><AlertOctagon className="w-5 h-5" />{t('stock.spoilage')}</h3><button onClick={() => setSpoilageModal({isOpen: false, batch: null})}><X className="w-5 h-5 text-amber-400" /></button></div>
                <div className="p-6 space-y-4">
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('stock.damaged_qty')}</label><input type="number" className="w-full border p-2.5 rounded-lg text-lg font-bold text-red-600" value={damagedQty} onChange={e => setDamagedQty(Number(e.target.value))} min={1} /></div>
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('stock.reason')}</label><textarea className="w-full border p-2.5 rounded-lg" value={reason} onChange={e => setReason(e.target.value)} rows={2} /></div>
                    <button onClick={handleSpoilageReport} disabled={damagedQty <= 0} className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold shadow-lg">{t('stock.confirm_spoilage')}</button>
                </div>
            </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center p-5 border-b"><h3 className="font-bold text-slate-800">{t('prod.new_title')}</h3><button onClick={() => setIsAddOpen(false)} className="text-slate-400 w-5 h-5 text-slate-400" /></div>
                  <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                      <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('prod.name')} *</label><input className="w-full border p-2.5 rounded-lg" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('prod.code')} *</label><input className="w-full border p-2.5 rounded-lg font-mono uppercase" value={addForm.code} onChange={e => setAddForm({...addForm, code: e.target.value})} /></div>
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('stock.qty')}</label><input type="number" className="w-full border p-2.5 rounded-lg font-bold" value={addForm.quantity} onChange={e => setAddForm({...addForm, quantity: +e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('stock.cost')}</label><input type="number" className="w-full border p-2.5 rounded-lg" value={addForm.purchase_price} onChange={e => setAddForm({...addForm, purchase_price: +e.target.value})} /></div>
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block">{t('stock.price')}</label><input type="number" className="w-full border p-2.5 rounded-lg font-bold text-blue-600" value={addForm.selling_price} onChange={e => setAddForm({...addForm, selling_price: +e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block flex items-center gap-1"><Hash className="w-3 h-3" /> {t('stock.batch')}</label><input className="w-full border p-2.5 rounded-lg font-mono text-sm" value={addForm.batch_number} onChange={e => setAddForm({...addForm, batch_number: e.target.value})} /></div>
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('stock.expiry')}</label><input type="date" className="w-full border p-2.5 rounded-lg text-sm" value={addForm.expiry_date} onChange={e => setAddForm({...addForm, expiry_date: e.target.value})} /></div>
                      </div>
                      <div className="pt-2">
                        <button onClick={handleManualAdd} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors">{t('set.save')}</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
export default Inventory;
