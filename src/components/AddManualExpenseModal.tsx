import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Receipt, CheckCircle, RefreshCw } from 'lucide-react';

interface AddManualExpenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  'Food', 'Groceries', 'Shopping', 'Travel', 'Fuel', 'Education', 'Healthcare',
  'Entertainment', 'Bills', 'Investment', 'Rent', 'Salary', 'Business',
  'Insurance', 'Donation', 'Other'
];

export default function AddManualExpenseModal({
  onClose,
  onSuccess,
}: AddManualExpenseModalProps) {
  const [receiverName, setReceiverName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [deductFromWallet, setDeductFromWallet] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!receiverName.trim()) {
      return setError('Merchant or Vendor name is required.');
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      return setError('Please enter a valid amount greater than ₹0.');
    }

    setLoading(true);

    try {
      const res = await fetch('/api/transactions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverName: receiverName.trim(),
          amount: amtNum,
          category,
          date,
          notes: notes.trim(),
          paymentMethod,
          deductFromWallet,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add manual expense.');
      }

      setBudgetAlerts(data.budgetAlerts || []);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 font-display">Add Manual Expense</h3>
              <p className="text-[10px] text-slate-400 font-medium">Log cash, card, or custom transactions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Merchant / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Starbucks, Amazon, Rapido"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="150.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm font-bold text-slate-800 transition-all outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm font-semibold text-slate-700 transition-all outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Transaction Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-700 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm font-semibold text-slate-700 transition-all outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Morning team coffee meeting (Optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                />
              </div>

              {/* Deduct checkbox */}
              <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
                <div className="space-y-0.5 max-w-[80%]">
                  <span className="text-xs font-bold text-slate-700 block">Deduct from Wallet balance</span>
                  <span className="text-[10px] text-slate-400 block font-medium leading-tight">
                    Check this if you want the logged transaction to actively subtract from your sandbox balance.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deductFromWallet}
                    onChange={(e) => setDeductFromWallet(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Expense'
                  )}
                </button>
              </div>
            </form>
          ) : (
            // Standard single expense success
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-bold text-slate-800 font-display">Expense Added Successfully!</h4>
                <p className="text-xs text-slate-400 mt-1">Your transaction categorized under {category} has been logged.</p>
                <div className="text-2xl font-extrabold text-emerald-600 mt-3">₹{parseFloat(amount).toFixed(2)}</div>
              </div>

              {budgetAlerts.length > 0 && (
                <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 mt-4 space-y-2.5">
                  <span className="text-xs font-bold text-rose-700 block">Proactive Budget Warning:</span>
                  {budgetAlerts.map((alert, i) => (
                    <p key={i} className="text-xs text-rose-600">• {alert}</p>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-sm mt-6 cursor-pointer"
              >
                Return to History
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
