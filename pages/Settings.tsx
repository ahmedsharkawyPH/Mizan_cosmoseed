
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { authService, PERMISSIONS } from '../services/auth';
import { isSupabaseConfigured } from '../services/supabase';
import { 
  Save, RefreshCw, Building2, FileText, Settings as SettingsIcon, 
  Users, Plus, Edit2, Trash2, X, Shield, Key, CheckSquare, 
  Printer, Upload, Image as ImageIcon, Database, Download, 
  AlertTriangle, FileMinus, UserMinus, PackageMinus, Loader2, 
  Monitor, Layout, FileType, CheckCircle2, XCircle, PackageCheck, Globe, Wifi, WifiOff, RefreshCcw,
  BadgeInfo, Store, Coins, LayoutDashboard, Eraser, ShoppingBag, ShoppingCart, RotateCcw, Wallet
} from 'lucide-react';
import { t } from '../utils/t';
import { PendingAdjustment, Warehouse } from '../types';
// @ts-ignore
import toast from 'react-hot-toast';

const AdminStatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white shadow-sm`}>
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
            <p className="text-lg font-black text-slate-800">{value}</p>
        </div>
    </div>
);

export default function Settings() {
  const [settings, setSettings] = useState(db.getSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'approvals' | 'invoice' | 'users' | 'printer' | 'backup' | 'data'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingAdjustment[]>([]);
  const user = authService.getCurrentUser();
  
  const [users, setUsers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseReset, setSelectedWarehouseReset] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ 
      id: '', name: '', username: '', password: '', role: 'USER',
      permissions: [] as string[]
  });

  useEffect(() => {
    if (activeTab === 'users') { setUsers(authService.getUsers()); }
    if (activeTab === 'approvals') { setPendingApprovals(db.getPendingAdjustments()); }
    if (activeTab === 'data') {
        const whs = db.getWarehouses();
        setWarehouses(whs);
        if (whs.length > 0) setSelectedWarehouseReset(whs[0].id);
    }
  }, [activeTab]);

  const stats = useMemo(() => {
      return {
          usersCount: authService.getUsers().length,
          warehouseCount: db.getWarehouses().length,
          currency: db.getSettings().currency || 'LE',
          itemsCount: db.getProductsWithBatches().length
      };
  }, []);

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
            setTimeout(() => { window.location.reload(); }, 800);
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
          const hasIt = prev.permissions.includes(permId);
          return { ...prev, permissions: hasIt ? prev.permissions.filter(p => p !== permId) : [...prev.permissions, permId] };
      });
  };

  const handleBackup = () => {
      const data = db.exportDbData();
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
                      db.importDbData(content).then(success => {
                          if (success) {
                              toast.success("تمت الاستعادة بنجاح");
                              setTimeout(() => window.location.reload(), 1000);
                          }
                      });
                  }
              } catch (err) { toast.error("خطأ في قراءة الملف."); }
          };
          reader.readAsText(file);
      }
  };

  const handleClearSales = async () => {
      if (confirm("تحذير نهائي: هل أنت متأكد من مسح كافة حركات وفواتير المبيعات؟ هذا الإجراء لا يمكن التراجع عنه وسيؤثر على أرصدة العملاء.")) {
          await db.clearAllSales();
          toast.success("تم مسح كافة سجلات المبيعات");
      }
  };

  const handleResetCustomerAccounts = async () => {
      if (confirm("تحذير: سيتم مسح كافة فواتير المبيعات وحركات تحصيل النقدية، وتصفير أرصدة كافة العملاء الحالية. هل أنت متأكد؟ (العملاء سيبقون مسجلين بالأسماء فقط)")) {
          await db.resetCustomerAccounts();
          toast.success("تم تصفير حسابات العملاء بالكامل");
      }
  };

  const handleClearPurchases = async () => {
      if (confirm("تحذير نهائي: هل أنت متأكد من مسح كافة حركات وفواتير المشتريات؟ سيؤدي ذلك لفقدان تاريخ الشراء وتكاليف الأصناف.")) {
          await db.clearAllPurchases();
          toast.success("تم مسح كافة سجلات المشتريات");
      }
  };

  const handleClearOrders = async () => {
      if (confirm("هل تريد مسح كافة طلبات الشراء المسودة والملغاة؟")) {
          await db.clearAllOrders();
          toast.success("تم مسح كافة طلبات الشراء");
      }
  };

  const handleResetCash = async () => {
      if (confirm("تحذير: سيتم تصفير الخزينة ومسح كافة حركات القبض والصرف (بما في ذلك دفعات العملاء والموردين). هل أنت متأكد؟")) {
          await db.resetCashRegister();
          toast.success("تم تصفير سجل الخزينة بنجاح");
      }
  };

  const handleClearWarehouseStock = async () => {
      const whName = warehouses.find(w => w.id === selectedWarehouseReset)?.name;
      if (confirm(`تحذير: هل أنت متأكد من مسح كافة المنتجات (الأرصدة) داخل مخزن "${whName}"؟ سيتم تصفير الكميات تماماً.`)) {
          await db.clearWarehouseStock(selectedWarehouseReset);
          toast.success(`تم تصفير مخزن ${whName} بنجاح`);
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-600" />
                {t('set.page_title')}
            </h1>
            <div className="flex items-center gap-2 mt-2">
                {isSupabaseConfigured ? (
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-black bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-tighter">
                        <Wifi className="w-3 h-3" /> متصل بالسحابة (Cloud Mode)
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-black bg-amber-50 px-3 py-1 rounded-full border border-amber-100 uppercase tracking-tighter">
                        <WifiOff className="w-3 h-3" /> وضع محلي (Local Mode)
                    </span>
                )}
            </div>
        </div>
      </div>

      {/* Admin Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AdminStatCard title="المستخدمين" value={stats.usersCount} icon={Users} color="bg-blue-600" />
          <AdminStatCard title="المخازن" value={stats.warehouseCount} icon={Store} color="bg-indigo-600" />
          <AdminStatCard title="الأصناف" value={stats.itemsCount} icon={PackageCheck} color="bg-emerald-600" />
          <AdminStatCard title="العملة" value={stats.currency} icon={Coins} color="bg-amber-600" />
      </div>
      
      {/* Tabs Navigation */}
      <div className="flex space-x-2 border-b border-slate-200 rtl:space-x-reverse overflow-x-auto pb-px scrollbar-hide">
          <button onClick={() => setActiveTab('general')} className={`px-6 py-4 text-sm font-black border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
             <SettingsIcon className="w-4 h-4" /> {t('set.tab_general')}
          </button>
          <button onClick={() => setActiveTab('approvals')} className={`px-6 py-4 text-sm font-black border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'approvals' ? 'border-orange-600 text-orange-600 bg-orange-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
             <PackageCheck className="w-4 h-4" /> {t('set.tab_approvals')}
          </button>
          <button onClick={() => setActiveTab('invoice')} className={`px-6 py-4 text-sm font-black border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'invoice' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
             <Layout className="w-4 h-4" /> {t('set.tab_invoice')}
          </button>
          <button onClick={() => setActiveTab('printer')} className={`px-6 py-4 text-sm font-black border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'printer' ? 'border-slate-800 text-slate-800 bg-slate-100' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
             <Printer className="w-4 h-4" /> {t('set.tab_printer')}
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-4 text-sm font-black border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'border-purple-600 text-purple-600 bg-purple-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
             <Shield className="w-4 h-4" /> {t('set.tab_users')}
          </button>
          <button onClick={() => setActiveTab('backup')} className={`px-6 py-4 text-sm font-black border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'backup' ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
             <Database className="w-4 h-4" /> {t('set.backup_mgmt')}
          </button>
          <button onClick={() => setActiveTab('data')} className={`px-6 py-4 text-sm font-black border-b-4 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'data' ? 'border-red-600 text-red-600 bg-red-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
             <AlertTriangle className="w-4 h-4" /> {t('set.danger_zone')}
          </button>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-card border border-slate-100 min-h-[450px]">
        {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 border-b pb-4 border-slate-50">
                    <Building2 className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-black text-slate-800">{t('set.company_info')}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row items-center gap-8 p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-2xl border-4 border-white bg-white shadow-xl flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300">
                                {settings.companyLogo ? <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="w-10 h-10 text-slate-200" />}
                            </div>
                            <label htmlFor="company_logo_input" className="absolute -bottom-2 -right-2 cursor-pointer bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-all border-2 border-white">
                                <Plus className="w-4 h-4" />
                                <input id="company_logo_input" name="company_logo" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                        </div>
                        <div className="flex-1 text-center md:text-right">
                            <h4 className="text-lg font-black text-slate-800 mb-2">شعار المنشأة</h4>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed mb-4">يظهر هذا الشعار في الجزء العلوي من الفاتورة وكشوفات الحساب. يفضل استخدام صورة بخلفية شفافة وبأبعاد مربعة.</p>
                            <button onClick={() => setSettings({...settings, companyLogo: ''})} className="text-[10px] font-black text-red-500 uppercase hover:underline">حذف الشعار الحالي</button>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="set_comp_name" className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t('set.company_name')}</label>
                            <input id="set_comp_name" name="set_comp_name" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 outline-none font-bold transition-all" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="set_comp_tax" className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t('set.tax_no')}</label>
                            <input id="set_comp_tax" name="set_comp_tax" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 outline-none font-mono transition-all" value={settings.companyTaxNumber} onChange={e => setSettings({...settings, companyTaxNumber: e.target.value})} />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="set_comp_phone" className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t('set.phone')}</label>
                            <input id="set_comp_phone" name="set_comp_phone" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 outline-none font-bold transition-all" value={settings.companyPhone} onChange={e => setSettings({...settings, companyPhone: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="set_comp_address" className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t('set.address')}</label>
                            <input id="set_comp_address" name="set_comp_address" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 outline-none font-bold transition-all" value={settings.companyAddress} onChange={e => setSettings({...settings, companyAddress: e.target.value})} />
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end pt-8 border-t border-slate-50">
                    <button onClick={handleSaveSettings} disabled={isSaving} className="bg-slate-900 text-white px-10 py-4 rounded-2xl flex items-center gap-3 shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all active:scale-95 disabled:bg-slate-400 font-black">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSaving ? "جاري الحفظ..." : t('set.save')}
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'approvals' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center border-b pb-4 border-slate-50">
                    <div className="flex items-center gap-3">
                        <PackageCheck className="w-6 h-6 text-orange-600" />
                        <h3 className="text-xl font-black text-slate-800">مراجعة واعتماد تسويات الجرد</h3>
                    </div>
                    <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-3 py-1 rounded-full uppercase tracking-tighter">
                        {pendingApprovals.length} طلبات معلقة
                    </span>
                </div>
                
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                            <tr>
                                <th className="p-6">الصنف</th>
                                <th className="p-6 text-center">المخزن</th>
                                <th className="p-6 text-center">الرصيد الدفتري</th>
                                <th className="p-6 text-center">الجرد الفعلي</th>
                                <th className="p-6 text-center">الفرق</th>
                                <th className="p-6 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pendingApprovals.map(adj => {
                                const prod = db.getProductsWithBatches().find(p => p.id === adj.product_id);
                                const wh = db.getWarehouses().find(w => w.id === adj.warehouse_id);
                                return (
                                    <tr key={adj.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-6">
                                            <div className="font-black text-slate-800">{prod?.name || 'صنف غير معروف'}</div>
                                            <div className="text-[10px] text-slate-400 font-mono mt-1 tracking-widest">{prod?.code}</div>
                                        </td>
                                        <td className="p-6 text-center text-slate-600 font-bold">{wh?.name}</td>
                                        <td className="p-6 text-center font-black text-slate-400">{adj.system_qty}</td>
                                        <td className="p-6 text-center font-black text-blue-600 bg-blue-50/20">{adj.actual_qty}</td>
                                        <td className="p-6 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black ${adj.diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {adj.diff > 0 ? `+${adj.diff}` : adj.diff}
                                            </span>
                                        </td>
                                        <td className="p-6 text-center">
                                            <div className="flex justify-center gap-3">
                                                <button onClick={() => handleApprove(adj.id)} className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-emerald-100 shadow-sm" title="اعتماد">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleReject(adj.id)} className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all border border-red-100 shadow-sm" title="رفض">
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {pendingApprovals.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-20 text-center text-slate-300">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 className="w-10 h-10 opacity-20" />
                                        </div>
                                        <p className="font-black">لا توجد طلبات جرد بانتظار المراجعة</p>
                                        <p className="text-xs mt-1">كافة أرصدة المخازن مطابقة للدفتري</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'invoice' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 border-b pb-4 border-slate-50">
                    <Layout className="w-6 h-6 text-indigo-600" />
                    <h3 className="text-xl font-black text-slate-800">{t('set.select_template')}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[1, 2, 3].map((num) => (
                        <div 
                            key={num}
                            onClick={() => setSettings({...settings, invoiceTemplate: String(num) as any})}
                            className={`cursor-pointer border-2 rounded-3xl overflow-hidden transition-all relative group h-64 flex flex-col ${settings.invoiceTemplate === String(num) ? 'border-indigo-600 shadow-2xl ring-8 ring-indigo-50 shadow-indigo-100 scale-105' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                            <div className="bg-slate-50 flex-1 flex items-center justify-center p-8">
                                <FileText className={`w-16 h-16 ${settings.invoiceTemplate === String(num) ? 'text-indigo-600' : 'text-slate-300'}`} />
                            </div>
                            <div className="p-4 text-center font-black text-sm bg-white border-t border-slate-50 uppercase tracking-widest">
                                النموذج رقم {num}
                            </div>
                            {settings.invoiceTemplate === String(num) && (
                                <div className="absolute top-4 right-4 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg"><CheckSquare className="w-5 h-5" /></div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex justify-end pt-8 border-t border-slate-50">
                    <button onClick={handleSaveSettings} className="bg-slate-900 text-white px-10 py-4 rounded-2xl flex items-center gap-3 shadow-xl hover:bg-indigo-600 transition-all font-black">
                        <Save className="w-5 h-5" /> {t('set.save')}
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'printer' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 border-b pb-4 border-slate-50">
                    <Printer className="w-6 h-6 text-slate-800" />
                    <h3 className="text-xl font-black text-slate-800">{t('set.tab_printer')}</h3>
                </div>
                
                <div className="space-y-6">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{t('set.paper_size')}</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { id: 'A4', label: t('set.paper_a4'), icon: FileType, desc: 'للفواتير الرسمية الكبيرة' },
                            { id: 'A5', label: t('set.paper_a5'), icon: Layout, desc: 'فواتير متوسطة الحجم' },
                            { id: 'THERMAL', label: t('set.paper_thermal'), icon: Monitor, desc: 'طابعة الكاشير السريعة' },
                            { id: 'THERMAL_58', label: t('set.paper_thermal_58'), icon: Monitor, desc: 'طابعة صغيرة 58 ملم' }
                        ].map((paper) => (
                            <div 
                                key={paper.id}
                                onClick={() => setSettings({...settings, printerPaperSize: paper.id as any})}
                                className={`flex items-center gap-5 p-5 border-2 rounded-2xl cursor-pointer transition-all ${settings.printerPaperSize === paper.id ? 'border-slate-800 bg-slate-50 ring-4 ring-slate-100' : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200'}`}
                            >
                                <div className={`p-3 rounded-xl ${settings.printerPaperSize === paper.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <paper.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="font-black text-sm text-slate-800 block">{paper.label}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{paper.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end pt-8 border-t border-slate-50">
                    <button onClick={handleSaveSettings} className="bg-slate-900 text-white px-10 py-4 rounded-2xl flex items-center gap-3 shadow-xl hover:bg-blue-600 transition-all font-black">
                        <Save className="w-5 h-5" /> {t('set.save')}
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center border-b pb-4 border-slate-50">
                    <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-purple-600" />
                        <h3 className="text-xl font-black text-slate-800">{t('user.mgmt_title')}</h3>
                    </div>
                    <button onClick={() => handleOpenUserModal()} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 active:scale-95">
                        <Plus className="w-4 h-4" /> {t('user.add')}
                    </button>
                </div>
                
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] border-b border-slate-100">
                            <tr>
                                <th className="p-6">الموظف</th>
                                <th className="p-6">اسم الدخول</th>
                                <th className="p-6">الدور الوظيفي</th>
                                <th className="p-6 text-center">{t('common.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-6 font-black text-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs border border-white shadow-sm">
                                                {u.name.charAt(0)}
                                            </div>
                                            {u.name}
                                        </div>
                                    </td>
                                    <td className="p-6 text-slate-500 font-mono text-xs">@{u.username}</td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {u.role === 'ADMIN' ? t('role.admin') : t('role.user')}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex justify-center gap-3">
                                            <button onClick={() => handleOpenUserModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                            {u.username !== 'admin' && (
                                                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
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
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex flex-col gap-2 border-b pb-4 border-slate-50">
                    <div className="flex items-center gap-3">
                        <Database className="w-6 h-6 text-emerald-600" />
                        <h3 className="text-xl font-black text-slate-800">{t('set.backup_mgmt')}</h3>
                    </div>
                    <p className="text-xs text-slate-400 font-bold max-w-2xl">{t('set.backup_desc')}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-emerald-50/50 p-8 rounded-3xl border-2 border-dashed border-emerald-200 flex flex-col items-center text-center group hover:bg-emerald-50 transition-all">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Download className="w-10 h-10 text-emerald-600" /></div>
                        <h4 className="text-lg font-black text-emerald-900 mb-2">{t('set.export_data')}</h4>
                        <p className="text-xs text-emerald-600/70 font-bold mb-8">قم بتنزيل ملف يحتوي على كافة بيانات النظام في جهازك.</p>
                        <button onClick={handleBackup} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-700 w-full transition-all shadow-xl shadow-emerald-100 active:scale-95">{t('set.download_backup')}</button>
                    </div>
                    
                    <div className="bg-blue-50/50 p-8 rounded-3xl border-2 border-dashed border-blue-200 flex flex-col items-center text-center group hover:bg-blue-50 transition-all">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Upload className="w-10 h-10 text-blue-600" /></div>
                        <h4 className="text-lg font-black text-blue-900 mb-2">{t('set.import_data')}</h4>
                        <p className="text-xs text-blue-600/70 font-bold mb-8">استعد بياناتك من ملف قمت بتحميله مسبقاً.</p>
                        <label htmlFor="restore_file_input" className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-blue-700 w-full cursor-pointer transition-all shadow-xl shadow-blue-100 text-center active:scale-95">
                            {t('set.select_file')}
                            <input id="restore_file_input" name="restore_file" type="file" className="hidden" accept=".json" onChange={handleRestore} />
                        </label>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'data' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 pb-10">
                <div className="flex flex-col gap-2 border-b pb-4 border-slate-50">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                        <h3 className="text-2xl font-black text-red-600">{t('set.danger_zone')}</h3>
                    </div>
                    <p className="text-sm text-slate-500 font-bold max-w-2xl">تحذير: العمليات التالية تؤدي لحذف البيانات نهائياً من النظام والسحابة. لا يمكن التراجع!</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. مسح المبيعات */}
                    <div className="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-red-200 transition-all group flex flex-col justify-between shadow-sm">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><ShoppingCart className="w-6 h-6" /></div>
                            <h4 className="font-black text-slate-800 text-base mb-2">تطهير سجل المبيعات</h4>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">حذف كافة فواتير المبيعات والمرتجعات المسجلة دون تصفير أرصدة العملاء.</p>
                        </div>
                        <button onClick={handleClearSales} className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                            <Eraser className="w-4 h-4" /> مسح الفواتير
                        </button>
                    </div>

                    {/* NEW: تصفير حسابات العملاء */}
                    <div className="p-6 rounded-3xl border-4 border-red-100 bg-red-50/50 hover:border-red-300 transition-all group flex flex-col justify-between shadow-sm">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-red-200"><UserMinus className="w-6 h-6" /></div>
                            <h4 className="font-black text-red-900 text-base mb-2">تصفير حسابات العملاء</h4>
                            <p className="text-[10px] text-red-700 font-bold leading-relaxed">حذف كافة المبيعات والتحصيلات وتصفير كافة مديونيات العملاء مع بقاء أسمائهم.</p>
                        </div>
                        <button onClick={handleResetCustomerAccounts} className="w-full py-4 bg-red-700 text-white rounded-xl font-black text-xs hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100">
                            <Eraser className="w-4 h-4" /> تصفير كافة مديونيات العملاء
                        </button>
                    </div>

                    {/* 2. مسح المشتريات */}
                    <div className="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-red-200 transition-all group flex flex-col justify-between shadow-sm">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><ShoppingBag className="w-6 h-6" /></div>
                            <h4 className="font-black text-slate-800 text-base mb-2">تطهير سجل المشتريات</h4>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">حذف كافة فواتير المشتريات وتاريخ التكلفة.</p>
                        </div>
                        <button onClick={handleClearPurchases} className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                            <Eraser className="w-4 h-4" /> مسح المشتريات
                        </button>
                    </div>

                    {/* 3. مسح الطلبات */}
                    <div className="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-red-200 transition-all group flex flex-col justify-between shadow-sm">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><FileText className="w-6 h-6" /></div>
                            <h4 className="font-black text-slate-800 text-base mb-2">مسح مسودات الطلبات</h4>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">حذف سجل طلبات الشراء (المسودة) المعلقة.</p>
                        </div>
                        <button onClick={handleClearOrders} className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                            <Eraser className="w-4 h-4" /> مسح كافة الطلبات
                        </button>
                    </div>

                    {/* 4. تصفير الخزينة */}
                    <div className="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-red-200 transition-all group flex flex-col justify-between shadow-sm">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Wallet className="w-6 h-6" /></div>
                            <h4 className="font-black text-slate-800 text-base mb-2">تصفير سجل الخزينة</h4>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">مسح كافة حركات الصرف والقبض وإرجاع الرصيد لصفر.</p>
                        </div>
                        <button onClick={handleResetCash} className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                            <RotateCcw className="w-4 h-4" /> تصفير الخزينة
                        </button>
                    </div>

                    {/* 5. مسح منتجات مخزن محدد */}
                    <div className="p-6 rounded-3xl border-2 border-slate-100 bg-slate-50/50 hover:border-red-200 transition-all group flex flex-col justify-between shadow-sm col-span-1 md:col-span-2">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Store className="w-6 h-6" /></div>
                            <h4 className="font-black text-slate-800 text-base mb-2">تصفير أرصدة مخزن محدد</h4>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed mb-4">اختر مخزناً لمسح كافة الأصناف (الأرصدة) الموجودة بداخلة.</p>
                            
                            <div className="flex gap-2">
                                <select 
                                    className="flex-1 border-2 border-slate-200 p-2.5 rounded-xl font-bold focus:border-red-400 outline-none"
                                    value={selectedWarehouseReset}
                                    onChange={e => setSelectedWarehouseReset(e.target.value)}
                                >
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <button onClick={handleClearWarehouseStock} className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 shadow-md">
                                    تصفير المخزن
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* المزامنة اليدوية */}
                    <div className="p-6 rounded-3xl border-2 border-blue-50 bg-blue-50/30 group flex flex-col justify-between shadow-sm">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform"><RefreshCcw className="w-6 h-6" /></div>
                            <h4 className="font-black text-slate-800 text-base mb-2">تحديث السحابة</h4>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">إعادة مزامنة وحساب كافة أرصدة النظام الحالية.</p>
                        </div>
                        <button onClick={() => db.recalculateAllBalances()} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-all">
                            تحديث الآن
                        </button>
                    </div>

                    {/* ضبط المصنع الشامل */}
                    <div className="p-6 rounded-3xl border-4 border-red-100 bg-red-50 group flex flex-col justify-between shadow-md">
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center mb-4 animate-pulse"><AlertTriangle className="w-6 h-6" /></div>
                            <h4 className="font-black text-red-900 text-base mb-2">إعادة ضبط المصنع</h4>
                            <p className="text-[10px] text-red-700 font-bold leading-relaxed">مسح شامل لكافة البيانات والعودة للوضع الافتراضي.</p>
                        </div>
                        <button onClick={() => db.resetDatabase()} className="w-full py-4 bg-red-700 text-white rounded-xl font-black text-sm hover:bg-black transition-all shadow-lg">
                            ضبط المصنع الشامل
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 relative flex flex-col max-h-[90vh] border border-slate-100">
                <button onClick={() => setIsUserModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all"><X className="w-6 h-6" /></button>
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-purple-100 rounded-2xl text-purple-600"><Key className="w-6 h-6" /></div>
                    <h3 className="text-2xl font-black text-slate-800">{userForm.id ? t('user.edit') : t('user.add')}</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
                    <div>
                        <label htmlFor="user_full_name" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{t('user.fullname')}</label>
                        <input id="user_full_name" name="user_full_name" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-50 outline-none font-bold transition-all" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="user_username" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{t('user.username')}</label>
                            <input id="user_username" name="user_username" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-50 outline-none font-mono text-xs transition-all" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="user_role" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{t('user.role')}</label>
                            <select id="user_role" name="user_role" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-50 outline-none font-bold transition-all" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})}>
                                <option value="USER">مستخدم عادي</option>
                                <option value="ADMIN">مدير (ADMIN)</option>
                                <option value="TELESALES">تيليسيلز (Telesales)</option>
                                <option value="REP">مندوب مبيعات (Rep)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="user_pass" className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{t('user.password')} {userForm.id && <span className="text-red-400 font-bold">(اتركه فارغاً للحفاظ على الحالي)</span>}</label>
                        <input id="user_pass" name="user_pass" type="password" title="password" className="w-full border-2 border-slate-100 p-3 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-50 outline-none transition-all" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                    </div>
                    
                    <div className="pt-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="w-4 h-4 text-purple-600" />
                            <h4 className="text-sm font-black text-slate-700">{t('user.permissions')}</h4>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {PERMISSIONS.map(perm => (
                                <label key={perm.id} className="flex items-center gap-4 cursor-pointer p-3 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-200 group">
                                    <div className="relative flex items-center">
                                        <input 
                                            id={`perm_${perm.id}`} 
                                            name={`perm_${perm.id}`} 
                                            type="checkbox" 
                                            className="w-5 h-5 rounded-lg text-purple-600 focus:ring-purple-500 border-2 border-slate-300" 
                                            checked={userForm.role === 'ADMIN' || userForm.permissions.includes(perm.id)} 
                                            disabled={userForm.role === 'ADMIN'} 
                                            onChange={() => togglePermission(perm.id)} 
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">{t(`perm.${perm.id}`) !== `perm.${perm.id}` ? t(`perm.${perm.id}`) : perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="pt-10 mt-6 border-t border-slate-50 flex flex-col md:flex-row gap-4">
                    <button onClick={() => setIsUserModalOpen(false)} className="flex-1 py-4 text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">{t('common.cancel')}</button>
                    <button onClick={handleSaveUser} className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-purple-600 transition-all active:scale-95">{t('user.save')}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
