
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { authService, PERMISSIONS } from '../services/auth';
import { Save, RefreshCw, Building2, FileText, Settings as SettingsIcon, Users, Plus, Edit2, Trash2, X, Shield, Key, CheckSquare, Printer, Upload, Image as ImageIcon, Database, Download, AlertTriangle, FileMinus, UserMinus, PackageMinus } from 'lucide-react';
import { t } from '../utils/t';

export default function Settings() {
  const [settings, setSettings] = useState(db.getSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'invoice' | 'users' | 'printer' | 'backup' | 'data'>('general');
  
  // Users Management State
  const [users, setUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ 
      id: '', name: '', username: '', password: '', role: 'USER',
      permissions: [] as string[]
  });

  useEffect(() => {
    if (activeTab === 'users') {
        setUsers(authService.getUsers());
    }
  }, [activeTab]);

  const handleSaveSettings = () => {
    db.updateSettings(settings);
    window.location.reload();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              setSettings({ ...settings, companyLogo: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleOpenUserModal = (user?: any) => {
      if (user) {
          setUserForm({ ...user, password: '', permissions: user.permissions || [] }); 
      } else {
          setUserForm({ 
              id: '', name: '', username: '', password: '', role: 'USER', 
              permissions: ['VIEW_DASHBOARD', 'MANAGE_SALES'] // Default permissions for new user
          });
      }
      setIsUserModalOpen(true);
  };

  const handleSaveUser = () => {
      if (!userForm.name || !userForm.username) return alert("Name and Username are required");
      if (!userForm.id && !userForm.password) return alert("Password is required for new users");
      
      authService.saveUser(userForm);
      setUsers(authService.getUsers());
      setIsUserModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
      if (confirm(t('user.delete_confirm'))) {
          authService.deleteUser(id);
          setUsers(authService.getUsers());
      }
  };

  const togglePermission = (permId: string) => {
      setUserForm(prev => {
          const exists = prev.permissions.includes(permId);
          if (exists) {
              return { ...prev, permissions: prev.permissions.filter(p => p !== permId) };
          } else {
              return { ...prev, permissions: [...prev.permissions, permId] };
          }
      });
  };

  // BACKUP & RESTORE LOGIC
  const handleBackup = () => {
      const data = db.exportDatabase();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mizan_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const content = event.target?.result as string;
                  if (confirm("WARNING: This will overwrite all current data. Are you sure?")) {
                      const success = db.importDatabase(content);
                      if (success) {
                          alert("Database restored successfully. The app will reload.");
                          window.location.reload();
                      } else {
                          alert("Failed to restore database. Invalid file format.");
                      }
                  }
              } catch (err) {
                  alert("Error reading file.");
              }
          };
          reader.readAsText(file);
      }
  };

  // --- DATA CLEARING HANDLERS ---
  const handleClearTransactions = () => {
      if(confirm('WARNING: This will delete ALL Invoices, Purchase Orders, and Cash movements.\nCustomer balances will reset to Opening Balance.\n\nAre you sure?')) {
          db.clearTransactions();
          alert('All transactions cleared successfully.');
          window.location.reload();
      }
  };

  const handleClearCustomers = () => {
      if(confirm('WARNING: This will delete ALL Customers database.\n\nAre you sure?')) {
          db.clearCustomers();
          alert('All customers deleted successfully.');
          window.location.reload();
      }
  };

  const handleClearProducts = () => {
      if(confirm('WARNING: This will delete ALL Products and Batches.\n\nAre you sure?')) {
          db.clearProducts();
          alert('All products deleted successfully.');
          window.location.reload();
      }
  };

  const handleResetAll = () => {
      if(confirm('CRITICAL WARNING: This will delete EVERYTHING.\nThis action cannot be undone.\n\nAre you absolutely sure?')) {
          db.resetDatabase();
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('set.title')}</h1>
      </div>
      
      {/* TABS */}
      <div className="flex space-x-2 border-b border-gray-200 rtl:space-x-reverse overflow-x-auto">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
            ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <SettingsIcon className="w-4 h-4" /> {t('set.tab_general')}
          </button>
          <button 
             onClick={() => setActiveTab('invoice')}
             className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
             ${activeTab === 'invoice' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <FileText className="w-4 h-4" /> {t('set.tab_invoice')}
          </button>
          <button 
             onClick={() => setActiveTab('printer')}
             className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
             ${activeTab === 'printer' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <Printer className="w-4 h-4" /> {t('set.tab_printer')}
          </button>
          <button 
             onClick={() => setActiveTab('users')}
             className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
             ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <Users className="w-4 h-4" /> {t('set.tab_users')}
          </button>
          <button 
             onClick={() => setActiveTab('backup')}
             className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
             ${activeTab === 'backup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <Database className="w-4 h-4" /> {t('set.backup_mgmt')}
          </button>
          <button 
             onClick={() => setActiveTab('data')}
             className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap
             ${activeTab === 'data' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             <AlertTriangle className="w-4 h-4" /> {t('set.danger_zone')}
          </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                    <Building2 className="w-5 h-5" /> {t('set.company_info')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Logo Upload */}
                    <div className="col-span-1 md:col-span-2 flex items-center gap-6 p-4 border rounded-xl bg-slate-50">
                        <div className="w-24 h-24 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                            {settings.companyLogo ? (
                                <img src={settings.companyLogo} alt="Company Logo" className="w-full h-full object-contain" />
                            ) : (
                                <ImageIcon className="w-8 h-8 text-gray-300" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-700 mb-1">Company Logo</h4>
                            <p className="text-xs text-gray-500 mb-3">Recommended size: 200x200px (PNG or JPG)</p>
                            <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                <span>Upload New Logo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                             {settings.companyLogo && (
                                <button 
                                    onClick={() => setSettings({ ...settings, companyLogo: '' })}
                                    className="ml-2 text-red-500 text-sm hover:underline"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.company_name')}</label>
                        <input 
                            className="w-full border p-2 rounded-lg"
                            value={settings.companyName}
                            onChange={e => setSettings({...settings, companyName: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.tax_no')}</label>
                        <input 
                            className="w-full border p-2 rounded-lg"
                            value={settings.companyTaxNumber}
                            onChange={e => setSettings({...settings, companyTaxNumber: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Commercial Register (س.ت)</label>
                        <input 
                            className="w-full border p-2 rounded-lg"
                            value={settings.companyCommercialRegister || ''}
                            onChange={e => setSettings({...settings, companyCommercialRegister: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.phone')}</label>
                        <input 
                            className="w-full border p-2 rounded-lg"
                            value={settings.companyPhone}
                            onChange={e => setSettings({...settings, companyPhone: e.target.value})}
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.address')}</label>
                        <input 
                            className="w-full border p-2 rounded-lg"
                            value={settings.companyAddress}
                            onChange={e => setSettings({...settings, companyAddress: e.target.value})}
                        />
                    </div>
                </div>

                <div className="border-t pt-4">
                    <h3 className="font-bold text-gray-800 mb-2">{t('set.sys_pref')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.language')}</label>
                        <select 
                            className="w-full border p-2 rounded-lg"
                            value={settings.language}
                            onChange={e => setSettings({...settings, language: e.target.value})}
                        >
                            <option value="en">English</option>
                            <option value="ar">العربية</option>
                        </select>
                        </div>

                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.currency')}</label>
                        <select 
                            className="w-full border p-2 rounded-lg"
                            value={settings.currency}
                            onChange={e => setSettings({...settings, currency: e.target.value})}
                        >
                            <option value="$">USD ($)</option>
                            <option value="ج.م">EGP (ج.م)</option>
                            <option value="ر.س">SAR (ر.س)</option>
                        </select>
                        </div>

                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.low_stock_threshold')}</label>
                        <input 
                            type="number"
                            min="0"
                            className="w-full border p-2 rounded-lg"
                            value={settings.lowStockThreshold}
                            onChange={e => setSettings({...settings, lowStockThreshold: parseInt(e.target.value) || 0})}
                        />
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end pt-4">
                    <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700">
                        <Save className="w-4 h-4" /> {t('set.save')}
                    </button>
                </div>
            </div>
        )}

        {/* INVOICE DESIGN TAB */}
        {activeTab === 'invoice' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                     {t('set.select_template')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Template 1: Classic */}
                    <div 
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${settings.invoiceTemplate === '1' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        onClick={() => setSettings({...settings, invoiceTemplate: '1'})}
                    >
                        <div className="aspect-[210/297] bg-white border border-gray-200 rounded mb-3 flex flex-col p-2 text-[5px] text-gray-400 overflow-hidden shadow-sm">
                             <div className="flex justify-between mb-2 pb-1 border-b">
                                <div className="w-1/2 h-2 bg-gray-300 rounded"></div>
                                <div className="w-1/4 h-2 bg-gray-200 rounded"></div>
                             </div>
                             <div className="space-y-1 mb-2">
                                <div className="w-full h-1 bg-gray-100"></div>
                                <div className="w-full h-1 bg-gray-100"></div>
                             </div>
                             <div className="flex-1 border rounded p-1">
                                <div className="flex gap-1 mb-1 bg-gray-100 p-0.5">
                                    <div className="w-1/4 h-1 bg-gray-300"></div>
                                    <div className="w-1/4 h-1 bg-gray-300"></div>
                                    <div className="w-1/4 h-1 bg-gray-300"></div>
                                    <div className="w-1/4 h-1 bg-gray-300"></div>
                                </div>
                             </div>
                        </div>
                        <h4 className="font-bold text-center text-gray-700">1. Classic</h4>
                    </div>

                    {/* Template 2: Modern */}
                    <div 
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${settings.invoiceTemplate === '2' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        onClick={() => setSettings({...settings, invoiceTemplate: '2'})}
                    >
                        <div className="aspect-[210/297] bg-white border border-gray-200 rounded mb-3 flex flex-col text-[5px] text-gray-400 overflow-hidden shadow-sm">
                             <div className="bg-slate-800 h-6 w-full mb-2 flex items-center px-2">
                                 <div className="w-1/2 h-2 bg-white/20 rounded"></div>
                             </div>
                             <div className="px-2 flex-1">
                                <div className="flex gap-1 mb-1 bg-blue-500 p-0.5 text-white">
                                    <div className="w-1/4 h-1 bg-white/50"></div>
                                    <div className="w-1/4 h-1 bg-white/50"></div>
                                    <div className="w-1/4 h-1 bg-white/50"></div>
                                    <div className="w-1/4 h-1 bg-white/50"></div>
                                </div>
                                <div className="space-y-1">
                                    <div className="w-full h-1 bg-blue-50"></div>
                                    <div className="w-full h-1 bg-white"></div>
                                    <div className="w-full h-1 bg-blue-50"></div>
                                </div>
                             </div>
                        </div>
                        <h4 className="font-bold text-center text-gray-700">2. Modern Blue</h4>
                    </div>

                    {/* Template 3: Simple */}
                    <div 
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${settings.invoiceTemplate === '3' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        onClick={() => setSettings({...settings, invoiceTemplate: '3'})}
                    >
                        <div className="aspect-[210/297] bg-white border border-gray-200 rounded mb-3 flex flex-col p-2 text-[5px] text-gray-400 overflow-hidden shadow-sm">
                             <div className="border border-black h-full p-1 flex flex-col">
                                <div className="text-center border-b border-black pb-1 mb-1">
                                    <div className="w-1/2 h-2 bg-black mx-auto rounded"></div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex gap-1 mb-1 border-b border-black pb-0.5">
                                        <div className="w-1/4 h-1 bg-gray-500"></div>
                                        <div className="w-1/4 h-1 bg-gray-500"></div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="w-full h-1 border-b border-gray-100"></div>
                                        <div className="w-full h-1 border-b border-gray-100"></div>
                                    </div>
                                </div>
                             </div>
                        </div>
                        <h4 className="font-bold text-center text-gray-700">3. Official Border</h4>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700">
                        <Save className="w-4 h-4" /> {t('set.save')}
                    </button>
                </div>
            </div>
        )}

        {/* PRINTER SETTINGS TAB */}
        {activeTab === 'printer' && (
             <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                     <Printer className="w-5 h-5" /> {t('set.paper_size')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* A4 */}
                    <div 
                        className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-md flex flex-col items-center justify-center gap-4 text-center ${settings.printerPaperSize === 'A4' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        onClick={() => setSettings({...settings, printerPaperSize: 'A4'})}
                    >
                        <div className="w-20 h-28 bg-white border border-gray-400 shadow-sm flex items-center justify-center text-xs text-gray-500 font-bold">A4</div>
                        <div>
                            <h4 className="font-bold text-gray-800">{t('set.paper_a4')}</h4>
                            <p className="text-xs text-gray-500 mt-1">210mm x 297mm</p>
                        </div>
                    </div>

                    {/* A5 */}
                    <div 
                        className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-md flex flex-col items-center justify-center gap-4 text-center ${settings.printerPaperSize === 'A5' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        onClick={() => setSettings({...settings, printerPaperSize: 'A5'})}
                    >
                         <div className="w-20 h-14 bg-white border border-gray-400 shadow-sm flex items-center justify-center text-xs text-gray-500 font-bold">A5</div>
                         <div>
                            <h4 className="font-bold text-gray-800">{t('set.paper_a5')}</h4>
                            <p className="text-xs text-gray-500 mt-1">148mm x 210mm</p>
                        </div>
                    </div>

                    {/* Thermal */}
                    <div 
                        className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-md flex flex-col items-center justify-center gap-4 text-center ${settings.printerPaperSize === 'THERMAL' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        onClick={() => setSettings({...settings, printerPaperSize: 'THERMAL'})}
                    >
                         <div className="w-12 h-28 bg-white border border-gray-400 shadow-sm flex flex-col p-1 gap-1 items-center">
                             <div className="w-full h-1 bg-gray-300"></div>
                             <div className="w-full h-1 bg-gray-300"></div>
                             <div className="w-full h-1 bg-gray-300"></div>
                         </div>
                         <div>
                            <h4 className="font-bold text-gray-800">{t('set.paper_thermal')}</h4>
                            <p className="text-xs text-gray-500 mt-1">80mm Roll</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700">
                        <Save className="w-4 h-4" /> {t('set.save')}
                    </button>
                </div>
             </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-5 h-5" /> {t('user.mgmt_title')}
                    </h3>
                    <button 
                        onClick={() => handleOpenUserModal()} 
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" /> {t('user.add')}
                    </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm text-left rtl:text-right min-w-[600px]">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">{t('common.user')}</th>
                                <th className="px-6 py-3">{t('user.role')}</th>
                                <th className="px-6 py-3 text-center">{t('user.permissions')}</th>
                                <th className="px-6 py-3 text-center">{t('common.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                {u.avatar || u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800">{u.name}</div>
                                                <div className="text-xs text-gray-500">@{u.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium 
                                            ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                            <Shield className="w-3 h-3" />
                                            {u.role === 'ADMIN' ? t('role.admin') : t('role.user')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">
                                            {u.role === 'ADMIN' ? 'ALL ACCESS' : `${u.permissions?.length || 0} Permissions`}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleOpenUserModal(u)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {/* Prevent deleting own user or the last admin if needed - for now just basic confirm */}
                                            <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* USER MODAL */}
                {isUserModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative flex flex-col max-h-[90vh]">
                            <button onClick={() => setIsUserModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                {userForm.id ? t('user.edit') : t('user.add')}
                            </h3>
                            
                            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('user.fullname')}</label>
                                        <input 
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. John Doe"
                                            value={userForm.name}
                                            onChange={e => setUserForm({...userForm, name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('user.username')}</label>
                                        <input 
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. john"
                                            value={userForm.username}
                                            onChange={e => setUserForm({...userForm, username: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Key className="w-3 h-3" /> {t('user.password')} {userForm.id && <span className="text-gray-400 font-normal text-xs">(Blank to keep)</span>}
                                        </label>
                                        <input 
                                            type="password"
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="••••••••"
                                            value={userForm.password}
                                            onChange={e => setUserForm({...userForm, password: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('user.role')}</label>
                                        <select 
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={userForm.role}
                                            onChange={e => {
                                                const newRole = e.target.value;
                                                let newPerms = userForm.permissions;
                                                if (newRole === 'ADMIN') {
                                                    newPerms = PERMISSIONS.map(p => p.id);
                                                }
                                                setUserForm({...userForm, role: newRole, permissions: newPerms});
                                            }}
                                        >
                                            <option value="USER">{t('role.user')}</option>
                                            <option value="ADMIN">{t('role.admin')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <CheckSquare className="w-4 h-4" /> {t('user.permissions')}
                                    </h4>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {PERMISSIONS.map(perm => (
                                            <label key={perm.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                    userForm.permissions.includes(perm.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'
                                                }`}>
                                                    {userForm.permissions.includes(perm.id) && <CheckSquare className="w-3.5 h-3.5" />}
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    className="hidden"
                                                    checked={userForm.permissions.includes(perm.id)}
                                                    onChange={() => togglePermission(perm.id)}
                                                />
                                                <span className={`text-sm ${userForm.permissions.includes(perm.id) ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                                    {t(`perm.${perm.id}`)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 mt-4 border-t">
                                <button 
                                    onClick={handleSaveUser}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors"
                                >
                                    {t('user.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* BACKUP TAB */}
        {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="border-b pb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
                        <Database className="w-5 h-5 text-blue-600" /> {t('set.backup_mgmt')}
                    </h3>
                    <p className="text-sm text-gray-500">{t('set.backup_desc')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <Download className="w-8 h-8 text-blue-600" />
                        </div>
                        <h4 className="font-bold text-gray-800 mb-2">{t('set.export_data')}</h4>
                        <p className="text-xs text-gray-500 mb-6">{t('set.export_desc')}</p>
                        <button 
                            onClick={handleBackup}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 w-full"
                        >
                            {t('set.download_backup')}
                        </button>
                    </div>

                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                            <Upload className="w-8 h-8 text-amber-600" />
                        </div>
                        <h4 className="font-bold text-gray-800 mb-2">{t('set.import_data')}</h4>
                        <p className="text-xs text-gray-500 mb-6">{t('set.import_desc')}</p>
                        <label className="bg-amber-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-amber-700 shadow-lg shadow-amber-500/20 w-full cursor-pointer">
                            {t('set.select_file')}
                            <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
                        </label>
                    </div>
                </div>
            </div>
        )}

        {/* DATA MANAGEMENT TAB (Danger Zone) */}
        {activeTab === 'data' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="border-b pb-4 border-red-200">
                    <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5" /> {t('set.danger_zone')}
                    </h3>
                    <p className="text-sm text-red-600/80">
                        {t('set.danger_desc')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Clear Transactions */}
                    <div className="bg-white border border-red-100 p-5 rounded-xl flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-red-700">
                                <FileMinus className="w-5 h-5" />
                                <h4 className="font-bold">{t('set.clear_trans')}</h4>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                {t('set.clear_trans_desc')}
                            </p>
                        </div>
                        <button 
                            onClick={handleClearTransactions}
                            className="w-full bg-red-50 text-red-700 border border-red-200 py-2 rounded-lg font-bold hover:bg-red-100 transition-colors"
                        >
                            {t('set.delete_trans')}
                        </button>
                    </div>

                    {/* Clear Customers */}
                    <div className="bg-white border border-red-100 p-5 rounded-xl flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-red-700">
                                <UserMinus className="w-5 h-5" />
                                <h4 className="font-bold">{t('set.clear_cust')}</h4>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                {t('set.clear_cust_desc')}
                            </p>
                        </div>
                        <button 
                            onClick={handleClearCustomers}
                            className="w-full bg-red-50 text-red-700 border border-red-200 py-2 rounded-lg font-bold hover:bg-red-100 transition-colors"
                        >
                            {t('set.delete_cust')}
                        </button>
                    </div>

                    {/* Clear Products */}
                    <div className="bg-white border border-red-100 p-5 rounded-xl flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-red-700">
                                <PackageMinus className="w-5 h-5" />
                                <h4 className="font-bold">{t('set.clear_prod')}</h4>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                {t('set.clear_prod_desc')}
                            </p>
                        </div>
                        <button 
                            onClick={handleClearProducts}
                            className="w-full bg-red-50 text-red-700 border border-red-200 py-2 rounded-lg font-bold hover:bg-red-100 transition-colors"
                        >
                            {t('set.delete_prod')}
                        </button>
                    </div>

                    {/* Reset ALL */}
                    <div className="bg-red-50 border border-red-200 p-5 rounded-xl flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-red-800">
                                <RefreshCw className="w-5 h-5" />
                                <h4 className="font-bold">{t('set.factory_reset')}</h4>
                            </div>
                            <p className="text-xs text-red-700 mb-4">
                                {t('set.factory_desc')}
                            </p>
                        </div>
                        <button 
                            onClick={handleResetAll}
                            className="w-full bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm"
                        >
                            {t('set.reset_everything')}
                        </button>
                    </div>

                </div>
            </div>
        )}
      </div>
    </div>
  );
}
