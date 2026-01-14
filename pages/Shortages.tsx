
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { AlertTriangle, Package, AlertCircle, Clock, Search, History, ShoppingBag, TrendingUp } from 'lucide-react';

export default function Shortages() {
  const [activeTab, setActiveTab] = useState<'DAILY' | 'GENERAL' | 'STAGNANT' | 'SOLD_TODAY' | 'BEST_SELLING'>('DAILY');
  const [searchTerm, setSearchTerm] = useState('');
  const [bestSellingLimit, setBestSellingLimit] = useState<number | 'ALL'>(20);
  const currency = db.getSettings().currency;
  
  const getLastTwoPrices = (prodId: string): number[] => {
      const history = (db as any).purchaseInvoices || [];
      const prices: {date: string, price: number}[] = [];
      
      history.forEach((inv: any) => {
          if (inv.type === 'PURCHASE') {
              const item = inv.items.find((i: any) => i.product_id === prodId);
              if(item) prices.push({ date: inv.date, price: item.cost_price });
          }
      });
      prices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return prices.slice(0, 2).map(p => p.price);
  };

  const shortagesData = useMemo(() => {
      const products = db.getProductsWithBatches();
      const todayStr = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const strThirtyDaysAgo = thirtyDaysAgo.toISOString().split('T')[0];

      const invoices = db.getInvoices();
      const monthlySalesMap = new Map<string, number>();
      const dailySalesMap = new Map<string, number>();
      const allTimeSalesMap = new Map<string, number>();

      invoices.forEach(inv => {
          const invDate = inv.date.split('T')[0];
          if (inv.type === 'SALE') {
              if (invDate >= strThirtyDaysAgo) {
                  inv.items.forEach(item => {
                      const current = monthlySalesMap.get(item.product.id) || 0;
                      monthlySalesMap.set(item.product.id, current + item.quantity);
                  });
              }
              if (invDate === todayStr) {
                  inv.items.forEach(item => {
                      const current = dailySalesMap.get(item.product.id) || 0;
                      dailySalesMap.set(item.product.id, current + item.quantity);
                  });
              }
              inv.items.forEach(item => {
                  const current = allTimeSalesMap.get(item.product.id) || 0;
                  allTimeSalesMap.set(item.product.id, current + item.quantity);
              });
          }
      });

      const enrich = (p: any) => {
          const stock = p.batches.reduce((a:number, b:any) => a + b.quantity, 0);
          const prices = getLastTwoPrices(p.id);
          const monthlyAvg = monthlySalesMap.get(p.id) || 0;
          return { ...p, stock, lastPrices: prices, monthlyAvg };
      };

      const general = products.map(enrich).filter(p => p.stock < p.monthlyAvg).sort((a,b) => (b.monthlyAvg - b.stock) - (a.monthlyAvg - a.stock));
      const daily: any[] = [];
      dailySalesMap.forEach((qtySoldToday, prodId) => {
          const p = products.find(x => x.id === prodId);
          if (p) {
              const enriched = enrich(p);
              if (enriched.stock < enriched.monthlyAvg) { daily.push({ ...enriched, qtySold: qtySoldToday }); }
          }
      });
      const stagnant = products.map(enrich).filter(p => p.stock > 0 && p.monthlyAvg === 0).sort((a,b) => b.stock - a.stock);
      const soldToday: any[] = [];
      dailySalesMap.forEach((qtySoldToday, prodId) => {
          const p = products.find(x => x.id === prodId);
          if (p) { soldToday.push({ ...enrich(p), qtySold: qtySoldToday }); }
      });
      const bestSelling = products.map(p => ({ ...enrich(p), totalSold: allTimeSalesMap.get(p.id) || 0 })).sort((a,b) => b.totalSold - a.totalSold);
      return { general, daily, stagnant, soldToday, bestSelling, all: products.map(enrich) };
  }, []);

  let currentList: any[] = [];
  if (searchTerm) {
      currentList = shortagesData.all.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.code.toLowerCase().includes(searchTerm.toLowerCase()));
  } else {
      if (activeTab === 'DAILY') currentList = shortagesData.daily;
      else if (activeTab === 'GENERAL') currentList = shortagesData.general;
      else if (activeTab === 'STAGNANT') currentList = shortagesData.stagnant;
      else if (activeTab === 'SOLD_TODAY') currentList = shortagesData.soldToday;
      else if (activeTab === 'BEST_SELLING') currentList = bestSellingLimit === 'ALL' ? shortagesData.bestSelling : shortagesData.bestSelling.slice(0, bestSellingLimit);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><AlertTriangle className="w-8 h-8 text-red-600" />{t('nav.shortages')}</h1></div>
        <div className="relative w-full md:w-80"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" /><input className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Search item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
      </div>

      {!searchTerm && (
          <div className="flex gap-2 overflow-x-auto pb-1 border-b border-gray-200">
              <button onClick={() => setActiveTab('DAILY')} className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all border-b-2 ${activeTab === 'DAILY' ? 'border-red-600 text-red-600 bg-red-50' : 'border-transparent text-gray-500'}`}><AlertTriangle className="w-4 h-4" />{t('rep.short.daily')}</button>
              <button onClick={() => setActiveTab('GENERAL')} className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all border-b-2 ${activeTab === 'GENERAL' ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-transparent text-gray-500'}`}><Package className="w-4 h-4" />{t('rep.short.general')}</button>
              <button onClick={() => setActiveTab('STAGNANT')} className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all border-b-2 ${activeTab === 'STAGNANT' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500'}`}><Clock className="w-4 h-4" />{t('rep.short.stagnant')}</button>
              <button onClick={() => setActiveTab('SOLD_TODAY')} className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all border-b-2 ${activeTab === 'SOLD_TODAY' ? 'border-purple-600 text-purple-600 bg-purple-50' : 'border-transparent text-gray-500'}`}><ShoppingBag className="w-4 h-4" />{t('rep.short.sold_today_list')}</button>
              <button onClick={() => setActiveTab('BEST_SELLING')} className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all border-b-2 ${activeTab === 'BEST_SELLING' ? 'border-emerald-600 text-emerald-600 bg-emerald-50' : 'border-transparent text-gray-500'}`}><TrendingUp className="w-4 h-4" />{t('rep.short.best_selling')}</button>
          </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[900px]">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                        <th className="px-6 py-4">{t('inv.product')}</th>
                        <th className="px-6 py-4 text-center">Code</th>
                        <th className="px-6 py-4 text-center">{t('rep.last_cost_1')}</th>
                        <th className="px-6 py-4 text-center">{t('rep.monthly_avg')}</th>
                        <th className="px-6 py-4 text-center">{t('rep.short.current')}</th>
                        <th className="px-6 py-4 text-center">{t('rep.short.status')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {currentList.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                            <td className="px-6 py-4 text-center text-gray-500 font-mono text-xs">{item.code}</td>
                            <td className="px-6 py-4 text-center font-mono text-slate-600">{item.lastPrices[0] ? `${currency}${item.lastPrices[0]}` : '-'}</td>
                            <td className="px-6 py-4 text-center text-slate-600 font-medium">{item.monthlyAvg}</td>
                            <td className="px-6 py-4 text-center"><span className={`font-bold text-lg ${item.stock < item.monthlyAvg ? 'text-red-600' : 'text-slate-700'}`}>{item.stock}</span></td>
                            <td className="px-6 py-4 text-center">{item.stock <= 0 ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">Out Stock</span> : item.stock < item.monthlyAvg ? <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200">Low Stock</span> : <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">OK</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
