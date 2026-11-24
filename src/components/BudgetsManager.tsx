import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Plus, Trash2, Sliders, ShieldCheck, Flame, PieChart, Info } from 'lucide-react';

interface Budget {
  id: number;
  category: string;
  amount: number;
}

interface BudgetsManagerProps {
  onRefreshTrigger?: () => void;
  onRefreshCounter: number;
}

const CATEGORIES = [
  'Total', 'Food', 'Groceries', 'Shopping', 'Travel', 'Fuel', 'Education', 'Healthcare',
  'Entertainment', 'Utilities', 'Investment', 'Rent', 'Salary', 'Business',
  'Insurance', 'Bills', 'Donation', 'Others'
];

export default function BudgetsManager({ onRefreshTrigger, onRefreshCounter }: BudgetsManagerProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [category, setCategory] = useState('Total');
  const [amount, setAmount] = useState('');
  const [spentData, setSpentData] = useState<Record<string, number>>({});
  const [monthlyTotalSpent, setMonthlyTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const fetchBudgetStats = async () => {
    try {
      setLoading(true);

      // Fetch Budgets
      const resBudgets = await fetch('/api/budgets');
      const budgetsJson = await resBudgets.ok ? await resBudgets.json() : [];
      setBudgets(budgetsJson);

      // Fetch Expenditures and Analytics to get current spending
      const resAnalytics = await fetch('/api/analytics/summary');
      if (resAnalytics.ok) {
        const analyticsJson = await resAnalytics.json();
        const spentMap: Record<string, number> = {};
        if (analyticsJson.categoryData) {
          analyticsJson.categoryData.forEach((item: any) => {
            spentMap[item.category] = item.value;
          });
        }
        setSpentData(spentMap);
      }

      // Fetch dashboard stats for total monthly spending
      const resStats = await fetch('/api/dashboard/stats');
      if (resStats.ok) {
        const statsJson = await resStats.json();
        setMonthlyTotalSpent(statsJson.monthlySpending || 0);
      }
    } catch (err) {
      console.error('Error fetching budget configurations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetStats();
  }, [onRefreshCounter]);

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please provide a valid budget amount.');
      return;
    }

    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, amount: parseFloat(amount) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save budget.');
      }

      setSuccessMsg(data.message);
      setAmount('');
      fetchBudgetStats();
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBudget = async (cat: string) => {
    try {
      const res = await fetch(`/api/budgets/${cat}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg(`Budget limit for ${cat} removed.`);
        fetchBudgetStats();
        if (onRefreshTrigger) onRefreshTrigger();
      }
    } catch (err) {
      console.error('Error deleting budget:', err);
    }
  };

  const getCategorySpending = (cat: string) => {
    if (cat === 'Total') return monthlyTotalSpent;
    return spentData[cat] || 0;
  };

  const getAlertStatus = (spent: number, budgetAmt: number) => {
    const ratio = (spent / budgetAmt) * 100;
    if (ratio >= 100) {
      return { label: 'BREACHED', color: 'text-rose-600 bg-rose-50 border-rose-100', bar: 'bg-rose-500' };
    }
    if (ratio >= 80) {
      return { label: 'WARNING (80%)', color: 'text-amber-600 bg-amber-50 border-amber-100', bar: 'bg-amber-500' };
    }
    if (ratio >= 50) {
      return { label: 'NOTICE (50%)', color: 'text-sky-600 bg-sky-50 border-sky-100', bar: 'bg-sky-500' };
    }
    return { label: 'HEALTHY', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', bar: 'bg-emerald-500' };
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Configuration Form */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm md:col-span-1 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 font-display">Configure Cap Limits</h3>
          </div>

          <form onSubmit={handleSetBudget} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Target Channel</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-sky-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'Total' ? 'Entire Monthly Cap' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Monthly Limit (INR)</label>
              <input
                type="number"
                placeholder="₹ 5,000.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm font-bold text-slate-800 outline-none"
              />
            </div>

            {error && <div className="text-xs text-rose-600 font-semibold">{error}</div>}
            {successMsg && <div className="text-xs text-emerald-600 font-semibold">{successMsg}</div>}

            <button
              type="submit"
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Save Budget Cap
            </button>
          </form>

          {/* Quick Info Box */}
          <div className="mt-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-2.5">
            <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[10px] leading-relaxed text-indigo-700 font-medium">
              Caps set are evaluated in real-time. Paying friends or settle bills automatically updates progress and fires notifications when limits breach 50%, 80%, or 100%.
            </p>
          </div>
        </div>

        {/* Right: Active Budget Progress List */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm md:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Cap Limits</h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
              {budgets.length} Configured
            </span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500 text-xs font-semibold">
              Querying cap limits database...
            </div>
          ) : budgets.length > 0 ? (
            <div className="space-y-5">
              {budgets.map((bud) => {
                const spent = getCategorySpending(bud.category);
                const ratio = bud.amount > 0 ? (spent / bud.amount) * 100 : 0;
                const status = getAlertStatus(spent, bud.amount);

                return (
                  <div key={bud.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-50/80 transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">
                          {bud.category === 'Total' ? '🛡️ Entire Monthly Spending' : `🛍️ ${bud.category} Spending`}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-bold">
                            Spent ₹{spent.toLocaleString('en-IN')} of ₹{bud.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${status.color}`}>
                          {status.label}
                        </span>
                        <button
                          onClick={() => handleDeleteBudget(bud.category)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Remove budget cap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${status.bar}`}
                          style={{ width: `${Math.min(100, ratio)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold block text-right mt-1">
                        {ratio.toFixed(0)}% Utilized
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Sliders className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No active budget caps created yet. Define a cap on the left panel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
