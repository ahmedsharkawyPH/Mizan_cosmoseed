
import React, { useState } from 'react';
import { db } from '../services/db';
import { Warehouse } from '../types';
import { t } from '../utils/t';
import { Plus, Edit2, Warehouse as WarehouseIcon } from 'lucide-react';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState(db.getWarehouses());
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [name, setName] = useState('');

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setName('');
    setIsOpen(true);
  };

  const handleOpenEdit = (w: Warehouse) => {
    setIsEditMode(true);
    setCurrentId(w.id);
    setName(w.name);
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!name) return;
    if (isEditMode) {
      db.updateWarehouse(currentId, name);
    } else {
      db.addWarehouse(name);
    }
    setWarehouses(db.getWarehouses());
    setIsOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
           <WarehouseIcon className="w-6 h-6 text-blue-600" />
           {t('ware.title')}
        </h1>
        <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> {t('ware.add')}
        </button>
      </div>

      {isOpen && (
        <div className="bg-white p-6 rounded-xl border shadow-lg space-y-4 animate-in fade-in zoom-in duration-200 max-w-lg">
          <h3 className="font-bold text-lg">{isEditMode ? 'Edit Warehouse' : t('ware.add')}</h3>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('ware.name')}</label>
              <input 
                placeholder={t('ware.name')} 
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                autoFocus
              />
          </div>
          <div className="flex justify-end gap-2">
             <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('common.action')}</button>
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('set.save')}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[500px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                <th className="p-4">ID</th>
                <th className="p-4">{t('ware.name')}</th>
                <th className="p-4">{t('ware.type')}</th>
                <th className="p-4 text-center">{t('common.action')}</th>
                </tr>
            </thead>
            <tbody>
                {warehouses.map(w => (
                <tr key={w.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-mono text-gray-500 text-xs">{w.id}</td>
                    <td className="p-4 font-bold text-gray-800">{w.name}</td>
                    <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.is_default ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {w.is_default ? t('ware.default') : t('ware.sub')}
                        </span>
                    </td>
                    <td className="p-4 text-center">
                        <button onClick={() => handleOpenEdit(w)} className="text-gray-500 hover:text-blue-600 p-1 rounded">
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
