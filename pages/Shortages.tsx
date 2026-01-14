
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { AlertTriangle, Package, AlertCircle, Clock, Search, History, ShoppingBag, TrendingUp } from 'lucide-react';

export default function Shortages() {
  const [activeTab, setActiveTab] = useState<'DAILY' | 'GENERAL' | 'STAGNANT' | 'SOLD_TODAY' | 'BEST_SELLING'>('DAILY');
  const [searchTerm, setSearchTerm] = useState('');
  const [bestSellingLimit, setBestSellingLimit] = useState<number | 'ALL'>(20);
  const currency = db.getSettings().currency;
  
  // Helper to get last 2 purchase prices
  const getLastTwoPrices = (prodId: string): number[] => {
      const history = (db as any).purchaseInvoices || []; // Access private prop via cast or ensure getter exists
      const prices: {date: string, price: number}[] = [];
      
      history.forEach((inv: any) => {
          if (inv.type === 'PURCHASE') {
              const item = inv.items.find((i: any) => i.product_id === prodId);
              if(item) prices.push({ date: inv.date, price: item.cost_price });
          }
      });
      // Sort Descending by Date
      prices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Get unique prices or just last 2 entries? Assuming last 2 transactions.
      return prices.slice(0, 2).map(p => p.price);
  };

  // Data Logic
  const shortagesData = useMemo(() => {
      const products = db.getProductsWithBatches();
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Calculate 30 days ago for monthly average
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const strThirtyDaysAgo = thirtyDaysAgo.toISOString().split('T')[0];

      // Fetch Sales Data for last 30 days
      const invoices = db.getInvoices();
      const monthlySalesMap = new Map<string, number>(); // ProductID -> TotalQty (Last 30 Days)
      const dailySalesMap = new Map<string, number>(); // ProductID -> TotalQty (Today)
      const allTimeSalesMap = new Map<string, number>(); // ProductID -> TotalQty (All Time)

      invoices.forEach(inv => {
          const invDate = inv.date.split('T')[0];
          if (inv.type === 'SALE') {
              // Monthly Avg Calculation
              if (invDate >= strThirtyDaysAgo) {
                  inv.items.forEach(item => {
                      const current = monthlySalesMap.get(item.product.id) || 0;
                      monthlySalesMap.set(item.product.id, current + item.quantity); // Consumed qty
                  });
              }
              // Daily Calculation
              if (invDate === todayStr) {
                  inv.items.forEach(item => {
                      const current = dailySalesMap.get(item.product.id) || 0;
                      dailySalesMap.set(item.product.id, current + item.quantity);
                  });
              }
              // All Time Calculation (For Best Selling)
              inv.items.forEach(item => {
                  const current = allTimeSalesMap.get(item.product.id) || 0;
                  allTimeSalesMap.set(item.product.id, current + item.quantity);
              });
          }
      });

      // Helper to enrich product with stock and prices
      const enrich = (p: any) => {
          const stock = p.batches.reduce((a:number, b:any) => a + b.quantity, 0);
          const prices = getLastTwoPrices(p.id);
          const monthlyAvg = monthlySalesMap.get(p.id) || 0;
          return { ...p, stock, lastPrices: prices, monthlyAvg };
      };

      // 1. General Shortages
      // Logic: Current Stock < Monthly Sales Average (Last 30 Days)
      const general = products
        .map(enrich)
        .filter(p => p.stock < p.monthlyAvg) 
        .sort((a,b) => (b.monthlyAvg - b.stock) - (a.monthlyAvg - a.stock)); // Sort by deficit severity

      // 2. Daily Sales Shortages
      // Logic: Sold Today AND (Current Stock < Monthly Sales Average)
      const daily: any[] = [];
      dailySalesMap.forEach((qtySoldToday, prodId) => {
          const p = products.find(x => x.id === prodId);
          if (p) {
              const enriched = enrich(p);
              // Check dynamic threshold
              if (enriched.stock < enriched.monthlyAvg) { 
                  daily.push({ ...enriched, qtySold: qtySoldToday });
              }
          }
      });

      // 3. Stagnant Items (High stock but NO sales in last 30 days)
      const stagnant = products
        .map(enrich)
        .filter(p => p.stock > 0 && p.monthlyAvg === 0)
        .sort((a,b) => b.stock - a.stock);

      // 4. SOLD TODAY ITEMS (New Feature)
      const soldToday: any[] = [];
      dailySalesMap.forEach((qtySoldToday, prodId) => {
          const p = products.find(x => x.id === prodId);
          if (p) {
              const enriched = enrich(p);
              soldToday.push({ ...enriched, qtySold: qtySoldToday });
          }
      });
      soldToday.sort((a,b) => b.qtySold - a.qtySold);

      // 5. BEST SELLING (New Feature)
      const bestSelling = products.map(p => {
          const enriched = enrich(p);
          const totalSold = allTimeSalesMap.get(p.id) || 0;
          return { ...enriched, totalSold };
      }).sort((a,b) => b.totalSold - a.totalSold);

      // 6. ALL PRODUCTS (For Global Search)
      const all = products.map(enrich);

      return { general, daily, stagnant, soldToday, bestSelling, all };
  }, []); // Re-calculate on mount

  // Determine what to show
  let currentList: any[] = [];
  let isGlobalSearch = false;

  if (searchTerm) {
      // If Searching, search ALL products
      isGlobalSearch = true;
      currentList = shortagesData.all.filter(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
  } else {
      // If not searching, show selected tab
      if (activeTab === 'DAILY') currentList = shortagesData.daily;
      else if (activeTab === 'GENERAL') currentList = shortagesData.general;
      else if (activeTab === 'STAGNANT') currentList = shortagesData.stagnant;
      else if (activeTab === 'SOLD_TODAY') currentList = shortagesData.soldToday;
      else if (activeTab === 'BEST_SELLING') {
          currentList = bestSellingLimit === 'ALL' ? shortagesData.bestSelling : shortagesData.bestSelling.slice(0, bestSellingLimit);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                {t('nav.shortages')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Inventory alerts based on movement (Last 30 Days)</p>
        </div>
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
            <input 
                className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none rtl:pr-9 rtl:pl-4 transition-all focus:w-full focus:shadow-md"
                placeholder="Search ANY item to check prices..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* TABS (Only visible if not searching) */}
      {!searchTerm && (
          <div className="flex gap-2 overflow-x-auto pb-1 border-b border-gray-200">
              <button 
                onClick={() => setActiveTab('DAILY')}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all whitespace-nowrap border-b-2
                ${activeTab === 'DAILY' 
                    ? 'border-red-600 text-red-600 bg-red-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                  <AlertTriangle className="w-4 h-4" />
                  {t('rep.short.daily')}
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs border border-gray-200 ml-2">{shortagesData.daily.length}</span>
              </button>

              <button 
                onClick={() => setActiveTab('GENERAL')}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all whitespace-nowrap border-b-2
                ${activeTab === 'GENERAL' 
                    ? 'border-orange-500 text-orange-600 bg-orange-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                  <Package className="w-4 h-4" />
                  {t('rep.short.general')}
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs border border-gray-200 ml-2">{shortagesData.general.length}</span>
              </button>

              <button 
                onClick={() => setActiveTab('STAGNANT')}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all whitespace-nowrap border-b-2
                ${activeTab === 'STAGNANT' 
                    ? 'border-blue-600 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                  <Clock className="w-4 h-4" />
                  {t('rep.short.stagnant')}
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs border border-gray-200 ml-2">{shortagesData.stagnant.length}</span>
              </button>

              <button 
                onClick={() => setActiveTab('SOLD_TODAY')}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all whitespace-nowrap border-b-2
                ${activeTab === 'SOLD_TODAY' 
                    ? 'border-purple-600 text-purple-600 bg-purple-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                  <ShoppingBag className="w-4 h-4" />
                  {t('rep.short.sold_today_list')}
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs border border-gray-200 ml-2">{shortagesData.soldToday.length}</span>
              </button>

              <button 
                onClick={() => setActiveTab('BEST_SELLING')}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all whitespace-nowrap border-b-2
                ${activeTab === 'BEST_SELLING' 
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                  <TrendingUp className="w-4 h-4" />
                  {t('rep.short.best_selling')}
              </button>
          </div>
      )}

      {/* CONTENT */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
          {/* Header/Controls Bar */}
          {!isGlobalSearch && (
              <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                  {/* Left Side: Context Message */}
                  <div className="flex items-center gap-2 text-sm w-full md:w-auto">
                        {activeTab === 'DAILY' && (
                            <div className="flex items-center gap-2 text-red-800 bg-red-50 px-3 py-1 rounded-lg w-full">
                                <AlertCircle className="w-4 h-4" />
                                <strong>Action Required:</strong> Sold TODAY &lt; Monthly Avg.
                            </div>
                        )}
                        {activeTab === 'STAGNANT' && (
                            <div className="flex items-center gap-2 text-blue-800 bg-blue-50 px-3 py-1 rounded-lg w-full">
                                <Clock className="w-4 h-4" />
                                <strong>Insight:</strong> Stock > 0 but NO sales (30 Days).
                            </div>
                        )}
                        {activeTab === 'BEST_SELLING' && (
                            <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg w-full">
                                <TrendingUp className="w-4 h-4" />
                                <strong>Top Movers:</strong> Ranked by all-time sales volume.
                            </div>
                        )}
                  </div>

                  {/* Right Side: Specific Controls (Best Selling Limit) */}
                  {activeTab === 'BEST_SELLING' && (
                      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
                          <span className="text-xs font-bold text-gray-500 px-2">{t('rep.short.show_top')}:</span>
                          <input 
                            type="number" 
                            min="1"
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={bestSellingLimit === 'ALL' ? '' : bestSellingLimit}
                            placeholder="All"
                            onChange={(e) => setBestSellingLimit(e.target.value ? parseInt(e.target.value) : 'ALL')}
                          />
                          <button 
                            onClick={() => setBestSellingLimit('ALL')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${bestSellingLimit === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                              {t('rep.short.show_all')}
                          </button>
                      </div>
                  )}
              </div>
          )}

          {isGlobalSearch && (
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-700">
                  <Search className="w-4 h-4" />
                  Showing search results for <strong>"{searchTerm}"</strong> across all products.
              </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right min-w-[900px]">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                        {activeTab === 'BEST_SELLING' && <th className="px-6 py-4 w-12 text-center">#</th>}
                        <th className="px-6 py-4">{t('inv.product')}</th>
                        <th className="px-6 py-4 text-center">Code</th>
                        
                        {/* Only show 'Sold Today' if relevant */}
                        {(activeTab === 'DAILY' || activeTab === 'SOLD_TODAY' || isGlobalSearch) && (
                            <th className="px-6 py-4 text-center">{t('rep.short.sold_today')}</th>
                        )}

                        {/* Best Selling Column */}
                        {(activeTab === 'BEST_SELLING' || isGlobalSearch) && (
                            <th className="px-6 py-4 text-center">{t('rep.short.total_sold')}</th>
                        )}

                        {activeTab !== 'BEST_SELLING' && (
                            <>
                                <th className="px-6 py-4 text-center">{t('rep.last_cost_1')}</th>
                                <th className="px-6 py-4 text-center">{t('rep.last_cost_2')}</th>
                                <th className="px-6 py-4 text-center">{t('rep.monthly_avg')}</th>
                            </>
                        )}

                        <th className="px-6 py-4 text-center">{t('rep.short.current')}</th>
                        <th className="px-6 py-4 text-center">{t('rep.short.status')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {currentList.map((item: any, idx: number) => {
                        // Contextual Data Checks
                        const soldInfo = shortagesData.daily.find(d => d.id === item.id) || shortagesData.soldToday.find(d => d.id === item.id);
                        const qtySoldToday = item.qtySold || (soldInfo ? soldInfo.qtySold : 0);
                        
                        // For Best Selling, calculate rank
                        const rank = idx + 1;
                        
                        // For Global Search, fetch total sales from bestSelling array logic
                        const totalSoldAllTime = item.totalSold !== undefined 
                            ? item.totalSold 
                            : (shortagesData.bestSelling.find(x => x.id === item.id)?.totalSold || 0);

                        return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            {activeTab === 'BEST_SELLING' && (
                                <td className="px-6 py-4 text-center font-bold text-gray-400">
                                    {rank <= 3 ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs">{rank}</span> : rank}
                                </td>
                            )}
                            
                            <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                            <td className="px-6 py-4 text-center text-gray-500 font-mono text-xs">{item.code}</td>
                            
                            {/* Sold Today Column */}
                            {(activeTab === 'DAILY' || activeTab === 'SOLD_TODAY' || isGlobalSearch) && (
                                <td className="px-6 py-4 text-center">
                                    {qtySoldToday > 0 ? (
                                        <span className="font-bold text-blue-600 bg-blue-50/50 px-2 py-1 rounded">
                                            {qtySoldToday}
                                        </span>
                                    ) : <span className="text-gray-300">-</span>}
                                </td>
                            )}

                            {/* Total Sold Column */}
                            {(activeTab === 'BEST_SELLING' || isGlobalSearch) && (
                                <td className="px-6 py-4 text-center">
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                        {totalSoldAllTime}
                                    </span>
                                </td>
                            )}

                            {activeTab !== 'BEST_SELLING' && (
                                <>
                                    <td className="px-6 py-4 text-center font-mono text-slate-600">
                                        {item.lastPrices[0] ? `${currency}${item.lastPrices[0]}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-slate-500 text-xs">
                                        {item.lastPrices[1] ? `${currency}${item.lastPrices[1]}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-600 font-medium">
                                        {item.monthlyAvg}
                                    </td>
                                </>
                            )}

                            <td className="px-6 py-4 text-center">
                                <span className={`font-bold text-lg ${item.stock < item.monthlyAvg ? 'text-red-600' : 'text-slate-700'}`}>
                                    {item.stock}
                                </span>
                            </td>

                            <td className="px-6 py-4 text-center">
                                {item.stock <= 0 ? (
                                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">
                                        {t('rep.short.out_of_stock')}
                                    </span>
                                ) : item.stock < item.monthlyAvg ? (
                                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200">
                                        {t('rep.short.low_stock')}
                                    </span>
                                ) : (
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                                        OK
                                    </span>
                                )}
                            </td>
                        </tr>
                    )})}
                    {currentList.length === 0 && (
                        <tr>
                            <td colSpan={activeTab === 'BEST_SELLING' ? 7 : 8} className="p-12 text-center text-gray-400 flex flex-col items-center justify-center">
                                <Package className="w-12 h-12 mb-4 text-gray-200" />
                                <p>No items found.</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
