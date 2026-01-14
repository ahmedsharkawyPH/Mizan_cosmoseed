
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { readExcelFile } from '../utils/excel';
import { PlusCircle, RotateCcw, ArrowRightLeft, X, PackagePlus, Search, ClipboardCheck, Trash2, AlertOctagon, History, Package, Save, ShoppingBag, FileDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Batch, StockMovement } from '../types';
import * as XLSX from 'xlsx';

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // TABS
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TAKE'>('OVERVIEW');
  const canDoStockTake = authService.hasPermission('MANAGE_STOCK_TAKE');

  const [products, setProducts] = useState(db.getProductsWithBatches());
  const warehouses = db.getWarehouses();
  const settings = db.getSettings();
  const currency = settings.currency;
  const lowStockThreshold = settings.lowStockThreshold;

  const [searchTerm, setSearchTerm] = useState('');

  // Transfer Modal State
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [transferQty, setTransferQty] = useState(0);
  const [targetWarehouse, setTargetWarehouse] = useState('');

  // Stock Take (Single Adjustment) Modal State
  const [stockTakeModal, setStockTakeModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [actualQty, setActualQty] = useState(0);
  
  // Bulk Stock Take State
  const [stockTakeValues, setStockTakeValues] = useState<Record<string, number>>({}); // BatchID -> ActualQty

  // Spoilage (Damage) Modal State
  const [spoilageModal, setSpoilageModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [damagedQty, setDamagedQty] = useState(0);
  const [reason, setReason] = useState('');

  // Stock History Modal
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; productId: string | null; logs: StockMovement[] }>({ isOpen: false, productId: null, logs: [] });

  // Add Product Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
      code: '', name: '', 
      batch_number: '', quantity: 1, 
      purchase_price: 0, selling_price: 0, 
      expiry_date: new Date().toISOString().split('T')[0],
      package_type: '', items_per_package: 0
  });

  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
        setIsAddOpen(true);
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  // --- Excel Template Download ---
  const handleDownloadTemplate = () => {
      const templateData = [
          {
              "Code": "P-1001",
              "Name": "Sample Product Name",
              "Batch": "B-202401",
              "Quantity": 100,
              "Cost": 10.50,
              "Price": 15.00,
              "Expiry": "2025-12-31",
              "Package": "Box",
              "Items": 12
          },
          {
              "Code": "كود الصنف",
              "Name": "اسم الصنف",
              "Batch": "رقم التشغيلة",
              "Quantity": "العدد",
              "Cost": "التكلفة",
              "Price": "سعر البيع",
              "Expiry": "YYYY-MM-DD",
              "Package": "نوع العبوة",
              "Items": "العدد داخل العبوة"
          }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      
      // Adjust column width for better readability
      const wscols = [
          {wch: 15}, // Code
          {wch: 30}, // Name
          {wch: 15}, // Batch
          {wch: 10}, // Qty
          {wch: 10}, // Cost
          {wch: 10}, // Price
          {wch: 15}, // Expiry
          {wch: 10}, // Package
          {wch: 10}  // Items
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Import Template");
      XLSX.writeFile(wb, "Inventory_Import_Template.xlsx");
  };

  const handleImport = async (e: any) => {
    if(e.target.files[0]) {
      try {
          const data = await readExcelFile<any>(e.target.files[0]);
          let addedCount = 0;

          for (const row of data) {
              // Map Arabic Headers to English keys
              const code = row.code || row['Code'] || row['الكود'] || row['كود'];
              const name = row.name || row['Name'] || row['الاسم'] || row['اسم الصنف'];
              // Skip the instructional row if user kept it
              if (!code || code === 'كود الصنف' || !name || name === 'اسم الصنف') continue;

              const batch = row.batch || row['batch_number'] || row['Batch'] || row['التشغيلة'] || row['رقم التشغيلة'] || `BATCH-${Math.floor(Math.random()*1000)}`;
              const qty = row.qty || row['quantity'] || row['Quantity'] || row['الكمية'] || row['العدد'] || 0;
              const price = row.price || row['selling_price'] || row['Price'] || row['السعر'] || row['سعر البيع'] || 0;
              const cost = row.cost || row['purchase_price'] || row['Cost'] || row['التكلفة'] || row['سعر الشراء'] || 0;
              const pkgType = row.package_type || row['Package'] || row['نوع العبوة'] || '';
              const pkgItems = row.items_per_package || row['Items'] || row['العدد داخل العبوة'] || 0;
              const expiry = row.expiry_date || row['Expiry'] || row['تاريخ الصلاحية'] || row['الصلاحية'];

              // Validate required fields
              if (code && name) {
                  await db.addProduct({
                      code: String(code), 
                      name: String(name), 
                      package_type: pkgType, 
                      items_per_package: Number(pkgItems)
                  }, {
                      batch_number: String(batch), 
                      quantity: Number(qty), 
                      selling_price: Number(price), 
                      purchase_price: Number(cost), 
                      expiry_date: expiry ? new Date(expiry).toISOString() : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
                  });
                  addedCount++;
              }
          }
          
          setProducts(db.getProductsWithBatches());
          alert(`${t('common.success_import')}: ${addedCount} items added.`);
          e.target.value = null; // Reset input
      } catch (err) {
          console.error(err);
          alert(t('common.error_excel'));
      }
    }
  };

  const handleManualAdd = async () => {
      if(!addForm.name || !addForm.code || !addForm.batch_number) {
          alert("Please fill required fields (Name, Code, Batch)");
          return;
      }
      await db.addProduct(
          { 
              code: addForm.code, 
              name: addForm.name,
              package_type: addForm.package_type,
              items_per_package: addForm.items_per_package
          },
          { 
              batch_number: addForm.batch_number, 
              quantity: addForm.quantity, 
              purchase_price: addForm.purchase_price, 
              selling_price: addForm.selling_price, 
              expiry_date: new Date(addForm.expiry_date).toISOString() 
          }
      );
      setProducts(db.getProductsWithBatches());
      setIsAddOpen(false);
      setAddForm({
        code: '', name: '', 
        batch_number: '', quantity: 1, 
        purchase_price: 0, selling_price: 0, 
        expiry_date: new Date().toISOString().split('T')[0],
        package_type: '', items_per_package: 0
    });
  };

  // --- Actions ---

  const handleTransfer = async () => {
      if (!transferModal.batch || !targetWarehouse || transferQty <= 0) return;
      const res = await db.transferStock(transferModal.batch.id, targetWarehouse, transferQty);
      if (res.success) {
          setProducts(db.getProductsWithBatches());
          setTransferModal({ isOpen: false, batch: null });
      } else {
          alert(res.message);
      }
  };

  const openTransferModal = (batch: Batch) => {
      setTransferQty(0);
      setTargetWarehouse('');
      setTransferModal({ isOpen: true, batch });
  };

  // Keep modal logic for safety, but trigger removed from list
  const openStockTakeModal = (batch: Batch) => {
      setActualQty(batch.quantity); // Pre-fill with current
      setStockTakeModal({ isOpen: true, batch });
  };

  const handleStockTake = async () => {
      if (!stockTakeModal.batch) return;
      const res = await db.adjustStock(stockTakeModal.batch.id, actualQty);
      if (res.success) {
          setProducts(db.getProductsWithBatches());
          setStockTakeModal({ isOpen: false, batch: null });
      } else {
          alert(res.message);
      }
  };

  // --- Bulk Stock Take Handler ---
  const handleBulkStockSave = async () => {
      let changed = 0;
      for (const p of products) {
          for (const b of p.batches) {
              if (stockTakeValues[b.id] !== undefined && stockTakeValues[b.id] !== b.quantity) {
                  await db.adjustStock(b.id, stockTakeValues[b.id]);
                  changed++;
              }
          }
      }

      if (changed > 0) {
          alert(`${changed} items updated successfully.`);
          setProducts(db.getProductsWithBatches());
          setStockTakeValues({});
      } else {
          alert(t('stock.no_changes'));
      }
  };

  const updateStockTakeValue = (batchId: string, val: number) => {
      setStockTakeValues(prev => ({ ...prev, [batchId]: val }));
  };

  const openSpoilageModal = (batch: Batch) => {
      setDamagedQty(0);
      setReason('');
      setSpoilageModal({ isOpen: true, batch });
  };

  const handleSpoilageReport = async () => {
      if (!spoilageModal.batch || damagedQty <= 0) return;
      const res = await db.reportSpoilage(spoilageModal.batch.id, damagedQty, reason);
      if (res.success) {
          setProducts(db.getProductsWithBatches());
          setSpoilageModal({ isOpen: false, batch: null });
      } else {
          alert(res.message);
      }
  };

  const openHistoryModal = (productId: string) => {
      const logs = db.getStockMovements(productId);
      setHistoryModal({ isOpen: true, productId, logs });
  };

  // ---------------

  const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('stock.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">Manage items, batches, and warehouse transfers.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
            <button onClick={() => setIsAddOpen(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
                <PackagePlus className="w-4 h-4" />
                {t('stock.new')}
            </button>
            <div className="h-10 w-px bg-slate-200 mx-1 hidden md:block"></div>
            <button onClick={() => navigate('/purchases/new')} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all">
                <PlusCircle className="w-4 h-4" />
                {t('stock.purchase')}
            </button>
            <button onClick={() => navigate('/purchase-orders')} className="bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-all">
                <ShoppingBag className="w-4 h-4" />
                {t('stock.order')}
            </button>
            <button onClick={() => navigate('/purchases/return')} className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-all">
                <RotateCcw className="w-4 h-4" />
                {t('stock.return')}
            </button>
            
            <div className="flex gap-2">
                <button 
                    onClick={handleDownloadTemplate}
                    className="bg-white text-emerald-600 border border-emerald-200 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-50 flex items-center gap-2 transition-all"
                    title="Download Excel Template"
                >
                    <FileDown className="w-4 h-4" />
                    Template
                </button>
                <label className="cursor-pointer bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-all">
                    {t('stock.import')}
                    <input type="file" className="hidden" onChange={handleImport} />
                </label>
            </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'OVERVIEW' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <Package className="w-4 h-4" />
              {t('stock.tab_overview')}
          </button>
          {canDoStockTake && (
              <button 
                onClick={() => setActiveTab('TAKE')}
                className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'TAKE' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                  <ClipboardCheck className="w-4 h-4" />
                  {t('stock.tab_take')}
              </button>
          )}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
         <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
         <input 
            type="text" 
            placeholder={t('cust.search')} 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
         />
      </div>

      {/* Product List (OVERVIEW TAB) */}
      {activeTab === 'OVERVIEW' && (
          <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2">
            {filteredProducts.map(product => {
              const totalQty = product.batches.reduce((sum, b) => sum + b.quantity, 0);
              return (
                <div key={product.id} className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                            {product.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                {product.name}
                                <button 
                                    onClick={() => openHistoryModal(product.id)}
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                    title="View Stock History"
                                >
                                    <History className="w-4 h-4" />
                                </button>
                            </h3>
                            <div className="flex gap-2">
                                <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{product.code}</span>
                                {product.package_type && (
                                    <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                        {product.package_type}: {product.items_per_package} units
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{t('stock.total')}</p>
                        <span className={`text-xl font-bold ${totalQty < lowStockThreshold ? 'text-amber-500' : 'text-slate-800'}`}>{totalQty}</span>
                    </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/30">
                            <tr>
                            <th className="px-6 py-3 font-medium">{t('stock.batch')}</th>
                            <th className="px-6 py-3 font-medium">{t('stock.warehouse')}</th>
                            <th className="px-6 py-3 font-medium">{t('stock.expiry')}</th>
                            <th className="px-6 py-3 font-medium text-right rtl:text-left">{t('stock.cost')}</th>
                            <th className="px-6 py-3 font-medium text-right rtl:text-left">{t('stock.price')}</th>
                            <th className="px-6 py-3 font-medium text-right rtl:text-left">{t('stock.qty')}</th>
                            <th className="px-6 py-3 font-medium text-center">{t('common.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {product.batches.map(batch => {
                            const wName = warehouses.find(w => w.id === batch.warehouse_id)?.name || 'Unknown';
                            const isExpired = new Date(batch.expiry_date) < new Date();
                            return (
                            <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-slate-600 flex items-center gap-2">
                                    {batch.batch_number}
                                    {isExpired && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold">EXP</span>}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500">
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">{wName}</span>
                                </td>
                                <td className={`px-6 py-4 ${isExpired ? 'text-red-500 font-bold' : 'text-slate-600'}`}>{new Date(batch.expiry_date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right rtl:text-left text-slate-400">{currency}{batch.purchase_price}</td>
                                <td className="px-6 py-4 text-right rtl:text-left font-medium text-slate-800">{currency}{batch.selling_price}</td>
                                <td className="px-6 py-4 text-right rtl:text-left">
                                    <span className={`font-bold ${batch.quantity === 0 ? 'text-slate-300' : 'text-slate-800'}`}>{batch.quantity}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button 
                                            onClick={() => openTransferModal(batch)}
                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                            title={t('stock.transfer')}
                                        >
                                            <ArrowRightLeft className="w-4 h-4" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => openSpoilageModal(batch)}
                                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 p-2 rounded-lg transition-colors"
                                            title={t('stock.spoilage')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            )})}
                        </tbody>
                        </table>
                    </div>
                </div>
              )
            })}
            {filteredProducts.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <p className="text-slate-400 mb-2">{t('list.no_data')}</p>
                    <button onClick={() => setIsAddOpen(true)} className="text-blue-600 font-medium hover:underline">{t('stock.new')}</button>
                </div>
            )}
          </div>
      )}

      {/* STOCK TAKE TAB */}
      {activeTab === 'TAKE' && canDoStockTake && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl flex justify-between items-center">
                  <div>
                      <h2 className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                          <ClipboardCheck className="w-6 h-6" />
                          {t('stock.take_mode')}
                      </h2>
                      <p className="text-sm text-emerald-600 mt-1">Enter physical counts below. Only rows with changes will be saved.</p>
                  </div>
                  <button 
                    onClick={handleBulkStockSave}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all"
                  >
                      <Save className="w-5 h-5" />
                      {t('stock.save_adjustments')}
                  </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full text-sm text-left rtl:text-right">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0 z-10">
                          <tr>
                              <th className="p-4">{t('inv.product')}</th>
                              <th className="p-4">{t('stock.batch')}</th>
                              <th className="p-4">{t('stock.expiry')}</th>
                              <th className="p-4 text-center">{t('stock.sys_qty')}</th>
                              <th className="p-4 text-center w-32">{t('stock.actual_qty')}</th>
                              <th className="p-4 text-center w-24">{t('stock.diff')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {filteredProducts.map(p => (
                              p.batches.map(b => {
                                  const currentVal = stockTakeValues[b.id] !== undefined ? stockTakeValues[b.id] : b.quantity;
                                  const diff = currentVal - b.quantity;
                                  const isModified = diff !== 0;
                                  
                                  return (
                                      <tr key={b.id} className={`hover:bg-gray-50 ${isModified ? 'bg-blue-50/30' : ''}`}>
                                          <td className="p-4 font-medium text-gray-800">
                                              {p.name}
                                              <div className="text-xs text-gray-400 font-normal">{p.code}</div>
                                          </td>
                                          <td className="p-4 font-mono text-xs text-gray-600">{b.batch_number}</td>
                                          <td className="p-4 text-gray-500">{new Date(b.expiry_date).toLocaleDateString()}</td>
                                          <td className="p-4 text-center font-bold text-gray-700">{b.quantity}</td>
                                          <td className="p-4">
                                              <input 
                                                type="number" 
                                                className={`w-full border p-2 rounded text-center font-bold focus:ring-2 outline-none
                                                    ${isModified ? 'border-blue-400 bg-white ring-blue-200' : 'border-gray-200 bg-gray-50 focus:bg-white focus:ring-blue-500'}`}
                                                value={currentVal}
                                                onChange={(e) => updateStockTakeValue(b.id, parseInt(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                              />
                                          </td>
                                          <td className="p-4 text-center">
                                              {isModified ? (
                                                  <span className={`font-bold ${diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                      {diff > 0 ? '+' : ''}{diff}
                                                  </span>
                                              ) : <span className="text-gray-300">-</span>}
                                          </td>
                                      </tr>
                                  );
                              })
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Transfer Modal */}
      {transferModal.isOpen && transferModal.batch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg">{t('stock.transfer_title')}</h3>
                    <button onClick={() => setTransferModal({isOpen: false, batch: null})} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-900 border border-blue-100">
                        <p className="font-bold text-lg mb-1">{products.find(p => p.id === transferModal.batch?.product_id)?.name}</p>
                        <div className="flex justify-between text-blue-700 mt-2">
                             <span>{t('stock.batch')}: <b>{transferModal.batch.batch_number}</b></span>
                             <span>{t('stock.avail')}: <b>{transferModal.batch.quantity}</b></span>
                        </div>
                        <p className="text-xs mt-1 text-blue-500">{t('stock.source')}: {warehouses.find(w => w.id === transferModal.batch?.warehouse_id)?.name}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.to_warehouse')}</label>
                        <select 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                            value={targetWarehouse} 
                            onChange={e => setTargetWarehouse(e.target.value)}
                        >
                            <option value="">-- Select Destination --</option>
                            {warehouses.filter(w => w.id !== transferModal.batch?.warehouse_id).map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.transfer_qty')}</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg" 
                            value={transferQty} 
                            onChange={e => setTransferQty(Number(e.target.value))}
                            max={transferModal.batch.quantity}
                            min={1}
                        />
                    </div>

                    <button 
                        onClick={handleTransfer}
                        disabled={!targetWarehouse || transferQty <= 0 || transferQty > transferModal.batch.quantity}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
                    >
                        {t('stock.confirm_transfer')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Stock Take (Single Adjustment) Modal */}
      {stockTakeModal.isOpen && stockTakeModal.batch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-emerald-50">
                    <h3 className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5" />
                        {t('stock.inventory_count')}
                    </h3>
                    <button onClick={() => setStockTakeModal({isOpen: false, batch: null})} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="text-center">
                        <p className="text-sm text-slate-500 mb-1">{products.find(p => p.id === stockTakeModal.batch?.product_id)?.name}</p>
                        <p className="font-mono text-xs bg-slate-100 inline-block px-2 py-1 rounded">{stockTakeModal.batch.batch_number}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="block text-xs text-slate-500 uppercase font-bold mb-1">{t('stock.sys_qty')}</span>
                            <span className="text-2xl font-bold text-slate-700">{stockTakeModal.batch.quantity}</span>
                        </div>
                        <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                            <span className="block text-xs text-emerald-600 uppercase font-bold mb-1">{t('stock.diff')}</span>
                            <span className={`text-2xl font-bold ${actualQty - stockTakeModal.batch.quantity >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {actualQty - stockTakeModal.batch.quantity > 0 ? '+' : ''}{actualQty - stockTakeModal.batch.quantity}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.actual_qty')}</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xl text-center" 
                            value={actualQty} 
                            onChange={e => setActualQty(Number(e.target.value))}
                            min={0}
                            autoFocus
                        />
                    </div>

                    <button 
                        onClick={handleStockTake}
                        className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20"
                    >
                        {t('stock.adjust')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Spoilage (Damage) Modal */}
      {spoilageModal.isOpen && spoilageModal.batch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-amber-50">
                    <h3 className="font-bold text-amber-800 text-lg flex items-center gap-2">
                        <AlertOctagon className="w-5 h-5" />
                        {t('stock.spoilage')}
                    </h3>
                    <button onClick={() => setSpoilageModal({isOpen: false, batch: null})} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="bg-amber-50/50 p-4 rounded-xl text-sm text-amber-900 border border-amber-100">
                        <p>{t('stock.spoilage_desc')}</p>
                        <div className="mt-2 text-xs font-bold text-amber-700">
                            Current Stock: {spoilageModal.batch.quantity}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.damaged_qty')}</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-xl text-red-600" 
                            value={damagedQty} 
                            onChange={e => setDamagedQty(Number(e.target.value))}
                            min={1}
                            max={spoilageModal.batch.quantity}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.reason')}</label>
                        <textarea 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                            placeholder="e.g. Broken in transit, Expired..." 
                            rows={2}
                        />
                    </div>

                    <button 
                        onClick={handleSpoilageReport}
                        disabled={damagedQty <= 0 || damagedQty > spoilageModal.batch.quantity}
                        className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-bold hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-900/20"
                    >
                        {t('stock.confirm_spoilage')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Manual Add Product Modal */}
      {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-5 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          <PackagePlus className="w-5 h-5 text-blue-500" />
                          {t('prod.new_title')}
                      </h3>
                      <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-8 space-y-6 overflow-y-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('prod.name')}</label>
                                <input className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="e.g. Panadol Extra 500mg" autoFocus />
                          </div>
                          <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('prod.code')}</label>
                                <input className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={addForm.code} onChange={e => setAddForm({...addForm, code: e.target.value})} placeholder="e.g. 1001" />
                          </div>
                          <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.batch')}</label>
                                <input className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={addForm.batch_number} onChange={e => setAddForm({...addForm, batch_number: e.target.value})} placeholder="e.g. B-2024-001" />
                          </div>
                          
                          {/* New Package Info */}
                          <div className="col-span-2 grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('prod.pkg_type')}</label>
                                  <input 
                                    className="w-full border border-slate-300 p-2 rounded-lg text-sm" 
                                    placeholder="e.g. Carton, Box"
                                    value={addForm.package_type}
                                    onChange={e => setAddForm({...addForm, package_type: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('prod.pkg_items')}</label>
                                  <input 
                                    type="number"
                                    className="w-full border border-slate-300 p-2 rounded-lg text-sm" 
                                    placeholder="e.g. 12, 20"
                                    value={addForm.items_per_package || ''}
                                    onChange={e => setAddForm({...addForm, items_per_package: +e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="h-px bg-slate-100 col-span-1 md:col-span-2 my-2"></div>

                          <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.qty')}</label>
                                <input type="number" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.quantity} onChange={e => setAddForm({...addForm, quantity: +e.target.value})} />
                          </div>
                          <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.expiry')}</label>
                                <input type="date" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.expiry_date} onChange={e => setAddForm({...addForm, expiry_date: e.target.value})} />
                          </div>
                           <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.cost')}</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">{currency}</span>
                                    <input type="number" className="w-full border border-slate-200 p-3 pl-8 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.purchase_price} onChange={e => setAddForm({...addForm, purchase_price: +e.target.value})} />
                                </div>
                          </div>
                          <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.price')}</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-400 font-bold">{currency}</span>
                                    <input type="number" className="w-full border border-slate-200 p-3 pl-8 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" value={addForm.selling_price} onChange={e => setAddForm({...addForm, selling_price: +e.target.value})} />
                                </div>
                          </div>
                      </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button onClick={() => setIsAddOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors">{t('common.cancel')}</button>
                        <button onClick={handleManualAdd} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95">{t('set.save')}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Stock History Modal */}
      {historyModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center p-5 border-b border-slate-100">
                      <div>
                          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                              <History className="w-5 h-5 text-blue-600" />
                              {t('stock.card_item')}
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">
                              {products.find(p => p.id === historyModal.productId)?.name}
                          </p>
                      </div>
                      <button onClick={() => setHistoryModal({isOpen: false, productId: null, logs: []})} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-0">
                      <table className="w-full text-sm text-left rtl:text-right">
                          <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0">
                              <tr>
                                  <th className="p-4">{t('common.date')}</th>
                                  <th className="p-4">{t('stock.hist_type')}</th>
                                  <th className="p-4">{t('stock.batch')}</th>
                                  <th className="p-4">{t('stock.warehouse')}</th>
                                  <th className="p-4 text-center">{t('stock.hist_in_out')}</th>
                                  <th className="p-4">{t('stock.hist_ref')}</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {historyModal.logs.map(log => {
                                  const whName = warehouses.find(w => w.id === log.warehouse_id)?.name || log.warehouse_id;
                                  return (
                                      <tr key={log.id} className="hover:bg-gray-50">
                                          <td className="p-4 text-gray-500 whitespace-nowrap">
                                              {new Date(log.date).toLocaleString()}
                                          </td>
                                          <td className="p-4 font-bold text-xs">
                                              <span className={`px-2 py-1 rounded border ${
                                                  log.type.includes('SALE') ? 'bg-green-50 text-green-700 border-green-100' :
                                                  log.type.includes('RETURN') ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                  log.type.includes('PURCHASE') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                  'bg-gray-50 text-gray-600 border-gray-100'
                                              }`}>
                                                  {log.type.replace('_', ' ')}
                                              </span>
                                          </td>
                                          <td className="p-4 font-mono text-xs">{log.batch_number}</td>
                                          <td className="p-4 text-gray-600">{whName}</td>
                                          <td className={`p-4 text-center font-bold ${log.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {log.quantity > 0 ? '+' : ''}{log.quantity}
                                          </td>
                                          <td className="p-4 text-xs text-gray-500 max-w-xs truncate" title={log.notes}>
                                              {log.notes || '-'}
                                              {log.reference_id && <span className="block font-mono text-[10px] text-gray-400">Ref: {log.reference_id}</span>}
                                          </td>
                                      </tr>
                                  );
                              })}
                              {historyModal.logs.length === 0 && (
                                  <tr>
                                      <td colSpan={6} className="p-8 text-center text-gray-400">No movements recorded yet.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
export default Inventory;
