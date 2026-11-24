import React from 'react';
import { motion } from 'motion/react';
import { Wallet, ArrowUpRight, ArrowDownLeft, QrCode, Phone, Landmark, AlertCircle, Sparkles, Receipt, Wifi, Flame, ShoppingBag, ShieldCheck, TrendingUp, Calendar } from 'lucide-react';
import { User, Bill, Transaction } from '../types';

interface DashboardProps {
  user: User;
  stats: {
    balance: number;
    todaySpending: number;
    monthlySpending: number;
    monthlyBudget: number | null;
    remainingBudget: number | null;
    savingsThisMonth: number;
  };
  recentTransactions: Transaction[];
  upcomingBills: Bill[];
  onOpenPay: (type: 'SEND' | 'BILL' | 'RECHARGE' | 'REQUEST', target?: any) => void;
  onNavigateTab: (tab: string) => void;
}

export default function Dashboard({
  user,
  stats,
  recentTransactions,
  upcomingBills,
  onOpenPay,
  onNavigateTab,
}: DashboardProps) {

  // Category visual icons map for circular contacts/merchants
  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'food': return 'bg-orange-100 text-orange-600';
      case 'groceries': return 'bg-emerald-100 text-emerald-600';
      case 'shopping': return 'bg-purple-100 text-purple-600';
      case 'travel': return 'bg-sky-100 text-sky-600';
      case 'fuel': return 'bg-amber-100 text-amber-600';
      case 'education': return 'bg-indigo-100 text-indigo-600';
      case 'salary': return 'bg-lime-100 text-lime-700';
      case 'utilities': return 'bg-cyan-100 text-cyan-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const budgetPct = stats.monthlyBudget && stats.monthlyBudget > 0
    ? (stats.monthlySpending / stats.monthlyBudget) * 100
    : 0;

  const getBudgetMeterColor = (pct: number) => {
    if (pct >= 100) return 'bg-rose-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-sky-500';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-0 font-sans pb-16">
      {/* 1. Header Hero with User Card */}
      <div className="vibrant-wallet-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/40 ring-4 ring-white/10 bg-sky-700">
            {user.profile_photo ? (
              <img src={user.profile_photo} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xl">{user.full_name[0]}</div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-sky-100 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-200" /> Secure Wallet Actived
            </div>
            <h2 className="text-2xl font-bold font-display tracking-tight mt-0.5">Hello, {user.full_name}!</h2>
            <p className="text-xs text-sky-100 font-mono mt-0.5 select-all">{user.upi_id}</p>
          </div>
        </div>

        <div className="flex md:flex-col items-start md:items-end justify-between border-t border-white/10 pt-4 md:pt-0 md:border-0 relative z-10">
          <span className="text-xs text-sky-100 font-medium">Available Balance</span>
          <div className="text-3xl font-extrabold font-display mt-0.5">₹{stats.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* 2. GPay Quick Pay Grid */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Quick GPay Transfers</h3>
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 gap-y-6 gap-x-2 text-center">
          <button
            onClick={() => onOpenPay('SEND')}
            className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-sky-50 group-hover:bg-sky-100 text-sky-600 transition-all flex items-center justify-center shadow-sm">
              <ArrowUpRight className="w-5.5 h-5.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Send Money</span>
          </button>

          <button
            onClick={() => onOpenPay('REQUEST')}
            className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 transition-all flex items-center justify-center shadow-sm">
              <ArrowDownLeft className="w-5.5 h-5.5 transition-transform group-hover:-translate-x-0.5 group-hover:translate-y-0.5" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Request</span>
          </button>

          <button
            onClick={() => onOpenPay('RECHARGE')}
            className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 group-hover:bg-purple-100 text-purple-600 transition-all flex items-center justify-center shadow-sm">
              <Wifi className="w-5.5 h-5.5" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Recharge</span>
          </button>

          <button
            onClick={() => onOpenPay('BILL')}
            className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 group-hover:bg-amber-100 text-amber-600 transition-all flex items-center justify-center shadow-sm">
              <Receipt className="w-5.5 h-5.5" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Pay Bills</span>
          </button>

          <button
            onClick={() => onNavigateTab('budgets')}
            className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 group-hover:bg-rose-100 text-rose-600 transition-all flex items-center justify-center shadow-sm">
              <Flame className="w-5.5 h-5.5" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Budgets</span>
          </button>

          <button
            onClick={() => onNavigateTab('analytics')}
            className="group flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 transition-all flex items-center justify-center shadow-sm">
              <TrendingUp className="w-5.5 h-5.5" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Analytics</span>
          </button>
        </div>
      </div>

      {/* 3. Spending Analytics & Budget Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Financial Health Meter */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm md:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Automatic Budget Health</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">Current Month</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <span className="text-[11px] text-slate-400 font-medium block">Today</span>
                <span className="text-lg font-bold text-slate-800">₹{stats.todaySpending.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <span className="text-[11px] text-slate-400 font-medium block">Spent</span>
                <span className="text-lg font-bold text-slate-800">₹{stats.monthlySpending.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <span className="text-[11px] text-slate-400 font-medium block">Estimated Savings</span>
                <span className="text-lg font-bold text-emerald-600">₹{stats.savingsThisMonth.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {stats.monthlyBudget ? (
            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-2">
                <span className="text-slate-600">Budget Progress: {budgetPct.toFixed(0)}%</span>
                <span className={budgetPct > 100 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                  {stats.remainingBudget && stats.remainingBudget > 0
                    ? `₹${stats.remainingBudget.toLocaleString('en-IN')} Left`
                    : 'Budget Overrun!'}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBudgetMeterColor(budgetPct)}`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
              {budgetPct >= 100 && (
                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Your customized Monthly Budget is exceeded. Check analytics to control expenses.
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between border border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <div className="text-xs text-slate-500 max-w-xs">
                Configure a custom monthly budget limit to monitor savings and trigger proactive spending alerts.
              </div>
              <button
                onClick={() => onNavigateTab('budgets')}
                className="text-xs bg-sky-500 hover:bg-sky-600 text-white font-bold py-1.5 px-3 rounded-xl shadow-sm transition-all shrink-0"
              >
                Set Budget
              </button>
            </div>
          )}
        </div>

        {/* Right: Smart Categorizer info card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center gap-1.5 bg-white/15 w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" /> Categorization Engine
            </div>
            <h4 className="text-lg font-bold font-display tracking-tight leading-snug">Smart Pay Auto-Label</h4>
            <p className="text-xs text-indigo-100 mt-2 leading-relaxed">
              Every digital GPay purchase made is parsed via the matching merchant classification ruleset, sorting transaction records automatically.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('history')}
            className="text-xs bg-white text-indigo-600 hover:bg-indigo-50 font-bold py-2 w-full rounded-xl transition-all shadow-sm text-center mt-4"
          >
            Review Auto-Categories
          </button>
        </div>
      </div>

      {/* 4. Upcoming Bills & Recent Transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Pending Bills widget */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unpaid Pending Bills</h3>
              <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                {upcomingBills.filter(b => b.status === 'UNPAID').length} Outstanding
              </span>
            </div>

            <div className="space-y-3">
              {upcomingBills.filter(b => b.status === 'UNPAID').slice(0, 3).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Receipt className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{bill.biller_name}</h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" /> Due: {bill.due_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700">₹{bill.amount}</span>
                    <button
                      onClick={() => onOpenPay('BILL', bill)}
                      className="text-[10px] bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm shadow-sky-500/10"
                    >
                      Pay Now
                    </button>
                  </div>
                </div>
              ))}

              {upcomingBills.filter(b => b.status === 'UNPAID').length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  🎉 Excellent! No pending bills left to settle.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Recent GPay Transactions */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Purchases</h3>
              <button
                onClick={() => onNavigateTab('history')}
                className="text-xs text-sky-500 font-bold hover:underline"
              >
                See All
              </button>
            </div>

            <div className="space-y-3.5">
              {recentTransactions.slice(0, 3).map((tx) => {
                const isReceive = tx.type === 'RECEIVE';
                return (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${getCategoryColor(tx.category)}`}>
                        {isReceive ? tx.sender_name[0] : tx.receiver_name[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">
                          {isReceive ? tx.sender_name : tx.receiver_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.2 rounded-md">
                            {tx.category}
                          </span>
                          <span className="text-[10px] text-slate-400">{tx.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-extrabold ${isReceive ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {isReceive ? '+' : '-'} ₹{tx.amount.toFixed(2)}
                      </span>
                      <p className="text-[9px] text-slate-400 mt-0.5">{tx.payment_method}</p>
                    </div>
                  </div>
                );
              })}

              {recentTransactions.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No purchases found. Complete a quick transfer above!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
