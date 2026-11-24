import React, { useState, useEffect } from 'react';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Download, FileSpreadsheet, FileText, ChevronDown, Check, Edit2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Transaction } from '../types';
import AddManualExpenseModal from './AddManualExpenseModal';

interface HistoryProps {
  onRefreshTrigger?: () => void;
  onRefreshCounter: number;
}

const CATEGORIES = [
  'Food', 'Groceries', 'Shopping', 'Travel', 'Fuel', 'Education', 'Healthcare',
  'Entertainment', 'Bills', 'Investment', 'Rent', 'Salary', 'Business',
  'Insurance', 'Donation', 'Other', 'Others'
];

export default function History({ onRefreshTrigger, onRefreshCounter }: HistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [type, setType] = useState('All');
  const [sort, setSort] = useState('newest');

  // Manual category edit state
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  // Manual expense creation and transaction deletion states
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [deleteConfirmTxId, setDeleteConfirmTxId] = useState<number | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const url = `/api/transactions?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}&sort=${sort}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [search, category, type, sort, onRefreshCounter]);

  const handleUpdateCategory = async (txId: number, newCat: string) => {
    try {
      const res = await fetch('/api/transactions/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, category: newCat }),
      });

      if (res.ok) {
        setEditingTxId(null);
        fetchTransactions();
        if (onRefreshTrigger) onRefreshTrigger();
      }
    } catch (err) {
      console.error('Error updating manual category:', err);
    }
  };

  const handleDeleteTransaction = async (txId: number) => {
    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDeleteConfirmTxId(null);
        fetchTransactions();
        if (onRefreshTrigger) onRefreshTrigger();
      } else {
        const data = await res.json();
        console.error('Failed to delete transaction:', data.error);
      }
    } catch (err) {
      console.error('Error deleting transaction:', err);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'food': return 'bg-amber-50 text-amber-600 border border-amber-100';
      case 'groceries': return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      case 'shopping': return 'bg-purple-50 text-purple-600 border border-purple-100';
      case 'travel': return 'bg-cyan-50 text-cyan-600 border border-cyan-100';
      case 'fuel': return 'bg-orange-50 text-orange-600 border border-orange-100';
      case 'education': return 'bg-indigo-50 text-indigo-600 border border-indigo-100';
      case 'healthcare': return 'bg-rose-50 text-rose-600 border border-rose-100';
      case 'entertainment': return 'bg-pink-50 text-pink-600 border border-pink-100';
      case 'utilities':
      case 'bills': return 'bg-rose-50 text-rose-600 border border-rose-100';
      case 'investment': return 'bg-teal-50 text-teal-600 border border-teal-100';
      case 'rent': return 'bg-blue-50 text-blue-600 border border-blue-100';
      case 'salary': return 'bg-lime-50 text-lime-700 border border-lime-100';
      case 'business': return 'bg-sky-50 text-sky-700 border border-sky-100';
      case 'insurance': return 'bg-violet-50 text-violet-600 border border-violet-100';
      case 'donation': return 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100';
      case 'others':
      case 'other': return 'bg-slate-50 text-slate-600 border border-slate-100';
      default: return 'bg-slate-50 text-slate-600 border border-slate-100';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-0">
      {/* Search & Filters */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by receiver name, note, transaction reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm outline-none transition-all"
            />
          </div>

          {/* Export Group */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddManualModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
              title="Add Manual Expense"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Expense
            </button>
            <a
              href="/api/export/csv"
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Export as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </a>
            <a
              href="/api/export/excel"
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Export as Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </a>
            <a
              href="/api/export/pdf"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Open PDF Statement"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF Statement
            </a>
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category Filter</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-sky-500 font-semibold text-slate-700"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Transaction Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-sky-500 font-semibold text-slate-700"
            >
              <option value="All">All Types</option>
              <option value="SEND">Payments Sent</option>
              <option value="RECEIVE">Incoming Received</option>
              <option value="RECHARGE">Recharges</option>
              <option value="BILL">Utility Bills</option>
              <option value="MERCHANT">Merchant Spends</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sorting Arrangement</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-sky-500 font-semibold text-slate-700"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction Logs */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-xs font-semibold">
            Querying persistent transaction registry...
          </div>
        ) : transactions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const isReceive = tx.type === 'RECEIVE';
              const isEditing = editingTxId === tx.id;

              return (
                <div key={tx.id} className="p-4 md:p-5 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-bold text-sm ${getCategoryColor(tx.category)}`}>
                      {isReceive ? tx.sender_name[0] : tx.receiver_name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-800">
                          {isReceive ? tx.sender_name : tx.receiver_name}
                        </h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          tx.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
                        {tx.notes || 'GPay Digital Transfer'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-400 font-semibold">
                        <span className="font-mono text-slate-400">{tx.reference_id}</span>
                        <span>•</span>
                        <span>{tx.date} {tx.time}</span>
                        <span>•</span>
                        {/* Auto category badge + manual edit activator */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1 shrink-0">
                            <select
                              value={tx.category}
                              onChange={(e) => handleUpdateCategory(tx.id, e.target.value)}
                              className="text-[10px] font-bold bg-transparent border-0 outline-none p-0 text-slate-700 select-none"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setEditingTxId(null)}
                              className="text-rose-500 font-bold hover:underline shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${getCategoryColor(tx.category)}`}>
                              {tx.category}
                            </span>
                            <button
                              onClick={() => setEditingTxId(tx.id)}
                              className="text-sky-500 hover:text-sky-600 p-0.5 rounded hover:bg-slate-100 transition-colors"
                              title="Manually re-categorize"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-between md:justify-end gap-3.5 border-t md:border-0 border-slate-100 pt-3.5 md:pt-0">
                    {deleteConfirmTxId === tx.id ? (
                      <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl p-1.5 shrink-0 animate-pulse">
                        <span className="text-[10px] text-rose-700 font-bold">Delete & Revert?</span>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[9px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmTxId(null)}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[9px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-right flex flex-col items-end">
                          <span className={`text-base font-extrabold font-display ${isReceive ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {isReceive ? '+' : '-'} ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{tx.payment_method}</span>
                        </div>
                        <button
                          onClick={() => setDeleteConfirmTxId(tx.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Transaction Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400 text-xs">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No transaction records matched the chosen filter.
          </div>
        )}
      </div>

      {/* Manual Expense Modal Portal */}
      {showAddManualModal && (
        <AddManualExpenseModal
          onClose={() => setShowAddManualModal(false)}
          onSuccess={() => {
            fetchTransactions();
            if (onRefreshTrigger) onRefreshTrigger();
          }}
        />
      )}
    </div>
  );
}
