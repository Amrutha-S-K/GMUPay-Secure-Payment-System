import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, Mail, Phone, Lock, KeyRound, Shield, LogOut, Terminal, CheckCircle2, ShieldAlert, RefreshCw, Smartphone, Laptop, Fingerprint, X, Check, Camera, CameraOff } from 'lucide-react';
import { User, SecurityLog } from '../types';

interface ProfileSettingsProps {
  user: User;
  onRefreshUser: () => void;
  onLogout: () => void;
}

const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces',
];

export default function ProfileSettings({ user, onRefreshUser, onLogout }: ProfileSettingsProps) {
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [mobileNumber, setMobileNumber] = useState(user.mobile_number || '');

  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');

  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Biometrics & 1-Touch setup states
  const [fingerprintEnabled, setFingerprintEnabled] = useState(localStorage.getItem('fingerprint_enabled_' + user.email) === 'true');
  const [setupScanning, setSetupScanning] = useState<'NONE' | 'FINGERPRINT'>('NONE');
  const [setupScanProgress, setSetupScanProgress] = useState(0);

  // Interactive scanner states
  const [fingerPressed, setFingerPressed] = useState(false);
  const [biometricError, setBiometricError] = useState('');

  // Active finger hold interval ref
  const holdIntervalRef = React.useRef<any>(null);

  // Change MPIN states
  const [changeOldMpin, setChangeOldMpin] = useState('');
  const [changeNewMpin, setChangeNewMpin] = useState('');
  const [changeConfirmMpin, setChangeConfirmMpin] = useState('');
  const [changeOtp, setChangeOtp] = useState('');
  const [changeOtpSent, setChangeOtpSent] = useState('');
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  // Forgot MPIN states
  const [forgotNewMpin, setForgotNewMpin] = useState('');
  const [forgotConfirmMpin, setForgotConfirmMpin] = useState('');
  const [forgotOtpVal, setForgotOtpVal] = useState('');
  const [forgotOtpSent, setForgotOtpSent] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Trigger Change MPIN OTP request
  const handleRequestChangeMpinOtp = async () => {
    setChangeLoading(true);
    setChangeError('');
    setChangeSuccess('');
    try {
      const res = await fetch('/api/auth/change-mpin-otp-request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': String(user.id)
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request change OTP.');
      setChangeOtpSent(data.debugOtp);
      setChangeSuccess('Verification OTP sent to your registered mobile!');
    } catch (err: any) {
      setChangeError(err.message);
    } finally {
      setChangeLoading(false);
    }
  };

  const handleKeyDownMpin = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  // Submit Change MPIN
  const handleChangeMpin = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    setChangeLoading(true);
    setChangeError('');
    setChangeSuccess('');

    if (changeNewMpin !== changeConfirmMpin) {
      setChangeError('New MPIN and Confirm MPIN do not match.');
      setChangeLoading(false);
      return;
    }
    if ((changeNewMpin.length !== 4 && changeNewMpin.length !== 6) || !/^\d+$/.test(changeNewMpin)) {
      setChangeError('New MPIN must be exactly 4 or 6 digits.');
      setChangeLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-mpin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': String(user.id)
        },
        body: JSON.stringify({
          currentMpin: changeOldMpin,
          newMpin: changeNewMpin,
          otp: changeOtp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change MPIN.');
      setChangeSuccess('MPIN changed successfully!');
      setChangeOldMpin('');
      setChangeNewMpin('');
      setChangeConfirmMpin('');
      setChangeOtp('');
      setChangeOtpSent('');
      fetchSecurityLogs();
    } catch (err: any) {
      setChangeError(err.message);
    } finally {
      setChangeLoading(false);
    }
  };

  // Trigger Forgot MPIN OTP request
  const handleRequestForgotMpinOtp = async () => {
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const res = await fetch('/api/auth/forgot-mpin-otp-request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': String(user.id)
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset OTP.');
      setForgotOtpSent(data.debugOtp);
      setForgotSuccess('Reset OTP code sent to your registered mobile!');
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // Submit Forgot MPIN reset
  const handleForgotMpinReset = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    if (forgotNewMpin !== forgotConfirmMpin) {
      setForgotError('New MPIN and Confirm MPIN do not match.');
      setForgotLoading(false);
      return;
    }
    if ((forgotNewMpin.length !== 4 && forgotNewMpin.length !== 6) || !/^\d+$/.test(forgotNewMpin)) {
      setForgotError('New MPIN must be exactly 4 or 6 digits.');
      setForgotLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-mpin-reset', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': String(user.id)
        },
        body: JSON.stringify({
          otp: forgotOtpVal,
          newMpin: forgotNewMpin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset MPIN.');
      setForgotSuccess('MPIN reset successfully! You can now use your new MPIN.');
      setForgotNewMpin('');
      setForgotConfirmMpin('');
      setForgotOtpVal('');
      setForgotOtpSent('');
      fetchSecurityLogs();
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleToggleBiometric = async (checked: boolean) => {
    // Stop any active intervals first
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    
    setBiometricError('');
    setFingerPressed(false);
    setSetupScanProgress(0);

    if (!checked) {
      setFingerprintEnabled(false);
      localStorage.removeItem('fingerprint_enabled_' + user.email);
      localStorage.removeItem('fingerprint_hash_' + user.email);
      
      // Update security log on server
      fetch('/api/auth/register-biometric', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': String(user.id)
        },
        body: JSON.stringify({ enabled: false, type: 'FINGERPRINT' }),
      }).catch(console.error);
      return;
    }

    setSetupScanning('FINGERPRINT');
  };



  // Fingerprint setup press handlers
  const handleFingerprintMouseDown = () => {
    if (setupScanning !== 'FINGERPRINT') return;
    setFingerPressed(true);
    setBiometricError('');

    let currentProgress = setupScanProgress;
    holdIntervalRef.current = setInterval(() => {
      currentProgress += 5;
      setSetupScanProgress(Math.min(currentProgress, 100));
      
      if (currentProgress >= 100) {
        clearInterval(holdIntervalRef.current);
        setFingerPressed(false);
        setTimeout(() => {
          setFingerprintEnabled(true);
          // Store user-specific strict secure enrollment status
          localStorage.setItem('fingerprint_enabled_' + user.email, 'true');
          
          // Generate a strict digital minutiae signature template hash uniquely for this user
          const fpHash = 'GMUPAY-FP-SIG-' + btoa(user.email).substring(0, 14).toUpperCase();
          localStorage.setItem('fingerprint_hash_' + user.email, fpHash);
          setSetupScanning('NONE');

          // Update security log
          fetch('/api/auth/register-biometric', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-user-id': String(user.id)
            },
            body: JSON.stringify({ enabled: true, type: 'FINGERPRINT', fingerprintHash: fpHash }),
          }).catch(console.error);
          onRefreshUser();
        }, 400);
      }
    }, 100);
  };

  const handleFingerprintMouseUp = () => {
    if (setupScanning !== 'FINGERPRINT' || setupScanProgress >= 100) return;
    setFingerPressed(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    setBiometricError('Scan Failed: Finger released too early. Please press and hold until complete!');
    setSetupScanProgress(0);
  };

  const fetchSecurityLogs = async () => {
    try {
      setLoadingLogs(true);
      const [resLogs, resHistory] = await Promise.all([
        fetch('/api/profile/security-logs', { headers: { 'x-user-id': String(user.id) } }),
        fetch('/api/profile/login-history', { headers: { 'x-user-id': String(user.id) } })
      ]);
      
      if (resLogs.ok) {
        const data = await resLogs.json();
        setSecurityLogs(data);
      }
      if (resHistory.ok) {
        const data = await resHistory.json();
        setLoginHistory(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSecurityLogs();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (newPin && (newPin.length !== 4 || !/^\d+$/.test(newPin))) {
      setError('UPI PIN must be exactly 4 digits.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': String(user.id)
        },
        body: JSON.stringify({
          fullName,
          email,
          mobileNumber,
          password: newPassword || undefined,
          pin: newPin || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile settings.');
      }

      setSuccess('Profile and security details updated successfully!');
      setNewPassword('');
      setNewPin('');
      onRefreshUser();
      fetchSecurityLogs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/profile/delete-account', { 
        method: 'POST',
        headers: { 'x-user-id': String(user.id) }
      });
      if (res.ok) {
        onLogout();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete account.');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 md:px-0">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Settings */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Shield className="w-5 h-5 text-sky-500" />
            <h3 className="text-sm font-extrabold text-slate-800 font-display">Manage Profile & Security</h3>
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">{error}</div>}
          {success && <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold">{success}</div>}

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Your GPay UPI ID (Readonly)</label>
                <div className="relative">
                  <Terminal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    disabled
                    value={user.upi_id}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm outline-none font-mono font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Update Security Credentials</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Change Account Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Enter new password (optional)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reset 4-Digit GPay Security PIN</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="Enter new 4-digit PIN (optional)"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-extrabold text-center tracking-widest"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Secure Wallet MPIN Management */}
            <div className="border-t border-slate-100 pt-5 mt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Secure Wallet MPIN Management</h4>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Your MPIN is a 4-digit or 6-digit credential used to authenticate financial transactions. Set up, change, or recover it below.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Change MPIN Block */}
                <div className="bg-slate-50/60 border border-slate-200/60 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-sky-500" />
                    <h5 className="text-xs font-bold text-slate-800">Change Wallet MPIN</h5>
                  </div>

                  {changeError && <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-[11px] font-semibold">{changeError}</div>}
                  {changeSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-[11px] font-semibold">{changeSuccess}</div>}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Current MPIN</label>
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="•••• / ••••••"
                        value={changeOldMpin}
                        onChange={(e) => setChangeOldMpin(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleKeyDownMpin(e, handleChangeMpin)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-mono font-bold tracking-widest outline-none text-center"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">New MPIN (4/6 dig)</label>
                        <input
                          type="password"
                          maxLength={6}
                          placeholder="••••••"
                          value={changeNewMpin}
                          onChange={(e) => setChangeNewMpin(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => handleKeyDownMpin(e, handleChangeMpin)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-mono font-bold tracking-widest outline-none text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confirm New</label>
                        <input
                          type="password"
                          maxLength={6}
                          placeholder="••••••"
                          value={changeConfirmMpin}
                          onChange={(e) => setChangeConfirmMpin(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => handleKeyDownMpin(e, handleChangeMpin)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-mono font-bold tracking-widest outline-none text-center"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      {changeOtpSent ? (
                        <div className="space-y-2">
                          <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-xl">
                            <span className="block text-[10px] font-bold text-sky-800 uppercase mb-1">Enter OTP code</span>
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="123456"
                              value={changeOtp}
                              onChange={(e) => setChangeOtp(e.target.value.replace(/\D/g, ''))}
                              onKeyDown={(e) => handleKeyDownMpin(e, handleChangeMpin)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-sky-500 rounded-lg text-xs font-bold text-center outline-none"
                            />
                            <p className="text-[10px] text-sky-600 font-bold mt-1.5 text-center bg-white border border-sky-100 rounded p-1">
                              Simulated Code Sent: <span className="font-mono text-xs text-rose-500 font-extrabold">{changeOtpSent}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeMpin()}
                            disabled={changeLoading}
                            className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all disabled:bg-sky-300 cursor-pointer"
                          >
                            {changeLoading ? 'Updating...' : 'Verify & Change MPIN'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestChangeMpinOtp}
                          disabled={changeLoading || !changeOldMpin || !changeNewMpin || !changeConfirmMpin}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                        >
                          {changeLoading ? 'Sending OTP...' : 'Request MPIN Change OTP'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Forgot MPIN Block */}
                <div className="bg-slate-50/60 border border-slate-200/60 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sky-500" />
                    <h5 className="text-xs font-bold text-slate-800">Forgot / Recover MPIN</h5>
                  </div>

                  {forgotError && <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-[11px] font-semibold">{forgotError}</div>}
                  {forgotSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-[11px] font-semibold">{forgotSuccess}</div>}

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">New MPIN (4/6 dig)</label>
                        <input
                          type="password"
                          maxLength={6}
                          placeholder="••••••"
                          value={forgotNewMpin}
                          onChange={(e) => setForgotNewMpin(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => handleKeyDownMpin(e, handleForgotMpinReset)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-mono font-bold tracking-widest outline-none text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confirm New</label>
                        <input
                          type="password"
                          maxLength={6}
                          placeholder="••••••"
                          value={forgotConfirmMpin}
                          onChange={(e) => setForgotConfirmMpin(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => handleKeyDownMpin(e, handleForgotMpinReset)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-sky-500 rounded-xl text-xs font-mono font-bold tracking-widest outline-none text-center"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      {forgotOtpSent ? (
                        <div className="space-y-2">
                          <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-xl">
                            <span className="block text-[10px] font-bold text-sky-800 uppercase mb-1">Enter Verification OTP</span>
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="123456"
                              value={forgotOtpVal}
                              onChange={(e) => setForgotOtpVal(e.target.value.replace(/\D/g, ''))}
                              onKeyDown={(e) => handleKeyDownMpin(e, handleForgotMpinReset)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-sky-500 rounded-lg text-xs font-bold text-center outline-none"
                            />
                            <p className="text-[10px] text-sky-600 font-bold mt-1.5 text-center bg-white border border-sky-100 rounded p-1">
                              Simulated Code Sent: <span className="font-mono text-xs text-rose-500 font-extrabold">{forgotOtpSent}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleForgotMpinReset()}
                            disabled={forgotLoading}
                            className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all disabled:bg-sky-300 cursor-pointer"
                          >
                            {forgotLoading ? 'Resetting...' : 'Verify & Reset MPIN'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestForgotMpinOtp}
                          disabled={forgotLoading || !forgotNewMpin || !forgotConfirmMpin}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                        >
                          {forgotLoading ? 'Sending OTP...' : 'Send Forgot MPIN OTP'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Biometric Security Preferences */}
            <div className="border-t border-slate-100 pt-5 mt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Biometric Security Preferences</h4>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Configure touch-based secure authentication protocols for one-touch wallet authorization.
              </p>
              
              <div className="max-w-md space-y-3 mb-4">
                {/* Fingerprint Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-2xl transition-all hover:bg-slate-50/80">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Fingerprint Sign-in</h5>
                      <p className="text-[10px] text-slate-400 font-semibold">Touch ID Authentication</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fingerprintEnabled}
                      onChange={(e) => handleToggleBiometric(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-sky-300"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Apply Updates'}
              </button>
            </div>

            <div className="border-t border-rose-100 pt-5 mt-6 bg-rose-50/30 -mx-6 px-6 pb-6 rounded-b-3xl">
              <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-display">
                <ShieldAlert className="w-4 h-4" /> Danger Zone
              </h4>
              <p className="text-[11px] text-slate-500 mb-4">
                Permanently deactivate your wallet profile and securely remove your personal details (Name, Email, Mobile Number, Password, Biometrics, MPIN, OTP logs, and security settings) from our database. Financial transactions and payment history will be preserved as anonymized "Deleted User" records to maintain structural integrity. This action is irreversible.
              </p>
              
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full md:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-rose-600/10"
                >
                  Delete Account & Clear All Data
                </button>
              ) : (
                <div className="space-y-3 bg-white p-4 border border-rose-100 rounded-2xl">
                  <p className="text-xs font-bold text-rose-700">Are you absolutely sure? This will delete all your data permanently.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleDeleteAccount}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-all disabled:bg-rose-300"
                    >
                      {loading ? 'Deleting...' : 'Yes, Delete Everything'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Security Auditing logs & Device Login History */}
        <div className="space-y-6">
          {/* Card 1: Device Login History */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm h-fit">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4.5 h-4.5 text-slate-600" />
                <h3 className="text-sm font-extrabold text-slate-800 font-display">Device Login History</h3>
              </div>
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                Database Log
              </span>
            </div>

            {loadingLogs ? (
              <div className="text-center py-6 text-slate-400 text-xs">Querying database login ledger...</div>
            ) : loginHistory.length > 0 ? (
              <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                {loginHistory.map((lh: any) => {
                  const isFail = lh.status !== 'SUCCESS';
                  const isMobile = lh.device_name.toLowerCase().includes('mobile');
                  return (
                    <div key={lh.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${isFail ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                          {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-tight">{lh.device_name}</p>
                          <p className="text-[9px] text-slate-400 font-medium mt-0.5">{lh.created_at}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${isFail ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {lh.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">No logins recorded in SQLite 3.</div>
            )}
          </div>

          {/* Card 2: System Security Logs */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm h-fit">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Terminal className="w-4.5 h-4.5 text-slate-600" />
              <h3 className="text-sm font-extrabold text-slate-800 font-display">System Security Logs</h3>
            </div>

            {loadingLogs ? (
              <div className="text-center py-6 text-slate-400 text-xs">Querying security ledger...</div>
            ) : securityLogs.length > 0 ? (
              <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                {securityLogs.map((log) => {
                  const isFail = log.event_type.includes('FAIL') || log.event_type.includes('LOCK');
                  return (
                    <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${isFail ? 'bg-rose-50 text-rose-600' : 'bg-slate-200 text-slate-700'}`}>
                          {log.event_type}
                        </span>
                        <span className="text-[8px] text-slate-400 font-semibold">{log.created_at}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">No audit events logged.</div>
            )}
          </div>
        </div>
      </div>

      {setupScanning === 'FINGERPRINT' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden border border-slate-100"
          >
            {/* Close / Cancel Button with high z-index */}
            <button
              onClick={() => {
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
                setSetupScanning('NONE');
              }}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer z-20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute -top-10 -right-10 w-28 h-28 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
            
            <h3 className="text-sm font-extrabold text-slate-800 mb-2 font-display">
              Setup Fingerprint Sign-in
            </h3>

            <div className="space-y-4 my-6">
              {/* Fingerprint Interactive Area */}
              <div className="flex flex-col items-center justify-center">
                <button
                  type="button"
                  onMouseDown={handleFingerprintMouseDown}
                  onMouseUp={handleFingerprintMouseUp}
                  onMouseLeave={handleFingerprintMouseUp}
                  onTouchStart={(e) => { e.preventDefault(); handleFingerprintMouseDown(); }}
                  onTouchEnd={handleFingerprintMouseUp}
                  className={`w-28 h-28 rounded-full border-4 flex items-center justify-center transition-all cursor-pointer relative select-none ${
                    fingerPressed 
                      ? 'border-sky-500 bg-sky-50 shadow-lg shadow-sky-500/20 scale-95 ring-8 ring-sky-500/10' 
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                >
                  {/* Ring filler effect */}
                  {fingerPressed && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90 scale-105 pointer-events-none">
                      <circle
                        cx="52"
                        cy="52"
                        r="48"
                        className="stroke-sky-500 fill-none"
                        strokeWidth="4"
                        strokeDasharray="301.6"
                        strokeDashoffset={301.6 - (301.6 * setupScanProgress) / 100}
                        style={{ transition: 'stroke-dashoffset 100ms linear' }}
                      />
                    </svg>
                  )}

                  <Fingerprint className={`w-14 h-14 ${fingerPressed ? 'text-sky-500 scale-110 animate-pulse' : 'text-slate-400'}`} />
                </button>
                
                <span className="text-[10px] text-slate-400 font-mono mt-3 font-semibold tracking-wider">
                  {fingerPressed ? 'CALIBRATING SECURITY SENSOR...' : 'PRESS & HOLD TO SCAN'}
                </span>
              </div>

              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed px-2">
                Place and hold your finger firmly on the fingerprint scanner to calibrate. <strong>Do not release</strong> until progress is 100%.
              </p>

              {biometricError && (
                <div className="text-[11px] font-bold text-rose-500 bg-rose-50 border border-rose-100 p-2.5 rounded-xl animate-shake">
                  {biometricError}
                </div>
              )}

              {/* Progress indicator */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                <div 
                  className="bg-sky-500 h-full transition-all duration-75"
                  style={{ width: `${setupScanProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>SCAN PROGRESS...</span>
                <span>{setupScanProgress}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}


    </div>
  );
}
