
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { authService, PERMISSIONS } from '../services/auth';
import { Save, RefreshCw, Building2, FileText, Settings as SettingsIcon, Users, Plus, Edit2, Trash2, X, Shield, Key, CheckSquare, Printer, Upload, Image as ImageIcon, Database, Download, AlertTriangle, FileMinus, UserMinus, PackageMinus, Loader2 } from 'lucide-react';
import { t } from '../utils/t';

export default function Settings() {
  const [settings, setSettings] = useState(db.getSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'invoice' | 'users' | 'printer' | 'backup' | 'data'>('general');
  const [isSaving, setIsSaving] = useState(false);
  
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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
        const success = await db.updateSettings(settings);
        if (success) {
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            alert("حدث خطأ أثناء الحفظ. يرجى التحقق من الاتصال بالإنترنت.");
            setIsSaving(false);
        }
    } catch (error) {
        console.error(error);
        alert("فشل الحفظ: " + (error as Error).message);
        setIsSaving(false);
    }
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
              permissions: ['VIEW_DASHBOARD', 'MANAGE_SALES']
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
                  if (confirm("تحذير: سيؤدي ذلك لاستبدال كافة البيانات الحالية. هل أنت متأكد؟")) {
                      const success = db.importDatabase(content);
                      if (success) {
                          alert("تم استعادة البيانات بنجاح. سيتم إعادة تحميل الصفحة.");
                          window.location.reload();
                      } else {
                          alert("فشل في استعادة البيانات. صيغة الملف غير صحيحة.");
                      }
                  }
              } catch (err) {
                  alert("خطأ في قراءة الملف.");
              }
          };
          reader.readAsText(file);
      }
  };

  const handleClearTransactions = async () => {
      if(confirm(t('set.clear_trans_desc') + '\n\nهل أنت متأكد من مسح كافة الفواتير والحركات؟')) {
          await db.clearTransactions();
          alert('تم تصفير الحركات بنجاح.');
          window.location.reload();
      }
  };

  const handleClearCustomers = async () => {
      if(confirm(t('set.clear_cust_desc') + '\n\nهل أنت متأكد من حذف كافة العملاء؟')) {
          await db.clearCustomers();
          alert('تم حذف العملاء بنجاح.');
          window.location.reload();
      }
  };

  const handleClearProducts = async () => {
      if(confirm(t('set.clear_prod_desc') + '\n\nهل أنت متأكد من حذف كافة الأصناف؟')) {
          await db.clearProducts();
          alert('تم حذف الأصناف بنجاح.');
          window.location.reload();
      }
  };

  const handleResetAll = async () => {
      if(confirm(t('set.factory_desc') + '\n\nتحذير نهائي: سيتم تصفير النظام بالكامل!')) {
          await db.resetDatabase();
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('set.title')}</h1>
      </div>
      
      {/* TABS */}
      <div className="flex space-x-2 border-b border-gray-200 rtl:space-x-reverse overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <SettingsIcon className="w-4 h-4" /> {t('set.tab_general')}
          </button>
          <button onClick={() => setActiveTab('invoice')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'invoice' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <FileText className="w-4 h-4" /> {t('set.tab_invoice')}
          </button>
          <button onClick={() => setActiveTab('printer')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'printer' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <Printer className="w-4 h-4" /> {t('set.tab_printer')}
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <Users className="w-4 h-4" /> {t('set.tab_users')}
          </button>
          <button onClick={() => setActiveTab('backup')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'backup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <Database className="w-4 h-4" /> {t('set.backup_mgmt')}
          </button>
          <button onClick={() => setActiveTab('data')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'data' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <AlertTriangle className="w-4 h-4" /> {t('set.danger_zone')}
          </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2"><Building2 className="w-5 h-5" /> {t('set.company_info')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2 flex items-center gap-6 p-4 border rounded-xl bg-slate-50">
                        <div className="w-24 h-24 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                            {settings.companyLogo ? <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="w-8 h-8 text-gray-300" />}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-700 mb-1">Company Logo</h4>
                            <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                <span>Upload New Logo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('set.company_name')}</label><input className="w-full border p-2 rounded-lg" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('set.tax_no')}</label><input className="w-full border p-2 rounded-lg" value={settings.companyTaxNumber} onChange={e => setSettings({...settings, companyTaxNumber: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('set.phone')}</label><input className="w-full border p-2 rounded-lg" value={settings.companyPhone} onChange={e => setSettings({...settings, companyPhone: e.target.value})} /></div>
                    <div className="col-span-1 md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t('set.address')}</label><input className="w-full border p-2 rounded-lg" value={settings.companyAddress} onChange={e => setSettings({...settings, companyAddress: e.target.value})} /></div>
                </div>
                <div className="flex justify-end pt-4"><button onClick={handleSaveSettings} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700 disabled:bg-blue-400">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{isSaving ? "جاري الحفظ..." : t('set.save')}</button></div>
            </div>
        )}

        {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="border-b pb-4"><h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><Database className="w-5 h-5 text-blue-600" /> {t('set.backup_mgmt')}</h3><p className="text-sm text-gray-500">{t('set.backup_desc')}</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4"><Download className="w-8 h-8 text-blue-600" /></div>
                        <h4 className="font-bold text-gray-800 mb-2">{t('set.export_data')}</h4>
                        <button onClick={handleBackup} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 w-full">{t('set.download_backup')}</button>
                    </div>
                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-amber-600" /></div>
                        <h4 className="font-bold text-gray-800 mb-2">{t('set.import_data')}</h4>
                        <label className="bg-amber-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-amber-700 w-full cursor-pointer">{t('set.select_file')}<input type="file" className="hidden" accept=".json" onChange={handleRestore} /></label>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'data' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="border-b pb-4">
                    <h3 className="font-bold text-red-600 flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5" /> {t('set.danger_zone')}</h3>
                    <p className="text-sm text-gray-500">{t('set.danger_desc')}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-xl border border-red-100 bg-white flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex gap-4 mb-4">
                            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center shrink-0"><FileMinus className="w-6 h-6 text-red-600" /></div>
                            <div><h4 className="font-bold text-gray-800">{t('set.clear_trans')}</h4><p className="text-xs text-gray-500 mt-1">{t('set.clear_trans_desc')}</p></div>
                        </div>
                        <button onClick={handleClearTransactions} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 w-full">{t('set.delete_trans')}</button>
                    </div>
                    <div className="p-6 rounded-xl border border-red-100 bg-white flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex gap-4 mb-4">
                            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center shrink-0"><UserMinus className="w-6 h-6 text-red-600" /></div>
                            <div><h4 className="font-bold text-gray-800">{t('set.clear_cust')}</h4><p className="text-xs text-gray-500 mt-1">{t('set.clear_cust_desc')}</p></div>
                        </div>
                        <button onClick={handleClearCustomers} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 w-full">{t('set.delete_cust')}</button>
                    </div>
                    <div className="p-6 rounded-xl border border-red-100 bg-white flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex gap-4 mb-4">
                            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center shrink-0"><PackageMinus className="w-6 h-6 text-red-600" /></div>
                            <div><h4 className="font-bold text-gray-800">{t('set.clear_prod')}</h4><p className="text-xs text-gray-500 mt-1">{t('set.clear_prod_desc')}</p></div>
                        </div>
                        <button onClick={handleClearProducts} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 w-full">{t('set.delete_prod')}</button>
                    </div>
                    <div className="p-6 rounded-xl border-2 border-red-200 bg-red-50 flex flex-col justify-between">
                        <div className="flex gap-4 mb-4">
                            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center shrink-0"><RefreshCw className="w-6 h-6 text-white" /></div>
                            <div><h4 className="font-bold text-red-800">{t('set.factory_reset')}</h4><p className="text-xs text-red-600/80 mt-1">{t('set.factory_desc')}</p></div>
                        </div>
                        <button onClick={handleResetAll} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 shadow-lg w-full">{t('set.reset_everything')}</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
