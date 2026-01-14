

import React, { useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Layers, Activity, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const COLORS = {
    A: '#10b981', // Emerald
    B: '#f59e0b', // Amber
    C: '#ef4444'  // Red
};

export default function InventoryAnalysis() {
  const currency = db.getSettings().currency;
  
  // Data Fetching
  const abcData = useMemo(() => db.getABCAnalysis(), []);
  const valuationData = useMemo(() => db.getInventoryValuationReport(), []);

  // Prepare ABC Chart Data
  const abcChartData = useMemo(() => {
      const counts = { A: 0, B: 0, C: 0 };
      const values = { A: 0, B: 0, C: 0 };
      
      abcData.classifiedProducts.forEach(p => {
          counts[p.category as keyof typeof counts]++;
          values[p.category as keyof typeof values] += p.revenue;
      });

      return [
          { name: 'Class A', count: counts.A, value: values.A, fill: COLORS.A },
          { name: 'Class B', count: counts.B, value: values.B, fill: COLORS.B },
          { name: 'Class C', count: counts.C, value: values.C, fill: COLORS.C },
      ];
  }, [abcData]);

  // Totals
  const totalAssetValue = valuationData.reduce((sum, item) => sum + item.totalValue, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Activity className="w-8 h-8 text-indigo-600" />
                    {t('analysis.title')}
                </h1>
                <p className="text-gray-500 mt-1">Optimize stock levels using ABC classification and valuation metrics.</p>
            </div>
            <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 text-indigo-800 font-bold text-sm">
                Total Asset Value: {currency}{totalAssetValue.toLocaleString()}
            </div>
        </div>

        {/* 1. ABC ANALYSIS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-500" />
                        {t('analysis.abc_title')}
                    </h3>
                </div>
                
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={abcData.classifiedProducts.slice(0, 15)} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}} 
                                formatter={(val: number) => [`${currency}${val.toLocaleString()}`, 'Revenue']}
                            />
                            <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
                                {abcData.classifiedProducts.slice(0, 15).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.category as keyof typeof COLORS]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4 text-xs font-bold text-gray-600">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Class A (80%)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Class B (15%)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Class C (5%)</div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                <h3 className="font-bold text-gray-800 mb-6 text-center">{t('analysis.revenue_share')}</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={abcChartData} 
                                cx="50%" cy="50%" 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                            >
                                {abcChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(val: number) => `${currency}${val.toLocaleString()}`} />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                    {abcChartData.map(d => (
                        <div key={d.name} className="flex justify-between text-xs text-gray-600 border-b border-dashed border-gray-100 pb-1">
                            <span>{d.name} ({d.count} Items)</span>
                            <span className="font-bold">{currency}{d.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* 2. VALUATION & TURNOVER TABLE */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    {t('analysis.valuation_title')}
                </h3>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                            <th className="px-6 py-4">{t('inv.product')}</th>
                            <th className="px-6 py-4 text-center">{t('stock.qty')}</th>
                            <th className="px-6 py-4 text-right rtl:text-left">{t('analysis.wac')}</th>
                            <th className="px-6 py-4 text-right rtl:text-left">Latest Cost</th>
                            <th className="px-6 py-4 text-right rtl:text-left">{t('analysis.total_asset')}</th>
                            <th className="px-6 py-4 text-center">{t('analysis.turnover')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {valuationData.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-800">{p.name}</div>
                                    <div className="text-xs text-gray-400 font-mono">{p.code}</div>
                                </td>
                                <td className="px-6 py-4 text-center font-bold">{p.totalQty}</td>
                                <td className="px-6 py-4 text-right rtl:text-left text-gray-600">
                                    {currency}{p.wac.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-right rtl:text-left text-gray-600">
                                    {currency}{p.latestCost.toFixed(2)}
                                    {p.latestCost > p.wac && <TrendingUp className="w-3 h-3 text-red-500 inline ml-1" />}
                                    {p.latestCost < p.wac && <TrendingDown className="w-3 h-3 text-emerald-500 inline ml-1" />}
                                </td>
                                <td className="px-6 py-4 text-right rtl:text-left font-bold text-gray-800">
                                    {currency}{p.totalValue.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        parseFloat(p.turnoverRate) > 10 ? 'bg-emerald-100 text-emerald-700' :
                                        parseFloat(p.turnoverRate) > 5 ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {p.turnoverRate}x
                                    </span>
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
