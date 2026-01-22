import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { authService, PERMISSIONS } from '../services/auth';
import { isSupabaseConfigured } from '../services/supabase';
import { 
  Save, RefreshCw, Building2, FileText, Settings as SettingsIcon, 
  Users, Plus, Edit2, Trash2, X, Shield, Key, CheckSquare, 
  Printer, Upload, Image as ImageIcon, Database, Download, 
  AlertTriangle, FileMinus, UserMinus, PackageMinus, Loader2, 
  Monitor, Layout, FileType, CheckCircle2, XCircle, PackageCheck, Globe, Wifi, WifiOff
} from 'lucide-react';
import { t } from '../utils/t';
import { PendingAdjustment } from '../types';
// @ts-ignore
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState(db.getSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'approvals' | 'invoice' | 'users' | 'printer' | 'backup' | 'data'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingAdjustment[]>([]);
  const user = authService.getCurrentUser();
  
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
    if (activeTab === 'approvals') {
        setPendingApprovals(db.getPendingAdjustments());
    }
  }, [activeTab]);

  const handleApprove = async (id: string) => {
    if (confirm("هل أنت متأكد من اعتماد هذا التعديل؟ سيتم تغيير الرصيد الفعلي فوراً.")) {
        const success = await db.approveAdjustment(id);
        if (success) {
            setPendingApprovals(db.getPendingAdjustments());
            toast.success("تم اعتماد التسوية بنجاح");
        }
    }
  };

  const handleReject = async (id: string) => {
    if (confirm("هل تريد رفض طلب التسوية هذا؟")) {
        const success = await db.rejectAdjustment(id);
        if (success) {
            setPendingApprovals(db.getPendingAdjustments());
            toast.error("تم رفض طلب التسوية");
        }
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
        const success = await db.updateSettings(settings);
        if (success) {
            toast.success("تم حفظ الإعدادات بنجاح");
            setTimeout(() => {
                window.location.reload();
            }, 800);
        } else {
            toast.error("حدث خطأ أثناء الحفظ.");
            setIsSaving(false);
        }
    } catch (error) {
        toast.error("فشل الاتصال بالسيرفر.");
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
      if (!userForm.name || !userForm.username) return toast.error("الاسم واسم المستخدم مطلوبان");
      if (!userForm.id && !userForm.password) return toast.error("كلمة المرور مطلوبة للمستخدم الجديد");
      
      authService.saveUser(userForm);
      setUsers(authService.getUsers());
      setIsUserModalOpen(false);
      toast.success("تم حفظ بيانات المستخدم");
  };

  const handleDeleteUser = (id: string) => {
      if (confirm(t('user.delete_confirm'))) {
          authService.deleteUser(id);
          setUsers(authService.getUsers());
          toast.success("تم حذف المستخدم");
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
      toast.success("تم تحميل نسخة احتياطية بنجاح");
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
                          toast.success("تمت الاستعادة بنجاح");
                          setTimeout(() => window.location.reload(), 1000);
                      }
                  }
              } catch (err) {
                  toast.error("خطأ في قراءة الملف.");
              }
          };
          reader.readAsText(file);
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">إدارة النظام والمدير</h1>
            <div className="flex items-center gap-2 mt-1">
                {isSupabaseConfigured ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <Wifi className="w-3 h-3" /> متصل بالسحابة (Cloud Mode)
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        <WifiOff className="w-3 h-3" /> وضع محلي (Local Mode)
                    </span>
                )}
            </div>
        </div>
      </div>
      
      {/* TABS */}
      <div className="flex space-x-2 border-b border-gray-200 rtl:space-x-reverse overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <SettingsIcon className="w-4 h-4" /> {t('set.tab_general')}
          </button>
          <button onClick={() => setActiveTab('approvals')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'approvals' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <PackageCheck className="w-4 h-4" /> اعتماد الجرد
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
                            <h4 className="font-bold text-gray-700 mb-1">شعار الشركة</h4>
                            <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-2 transition-all shadow-sm">
                                <Upload className="w-4 h-4" />
                                <span>رفع شعار جديد</span>
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

        {activeTab === 'approvals' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><PackageCheck className="w-5 h-5 text-orange-600" /> مراجعة طلبات تسوية الجرد</h3>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">{pendingApprovals.length} طلب معلق</span>
                </div>
                
                <div className="border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="p-4">الصنف</th>
                                <th className="p-4 text-center">المخزن</th>
                                <th className="p-4 text-center">رصيد دفتري</th>
                                <th className="p-4 text-center">جرد فعلي</th>
                                <th className="p-4 text-center">الفرق</th>
                                <th className="p-4 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pendingApprovals.map(adj => {
                                const prod = db.getProductsWithBatches().find(p => p.id === adj.product_id);
                                const wh = db.getWarehouses().find(w => w.id === adj.warehouse_id);
                                return (
                                    <tr key={adj.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{prod?.name || 'صنف غير معروف'}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{prod?.code}</div>
                                        </td>
                                        <td className="p-4 text-center text-gray-600">{wh?.name}</td>
                                        <td className="p-4 text-center font-bold text-gray-500">{adj.system_qty}</td>
                                        <td className="p-4 text-center font-bold text-blue-600 bg-blue-50/30">{adj.actual_qty}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${adj.diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {adj.diff > 0 ? `+${adj.diff}` : adj.diff}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleApprove(adj.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-100" title="اعتماد">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleReject(adj.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100" title="رفض">
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {pendingApprovals.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-400">
                                        <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                        <p className="font-bold">لا توجد طلبات جرد بانتظار المراجعة</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'invoice' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2"><Layout className="w-5 h-5 text-blue-600" /> {t('set.select_template')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((num) => (
                        <div 
                            key={num}
                            onClick={() => setSettings({...settings, invoiceTemplate: String(num) as any})}
                            className={`cursor-pointer border-2 rounded-xl overflow-hidden transition-all relative group ${settings.invoiceTemplate === String(num) ? 'border-blue-600 shadow-md ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="bg-slate-50 h-32 flex items-center justify-center p-4">
                                <FileText className={`w-12 h-12 ${settings.invoiceTemplate === String(num) ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                            <div className="p-3 text-center font-bold text-sm bg-white border-t">نموذج {num}</div>
                            {settings.invoiceTemplate === String(num) && (
                                <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-sm"><CheckSquare className="w-4 h-4" /></div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex justify-end pt-4"><button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700"><Save className="w-4 h-4" /> {t('set.save')}</button></div>
            </div>
        )}

        {activeTab === 'printer' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2"><Printer className="w-5 h-5 text-blue-600" /> {t('set.tab_printer')}</h3>
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('set.paper_size')}</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { id: 'A4', label: t('set.paper_a4'), icon: FileType },
                            { id: 'A5', label: t('set.paper_a5'), icon: Layout },
                            { id: 'THERMAL', label: t('set.paper_thermal'), icon: Monitor }
                        ].map((paper) => (
                            <div 
                                key={paper.id}
                                onClick={() => setSettings({...settings, printerPaperSize: paper.id as any})}
                                className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${settings.printerPaperSize === paper.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
                            >
                                <div className={`p-2 rounded-lg ${settings.printerPaperSize === paper.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}><paper.icon className="w-5 h-5" /></div>
                                <span className="font-bold text-sm text-gray-700">{paper.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end pt-4"><button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700"><Save className="w-4 h-4" /> {t('set.save')}</button></div>
            </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600" /> {t('user.mgmt_title')}</h3>
                    <button onClick={() => handleOpenUserModal()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-blue-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> {t('user.add')}
                    </button>
                </div>
                
                <div className="border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="p-4">{t('user.fullname')}</th>
                                <th className="p-4">{t('user.username')}</th>
                                <th className="p-4">{t('user.role')}</th>
                                <th className="p-4 text-center">{t('common.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-gray-800">{u.name}</td>
                                    <td className="p-4 text-gray-600">@{u.username}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {u.role === 'ADMIN' ? t('role.admin') : t('role.user')}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleOpenUserModal(u)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                            {u.username !== 'admin' && (
                                                <button onClick={() => handleDeleteUser(u.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="border-b pb-4"><h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><Database className="w-5 h-5 text-blue-600" /> {t('set.backup_mgmt')}</h3><p className="text-sm text-gray-500">{t('set.backup_desc')}</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4"><Download className="w-8 h-8 text-blue-600" /></div>
                        <h4 className="font-bold text-gray-800 mb-2">{t('set.export_data')}</h4>
                        <button onClick={handleBackup} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 w-full transition-all shadow-md">{t('set.download_backup')}</button>
                    </div>
                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-amber-600" /></div>
                        <h4 className="font-bold text-gray-800 mb-2">{t('set.import_data')}</h4>
                        <label className="bg-amber-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-amber-700 w-full cursor-pointer transition-all shadow-md">{t('set.select_file')}<input type="file" className="hidden" accept=".json" onChange={handleRestore} /></label>
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
                        <button onClick={handleSaveSettings} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 w-full">فحص سلامة قاعدة البيانات</button>
                    </div>
                    <div className="p-6 rounded-xl border border-red-100 bg-white flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex gap-4 mb-4">
                            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center shrink-0"><RefreshCw className="w-6 h-6 text-white" /></div>
                            <div><h4 className="font-bold text-red-800">{t('set.factory_reset')}</h4><p className="text-xs text-red-600/80 mt-1">{t('set.factory_desc')}</p></div>
                        </div>
                        <button onClick={() => db.resetDatabase()} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 shadow-lg w-full">{t('set.reset_everything')}</button>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* User Management Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative flex flex-col max-h-[90vh]">
                <button onClick={() => setIsUserModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-blue-600" />{userForm.id ? t('user.edit') : t('user.add')}</h3>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('user.fullname')}</label><input className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('user.username')}</label><input className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('user.role')}</label><select className="w-full border p-2 rounded-lg" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})}><option value="USER">User</option><option value="ADMIN">Administrator</option><option value="TELESALES">Telesales</option><option value="REP">Sales Rep</option></select></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('user.password')} {userForm.id && <span className="text-gray-400 font-normal text-xs">(اتركه فارغاً للحفاظ على الحالي)</span>}</label><input type="password" title="password" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} /></div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> {t('user.permissions')}</h4>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 grid grid-cols-1 gap-2">
                            {PERMISSIONS.map(perm => (
                                <label key={perm.id} className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-white rounded transition-colors">
                                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" checked={userForm.role === 'ADMIN' || userForm.permissions.includes(perm.id)} disabled={userForm.role === 'ADMIN'} onChange={() => togglePermission(perm.id)} />
                                    <span className="text-sm text-gray-700">{t(`perm.${perm.id}`) !== `perm.${perm.id}` ? t(`perm.${perm.id}`) : perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="pt-4 mt-4 border-t flex justify-end gap-2">
                    <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{t('common.cancel')}</button>
                    <button onClick={handleSaveUser} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm">{t('user.save')}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}