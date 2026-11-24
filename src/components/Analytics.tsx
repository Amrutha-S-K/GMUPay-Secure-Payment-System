import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, ShoppingBag, ArrowDownLeft, ArrowUpRight, Award, DollarSign, Calendar, RefreshCw, Layers } from 'lucide-react';

interface AnalyticsProps {
  onRefreshTrigger?: number;
}

export default function Analytics({ onRefreshTrigger }: AnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/summary');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [onRefreshTrigger]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mb-2" />
        <p className="text-xs text-slate-500">Compiling financial analytics engine...</p>
      </div>
    );
  }

  if (!data) return null;

  // Custom colors for visual pie cells
  const COLORS = ['#0284c7', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#64748b'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-0">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Top Spend Category</span>
            <h4 className="text-lg font-bold text-slate-800">
              {data.categoryData?.[0]?.category || 'None Yet'}
            </h4>
            <p className="text-xs text-slate-500">
              {data.categoryData?.[0]?.value ? `₹${data.categoryData[0].value.toLocaleString('en-IN')} Spent` : 'No transactions recorded'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Layers className="w-5.5 h-5.5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Most Frequent Merchant</span>
            <h4 className="text-lg font-bold text-slate-800">
              {data.topMerchant?.merchant_name || 'None'}
            </h4>
            <p className="text-xs text-slate-500">
              {data.topMerchant?.total ? `₹${data.topMerchant.total.toLocaleString('en-IN')} across ${data.topMerchant.count} visits` : 'N/A'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShoppingBag className="w-5.5 h-5.5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Highest Single Expense</span>
            <h4 className="text-lg font-bold text-slate-800">
              {data.highestExpense?.receiver_name || 'None'}
            </h4>
            <p className="text-xs text-rose-600 font-semibold">
              {data.highestExpense?.amount ? `₹${data.highestExpense.amount.toLocaleString('en-IN')}` : 'N/A'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card: Category Breakdown (Pie Chart) */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Category Wise Spending</h3>
          <div className="h-64 flex items-center justify-center">
            {data.categoryData && data.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="category"
                  >
                    {data.categoryData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs">No transaction categorizations found for this period.</div>
            )}
          </div>
        </div>

        {/* Right Card: Trend charts */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Spending Chronology</h3>
            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
              {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTimeframe(mode)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                    timeframe === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64">
            {timeframe === 'daily' && data.dailyTrend && data.dailyTrend.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyTrend}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 600 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 600 }} stroke="#94a3b8" />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Area type="monotone" dataKey="amount" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {timeframe === 'weekly' && data.weeklyTrend && data.weeklyTrend.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" name="Week No." tick={{ fontSize: 9, fontWeight: 600 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 600 }} stroke="#94a3b8" />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Bar dataKey="expenses" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {timeframe === 'monthly' && data.monthlyTrend && data.monthlyTrend.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 600 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 600 }} stroke="#94a3b8" />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600 }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {((timeframe === 'daily' && (!data.dailyTrend || data.dailyTrend.length === 0)) ||
              (timeframe === 'weekly' && (!data.weeklyTrend || data.weeklyTrend.length === 0)) ||
              (timeframe === 'monthly' && (!data.monthlyTrend || data.monthlyTrend.length === 0))) && (
              <div className="text-center py-12 text-slate-400 text-xs">Insufficient trend history to display. Make some payment transfers!</div>
            )}
          </div>
        </div>
      </div>

      {/* Category Wise Spending Details Ledger */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">All Spend Categories Breakdown</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Detailed distribution of your payments across categories.</p>
          </div>
          <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full w-fit">
            Total Spend: ₹{(data.categoryData?.reduce((sum: number, entry: any) => sum + entry.value, 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {data.categoryData && data.categoryData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {data.categoryData.map((item: any, idx: number) => {
              const totalAmount = data.categoryData.reduce((sum: number, entry: any) => sum + entry.value, 0) || 1;
              const pct = ((item.value / totalAmount) * 100).toFixed(1);
              const colorIdx = idx % COLORS.length;
              return (
                <div key={item.category} className="space-y-1.5 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full block shrink-0" style={{ backgroundColor: COLORS[colorIdx] }} />
                      <span className="text-slate-800">{item.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-900 font-bold">₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span className="text-slate-400 text-[10px] font-bold ml-1.5">({pct}%)</span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: COLORS[colorIdx]
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">No transactions recorded across any categories.</div>
        )}
      </div>
    </div>
  );
}
