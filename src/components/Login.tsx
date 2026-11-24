import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Phone, KeyRound, ShieldAlert, Fingerprint, RefreshCw, Eye, EyeOff, X, Check } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
  onNavigateToRegister: () => void;
}

export default function Login({ onLoginSuccess, onNavigateToRegister }: LoginProps) {
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp' | 'biometric'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Biometric active scanning states
  const [activeScanning, setActiveScanning] = useState<'NONE' | 'FINGERPRINT'>('NONE');
  const [activeScanProgress, setActiveScanProgress] = useState(0);

  // Interactive scanner states
  const [fingerPressed, setFingerPressed] = useState(false);
  const [biometricError, setBiometricError] = useState('');

  // Active finger hold interval ref
  const holdIntervalRef = React.useRef<any>(null);

  // OTP expiry countdown
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const getDeviceName = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Mobile')) return 'Mobile Phone';
    if (userAgent.includes('Macintosh')) return 'macOS Laptop';
    if (userAgent.includes('Windows')) return 'Windows Desktop';
    return 'Web Browser';
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          deviceName: getDeviceName(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      if (rememberDevice) {
        localStorage.setItem('smartpay_remembered_email', email);
      } else {
        localStorage.removeItem('smartpay_remembered_email');
      }

      onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login-otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request OTP.');
      }

      setIsOtpSent(true);
      setDebugOtp(data.debugOtp || '');
      setOtpCountdown(120); // 2 minutes
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login-otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp,
          mobileNumber,
          deviceName: getDeviceName(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'OTP verification failed.');
      }

      onLoginSuccess();
    } catch (err: any) {
      setError('Invalid OTP. Please try again.');
      setOtp(''); // Clear all OTP fields automatically for clean immediate retry
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    setBiometricError('');
    setFingerPressed(false);
    setActiveScanProgress(0);

    // Ensure email is available
    const inputEmail = email || localStorage.getItem('smartpay_remembered_email') || '';
    if (!inputEmail) {
      setError('Please provide your email address first to authenticate via Biometrics.');
      return;
    }

    // Check if the biometric is enabled in Settings for this specific user
    const isFingerEnabled = localStorage.getItem('fingerprint_enabled_' + inputEmail) === 'true';

    if (!isFingerEnabled) {
      setError('Strict Security Enforced: No registered fingerprint pattern found for this account on this device. Please log in with password/OTP first and enroll in Profile Settings.');
      return;
    }

    setActiveScanning('FINGERPRINT');
  };

  // Fingerprint login press-and-hold handlers
  const handleFingerprintLoginDown = () => {
    if (activeScanning !== 'FINGERPRINT') return;
    setFingerPressed(true);
    setBiometricError('');

    const inputEmail = email || localStorage.getItem('smartpay_remembered_email') || '';
    let currentProgress = activeScanProgress;

    holdIntervalRef.current = setInterval(async () => {
      currentProgress += 5;
      setActiveScanProgress(Math.min(currentProgress, 100));

      if (currentProgress >= 100) {
        clearInterval(holdIntervalRef.current);
        setFingerPressed(false);

        // Verify strict local device token matches
        const registeredToken = localStorage.getItem('fingerprint_hash_' + inputEmail);
        if (!registeredToken) {
          setBiometricError("Verification Error: No secure local token matches. Please re-register your fingerprint in Settings.");
          setActiveScanProgress(0);
          return;
        }

        // Execute backend auth
        try {
          const res = await fetch('/api/auth/login-biometric', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: inputEmail,
              type: 'FINGERPRINT',
              fingerprintHash: registeredToken,
              deviceName: getDeviceName(),
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Biometric login failed.');
          }

          setActiveScanning('NONE');
          onLoginSuccess();
        } catch (err: any) {
          setError(err.message);
          setActiveScanning('NONE');
        }
      }
    }, 100);
  };

  const handleFingerprintLoginUp = () => {
    if (activeScanning !== 'FINGERPRINT' || activeScanProgress >= 100) return;
    setFingerPressed(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    setBiometricError('Verification Failed: Finger released too early. Please press and hold until authenticated!');
    setActiveScanProgress(0);
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('smartpay_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberDevice(true);
    }

    // Check if biometrics are enabled and auto-select biometric tab on login page load
    const fingerEnabled = localStorage.getItem('fingerprint_enabled') === 'true';
    if (fingerEnabled) {
      setLoginMethod('biometric');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans selection:bg-sky-200">
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-sky-500/20 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100 p-8 relative z-10 overflow-hidden"
      >
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl" />

        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 mb-3">
            <span className="text-2xl font-bold font-display tracking-tight">GMU</span>
          </div>
          <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">GMUpay</h1>
          <p className="text-sm text-slate-500 mt-1">GPay Experience • Intelligent Categorization</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setLoginMethod('password'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              loginMethod === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Password
          </button>
          <button
            onClick={() => { setLoginMethod('otp'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              loginMethod === 'otp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            OTP Code
          </button>
          <button
            onClick={() => { setLoginMethod('biometric'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              loginMethod === 'biometric' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Biometric
          </button>
        </div>

        {/* Error Messaging */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* 1. PASSWORD METHOD */}
        {loginMethod === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="rounded border-slate-300 text-sky-500 focus:ring-sky-500 w-4 h-4"
                />
                Remember Device
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-sky-500/15 flex items-center justify-center gap-2 disabled:bg-sky-300 disabled:cursor-not-allowed"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        )}

        {/* 2. OTP METHOD */}
        {loginMethod === 'otp' && (
          <div className="space-y-4">
            {!isOtpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g., 9876543210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Get OTP Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-sky-50 border border-sky-100 p-3 rounded-2xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-sky-700 tracking-wider uppercase">Local Device Sim</span>
                    <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-mono font-bold">Auto OTP</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Received OTP SMS code:{' '}
                    <span className="font-mono font-extrabold text-sky-600 select-all tracking-wider bg-white px-2 py-0.5 rounded border border-sky-100 shadow-sm">
                      {debugOtp}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider font-display">Enter OTP Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="••••••"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none tracking-widest font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs py-1">
                  <span className="text-slate-400">
                    {otpCountdown > 0 ? `Expires in ${Math.floor(otpCountdown / 60)}:${(otpCountdown % 60).toString().padStart(2, '0')}` : 'OTP expired'}
                  </span>
                  {otpCountdown === 0 && (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="text-sky-500 font-bold hover:underline"
                    >
                      Resend OTP code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Code & Sign In'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* 3. BIOMETRIC METHOD */}
        {loginMethod === 'biometric' && (
          <div className="space-y-5 text-center py-4">
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Access your secure wallet instantly using local fingerprint authentication.
            </p>

            <div className="max-w-xs mx-auto text-left">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleBiometricLogin()}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white transition-all shadow rounded-xl font-bold text-xs cursor-pointer w-full"
              >
                <Fingerprint className="w-4 h-4 animate-pulse" />
                <span>Verify Fingerprint</span>
              </motion.button>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
          New to GMUpay?{' '}
          <button
            onClick={onNavigateToRegister}
            className="text-sky-500 font-bold hover:underline"
          >
            Create an Account
          </button>
        </div>
      </motion.div>

      {activeScanning !== 'NONE' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden border border-slate-100"
          >
            {/* Close / Cancel Button */}
            <button
              onClick={() => {
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
                setActiveScanning('NONE');
              }}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer z-20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute -top-10 -right-10 w-28 h-28 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
            
            <h3 className="text-sm font-extrabold text-slate-800 mb-2 font-display">
              Fingerprint Authentication
            </h3>

            <div className="space-y-4 my-6">
              {/* Fingerprint Interactive Pad */}
              <div className="flex flex-col items-center justify-center py-6 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-sky-50/10 to-transparent pointer-events-none" />
                <motion.button
                  onMouseDown={handleFingerprintLoginDown}
                  onMouseUp={handleFingerprintLoginUp}
                  onMouseLeave={handleFingerprintLoginUp}
                  onTouchStart={handleFingerprintLoginDown}
                  onTouchEnd={handleFingerprintLoginUp}
                  animate={fingerPressed ? { scale: 0.95 } : { scale: 1 }}
                  className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all shadow-inner relative cursor-pointer select-none ${
                    fingerPressed ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                >
                  <Fingerprint className={`w-12 h-12 transition-all ${
                    fingerPressed ? 'text-sky-500 scale-110 animate-pulse' : 'text-slate-400'
                  }`} />
                  {fingerPressed && (
                    <div className="absolute inset-2 border-2 border-dashed border-sky-500 rounded-full animate-spin [animation-duration:8s]" />
                  )}
                </motion.button>
                <span className="text-[9px] text-slate-400 font-bold uppercase mt-3 tracking-wider">
                  {fingerPressed ? 'Scanning... Keep finger pressed' : 'Press and hold sensor above'}
                </span>
              </div>

              {/* Progress indicator */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                <div 
                  className="bg-sky-500 h-full transition-all duration-75"
                  style={{ width: `${activeScanProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>AUTHENTICATING...</span>
                <span>{activeScanProgress}%</span>
              </div>
            </div>

            {biometricError && (
              <div className="text-[11px] font-bold text-rose-500 bg-rose-50 border border-rose-100 p-2.5 rounded-xl mt-3 animate-shake">
                {biometricError}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
