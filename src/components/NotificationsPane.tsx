import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, CheckCircle2, ShieldAlert, KeyRound, Flame, AlertCircle, X, Check, RefreshCw, Trash2 } from 'lucide-react';
import { Notification } from '../types';

interface NotificationsPaneProps {
  onNotificationRead?: () => void;
  onRefreshCounter: number;
}

export default function NotificationsPane({ onNotificationRead, onRefreshCounter }: NotificationsPaneProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    setSelectedIds([]); // Clear selections on refresh/counter updates
  }, [onRefreshCounter]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-read', { method: 'POST' });
      if (res.ok) {
        fetchNotifications();
        if (onNotificationRead) onNotificationRead();
      }
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState<'CLEAR_ALL' | 'DELETE_SELECTED' | null>(null);

  const handleClearAll = () => {
    setConfirmActionType('CLEAR_ALL');
    setShowConfirmModal(true);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setConfirmActionType('DELETE_SELECTED');
    setShowConfirmModal(true);
  };

  const executeClearAll = async () => {
    try {
      const res = await fetch('/api/notifications/clear-all', { method: 'POST' });
      if (res.ok) {
        setNotifications([]);
        setSelectedIds([]);
        if (onNotificationRead) onNotificationRead();
      }
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const executeDeleteSelected = async () => {
    try {
      const res = await fetch('/api/notifications/delete-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        fetchNotifications();
        setSelectedIds([]);
        if (onNotificationRead) onNotificationRead();
      }
    } catch (err) {
      console.error('Error deleting selected notifications:', err);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map((n) => n.id));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PAYMENT_SUCCESS':
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case 'PAYMENT_FAILED':
        return (
          <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        );
      case 'BUDGET_ALERT':
        return (
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
        );
      case 'OTP':
        return (
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
        );
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4 md:px-0">
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col gap-4 mb-4 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-sky-500" />
              <h3 className="text-sm font-extrabold text-slate-800 font-display">Notifications Hub</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-sky-500 text-white font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-sky-500 hover:text-sky-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-slate-400 hover:text-rose-500 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>
          </div>

          {/* Bulk Selection Actions Row */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <label className="flex items-center gap-2.5 text-xs text-slate-600 font-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifications.length > 0 && selectedIds.length === notifications.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-sky-500 focus:ring-sky-500 w-4 h-4"
                />
                <span>Select All ({selectedIds.length} of {notifications.length})</span>
              </label>

              {selectedIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-100"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <RefreshCw className="w-6 h-6 text-sky-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">Updating notification logs...</p>
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-3 pr-1">
            {notifications.map((n) => {
              const isSelected = selectedIds.includes(n.id);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-sky-50/70 border-sky-200 shadow-sm'
                      : !n.is_read
                      ? 'bg-sky-50/30 border-sky-100/50 hover:bg-sky-50/50'
                      : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="pt-1.5 select-none" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(n.id)}
                      className="rounded border-slate-300 text-sky-500 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 flex gap-3.5">
                    {getNotificationIcon(n.type)}
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-slate-800">{n.title}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">{n.created_at}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400 text-xs">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No notification alerts logged in this session.
          </div>
        )}
      </div>

      {/* Custom Confirmation Dialog (Iframe-safe) */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 font-display">Confirm Deletion</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-medium">
                {confirmActionType === 'CLEAR_ALL'
                  ? 'Are you sure you want to clear all notifications? This will permanently delete them from the database.'
                  : `Are you sure you want to delete the ${selectedIds.length} selected notification(s)?`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmActionType(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const type = confirmActionType;
                  setShowConfirmModal(false);
                  setConfirmActionType(null);
                  if (type === 'CLEAR_ALL') {
                    await executeClearAll();
                  } else {
                    await executeDeleteSelected();
                  }
                }}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-100 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
