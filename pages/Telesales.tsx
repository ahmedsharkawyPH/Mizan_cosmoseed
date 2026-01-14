
import React, { useState, useEffect } from 'react';
import { authService, PERMISSIONS } from '../services/auth';
import { t } from '../utils/t';
import { Users, Plus, Edit2, Trash2, X, Shield, Key, CheckSquare, Phone } from 'lucide-react';

export default function Telesales() {
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ 
      id: '', name: '', username: '', password: '', role: 'TELESALES',
      permissions: ['MANAGE_SALES', 'MANAGE_CUSTOMERS', 'VIEW_DASHBOARD', 'MANAGE_INVENTORY', 'MANAGE_CASH'] // Default Telesales Perms
  });

  useEffect(() => {
    // Fetch users who are TELESALES
    const allUsers = authService.getUsers();
    setUsers(allUsers.filter(u => u.role === 'TELESALES'));
  }, []);

  const refreshList = () => {
      const allUsers = authService.getUsers();
      setUsers(allUsers.filter(u => u.role === 'TELESALES'));
  };

  const handleOpenModal = (user?: any) => {
      if (user) {
          setForm({ ...user, password: '', permissions: user.permissions || [] }); 
      } else {
          setForm({ 
              id: '', name: '', username: '', password: '', role: 'TELESALES', 
              permissions: ['MANAGE_SALES', 'MANAGE_CUSTOMERS', 'VIEW_DASHBOARD', 'MANAGE_INVENTORY', 'MANAGE_CASH']
          });
      }
      setIsModalOpen(true);
  };

  const handleSave = () => {
      if (!form.name || !form.username) return alert("Name and Username are required");
      if (!form.id && !form.password) return alert("Password is required for new users");
      
      authService.saveUser(form);
      refreshList();
      setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
      if (confirm("Are you sure you want to delete this telesales user?")) {
          authService.deleteUser(id);
          refreshList();
      }
  };

  const togglePermission = (permId: string) => {
      setForm(prev => {
          const exists = prev.permissions.includes(permId);
          if (exists) {
              return { ...prev, permissions: prev.permissions.filter(p => p !== permId) };
          } else {
              return { ...prev, permissions: [...prev.permissions, permId] };
          }
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Phone className="w-6 h-6 text-blue-600" />
            {t('nav.telesales')}
        </h1>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> {t('user.add')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[600px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                <th className="p-4">{t('user.fullname')}</th>
                <th className="p-4">{t('user.username')}</th>
                <th className="p-4 text-center">{t('user.permissions')}</th>
                <th className="p-4 text-center">{t('common.action')}</th>
                </tr>
            </thead>
            <tbody>
                {users.map(u => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {u.name.charAt(0)}
                        </div>
                        {u.name}
                    </td>
                    <td className="p-4 text-gray-600">@{u.username}</td>
                    <td className="p-4 text-center">
                        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">
                            {u.permissions?.length || 0} Permissions
                        </span>
                    </td>
                    <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                            <button onClick={() => handleOpenModal(u)} className="text-gray-500 hover:text-blue-600 p-1.5 rounded hover:bg-gray-100">
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(u.id)} className="text-gray-500 hover:text-red-600 p-1.5 rounded hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </td>
                </tr>
                ))}
                {users.length === 0 && (
                    <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400">No telesales users found</td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative flex flex-col max-h-[90vh]">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-600" />
                    {form.id ? t('user.edit') : t('user.add')}
                </h3>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('user.fullname')}</label>
                        <input className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('user.username')}</label>
                        <input className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Key className="w-3 h-3" /> {t('user.password')} {form.id && <span className="text-gray-400 font-normal text-xs">(Blank to keep)</span>}
                        </label>
                        <input type="password" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <CheckSquare className="w-4 h-4" /> {t('user.permissions')}
                        </h4>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 grid grid-cols-1 gap-2">
                            {PERMISSIONS.map(perm => (
                                <label key={perm.id} className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-white rounded transition-colors">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        checked={form.permissions.includes(perm.id)}
                                        onChange={() => togglePermission(perm.id)}
                                    />
                                    <span className="text-sm text-gray-700">{t(`perm.${perm.id}`) !== `perm.${perm.id}` ? t(`perm.${perm.id}`) : perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="pt-4 mt-4 border-t flex justify-end gap-2">
                    <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm">{t('user.save')}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
