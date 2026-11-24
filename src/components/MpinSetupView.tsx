import React, { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, ShieldCheck, LogOut, RefreshCw, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface MpinSetupViewProps {
  user: User;
  onComplete: () => void;
  onLogout: () => void;
}

export default function MpinSetupView({ user, onComplete, onLogout }: MpinSetupViewProps) {
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!mpin || !confirmMpin) {
      setError('Please fill in both fields.');
      return;
    }

    if (mpin !== confirmMpin) {
      setError('MPIN and Confirm MPIN do not match.');
      return;
    }

    if (mpin.length !== 4 && mpin.length !== 6) {
      setError('MPIN must be exactly 4 or 6 digits.');
      return;
    }

    if (!/^\d+$/.test(mpin)) {
      setError('MPIN must contain digits only.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/set-initial-mpin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(user.id),
        },
        body: JSON.stringify({ mpin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create MPIN.');
      }

      setSuccess('MPIN created successfully! Unlocking your wallet...');
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Server error setting MPIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleMpinChange = (val: string) => {
    setMpin(val.replace(/\D/g, '').substring(0, 6));
  };

  const handleConfirmMpinChange = (val: string) => {
    setConfirmMpin(val.replace(/\D/g, '').substring(0, 6));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-100 shadow-xl relative overflow-hidden"
      >
        {/* Background glow accents */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-sky-50 text-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight font-display">
            Set Your Transaction MPIN
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-1 max-w-xs mx-auto">
            Welcome, <span className="text-slate-600">{user.full_name}</span>! Protect your GMUpay wallet by creating a secure transaction MPIN.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-[11px] flex items-start gap-1.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 font-bold text-[11px] flex items-center gap-1.5 animate-pulse">
              <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Create New 4 or 6 Digit MPIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                pattern="\d*"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={mpin}
                onChange={(e) => handleMpinChange(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/5 rounded-xl text-sm transition-all outline-none font-bold tracking-widest text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Confirm Your MPIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                pattern="\d*"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••"
                value={confirmMpin}
                onChange={(e) => handleConfirmMpinChange(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/5 rounded-xl text-sm transition-all outline-none font-bold tracking-widest text-center"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-extrabold rounded-xl text-xs shadow-md shadow-sky-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-sky-300"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              'Establish MPIN & Activate Wallet'
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
          <span>Security Ledger: Active</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout Session
          </button>
        </div>
      </motion.div>
    </div>
  );
}
