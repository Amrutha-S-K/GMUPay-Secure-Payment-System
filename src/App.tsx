import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, CreditCard, History as HistoryIcon, BarChart3, Bell, User as UserIcon, LogOut, CheckCircle2, ShieldAlert, Sparkles, Sliders, Play, PlusCircle, Clock } from 'lucide-react';
import { User, Bill, Transaction } from './types';

// Page Views
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import PaymentModal from './components/PaymentModal';
import Analytics from './components/Analytics';
import History from './components/History';
import BudgetsManager from './components/BudgetsManager';
import NotificationsPane from './components/NotificationsPane';
import ProfileSettings from './components/ProfileSettings';
import MpinSetupView from './components/MpinSetupView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState(true);

  // Stats & logs
  const [stats, setStats] = useState({
    balance: 15000.0,
    todaySpending: 0.0,
    monthlySpending: 0.0,
    monthlyBudget: null as number | null,
    remainingBudget: null as number | null,
    savingsThisMonth: 15000.0,
  });

  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Payment triggers
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalType, setPaymentModalType] = useState<'SEND' | 'BILL' | 'RECHARGE' | 'REQUEST'>('SEND');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Proactive Toast Notifications for active spending warnings
  const [toasts, setToasts] = useState<string[]>([]);

  // Refresher counter to trigger state fetch inside child components
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Time ticker
  const [currentTime, setCurrentTime] = useState('');

  const checkUserSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        fetchCoreData();
      } else {
        setUser(null);
        localStorage.removeItem('userId');
      }
    } catch (err) {
      console.error('Session verification error:', err);
      setUser(null);
      localStorage.removeItem('userId');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoreData = async () => {
    try {
      // Fetch stats
      const resStats = await fetch('/api/dashboard/stats');
      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData);
      }

      // Fetch recent transactions
      const resTxs = await fetch('/api/transactions?sort=newest');
      if (resTxs.ok) {
        const txsData = await resTxs.json();
        setRecentTransactions(txsData);
      }

      // Fetch unpaid bills
      const resBills = await fetch('/api/bills');
      if (resBills.ok) {
        const billsData = await resBills.json();
        setUpcomingBills(billsData);
      }

      // Fetch unread notifications count
      const resNotices = await fetch('/api/notifications');
      if (resNotices.ok) {
        const notices = await resNotices.json();
        setUnreadNotifications(notices.filter((n: any) => !n.is_read).length);
      }
    } catch (err) {
      console.error('Core metrics gathering error:', err);
    }
  };

  useEffect(() => {
    checkUserSession();
  }, []);

  // Set up live IST Clock for GPay status pairing
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format as YYYY-MM-DD HH:MM:SS IST
      const datePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
      const timePart = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now);
      setCurrentTime(`${datePart} ${timePart} IST`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      localStorage.removeItem('userId');
      setUser(null);
      setActiveTab('dashboard');
    }
  };

  const triggerDataRefresh = (budgetAlerts: string[] = []) => {
    setRefreshCounter((prev) => prev + 1);
    fetchCoreData();
    if (budgetAlerts.length > 0) {
      setToasts((prev) => [...prev, ...budgetAlerts]);
    }
  };

  const handleOpenPayment = (type: 'SEND' | 'BILL' | 'RECHARGE' | 'REQUEST', bill: any = null) => {
    setPaymentModalType(type);
    setSelectedBill(bill);
    if (type === 'BILL' && bill) {
      setSelectedBill(bill);
    }
    setShowPaymentModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-sky-500">GMU</div>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-4">Booting secure GMUpay sandbox...</p>
      </div>
    );
  }

  // Auth Screen Flow
  if (!user) {
    return authMode === 'login' ? (
      <Login
        onLoginSuccess={checkUserSession}
        onNavigateToRegister={() => setAuthMode('register')}
      />
    ) : (
      <Register
        onRegisterSuccess={checkUserSession}
        onNavigateToLogin={() => setAuthMode('login')}
      />
    );
  }

  // Mandatory initial MPIN Setup Flow upon login
  if (user && !user.has_mpin) {
    return (
      <MpinSetupView
        user={user}
        onComplete={checkUserSession}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-sky-200">
      {/* 1. Header Bar with GPay layout */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold tracking-tight shadow-md shadow-sky-500/10 font-display">
            GMU
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight leading-none font-display">GMUpay</h1>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">GPay Expense Engine</span>
          </div>
        </div>

        {/* Live IST Clock & Session Indicators */}
        <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{currentTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('notifications')}
            className="w-10 h-10 rounded-full hover:bg-slate-50 relative flex items-center justify-center text-slate-500 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Quick Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* 2. Main Page Layout (Centered Frame) */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-8 pt-8 pb-32">
        {/* Toast warnings container */}
        <div className="fixed top-20 right-4 z-50 space-y-2 max-w-xs">
          <AnimatePresence>
            {toasts.map((toast, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50 }}
                className="bg-rose-600 text-white p-3.5 rounded-2xl shadow-xl border border-rose-500/10 text-xs font-bold flex items-start gap-2"
              >
                <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <div className="flex-1">{toast}</div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((_, idx) => idx !== i))}
                  className="hover:bg-white/10 p-0.5 rounded"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Dynamic Tab Rendering */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard
                user={user}
                stats={stats}
                recentTransactions={recentTransactions}
                upcomingBills={upcomingBills}
                onOpenPay={handleOpenPayment}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'history' && (
              <History
                onRefreshTrigger={triggerDataRefresh}
                onRefreshCounter={refreshCounter}
              />
            )}

            {activeTab === 'analytics' && (
              <Analytics onRefreshTrigger={refreshCounter} />
            )}

            {activeTab === 'budgets' && (
              <BudgetsManager
                onRefreshTrigger={triggerDataRefresh}
                onRefreshCounter={refreshCounter}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsPane
                onNotificationRead={triggerDataRefresh}
                onRefreshCounter={refreshCounter}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileSettings
                user={user}
                onRefreshUser={checkUserSession}
                onLogout={handleLogout}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 3. Immersive Bottom Navigation Dock */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-100 px-4 md:px-8 py-2.5 shadow-lg flex items-center justify-around">
        {[
          { id: 'dashboard', label: 'Home', icon: Wallet },
          { id: 'history', label: 'History', icon: HistoryIcon },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'budgets', label: 'Budgets', icon: Sliders },
          { id: 'profile', label: 'Profile', icon: UserIcon },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center gap-1 relative py-1 px-3 group"
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-sky-50 text-sky-600 scale-110' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight transition-all ${
                  isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 4. Secure GPay Payment Portal Overlay */}
      <AnimatePresence>
        {showPaymentModal && (
          <PaymentModal
            user={user}
            type={paymentModalType}
            targetBill={selectedBill}
            onClose={() => setShowPaymentModal(false)}
            onPaymentSuccess={triggerDataRefresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
