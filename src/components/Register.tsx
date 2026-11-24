import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Phone, Lock, Hash, ShieldAlert, KeyRound, RefreshCw, CheckCircle } from 'lucide-react';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
}

export default function Register({ onRegisterSuccess, onNavigateToLogin }: RegisterProps) {
  const [step, setStep] = useState(1); // Step 1: Info, Step 2: Security & UPI, Step 3: OTP Code
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [upiId, setUpiId] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [mpinLength, setMpinLength] = useState<4 | 6>(4);
  const [otpCode, setOtpCode] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Success states
  const [isRegistered, setIsRegistered] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isRegistered && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isRegistered && countdown === 0) {
      onNavigateToLogin();
    }
  }, [isRegistered, countdown, onNavigateToLogin]);

  const validateStep1 = () => {
    setError('');
    if (!fullName || !email || !mobileNumber || !password || !confirmPassword) {
      setError('Please fill in all personal information fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setStep(2);
  };

  const startRegistration = async () => {
    setError('');
    if (!upiId || !pin || !confirmPin) {
      setError('UPI ID, Set MPIN, and Confirm MPIN are required.');
      return;
    }
    if (pin.length !== mpinLength) {
      setError(`MPIN must be exactly ${mpinLength} digits.`);
      return;
    }
    if (pin !== confirmPin) {
      setError('MPIN and Confirm MPIN do not match.');
      return;
    }

    setLoading(true);
    // Generate code
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedOtp(mockOtp);
    setStep(3);
    setLoading(false);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode !== simulatedOtp) {
      setError('Invalid OTP. Please try again.');
      setOtpCode('');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          mobileNumber,
          password,
          pin,
          upiId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      // Clear all form fields before redirecting
      setFullName('');
      setEmail('');
      setMobileNumber('');
      setPassword('');
      setConfirmPassword('');
      setUpiId('');
      setPin('');
      setConfirmPin('');
      setOtpCode('');
      setSimulatedOtp('');

      setIsRegistered(true);
    } catch (err: any) {
      setError(err.message);
      setStep(2); // Go back to correct info
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateUpi = () => {
    if (fullName) {
      const cleanName = fullName.toLowerCase().replace(/\s+/g, '');
      setUpiId(`${cleanName}@okaxis`);
    }
  };

  if (isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans selection:bg-sky-200">
        <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-sky-500/20 to-transparent pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-lg bg-white border border-slate-100 rounded-3xl shadow-xl p-8 relative z-10 overflow-hidden text-center"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-md shadow-emerald-500/10">
            <CheckCircle className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight mb-2">Registration Successful!</h1>
          <p className="text-xs text-slate-500 font-semibold mb-6">Your account has been created successfully.</p>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Redirecting you to the Login page automatically in <span className="font-bold text-sky-500">{countdown}</span> seconds...
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToLogin}
            className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans selection:bg-sky-200">
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-sky-500/20 to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-white border border-slate-100 rounded-3xl shadow-xl p-8 relative z-10 overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl" />

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">Create Wallet</h1>
          <p className="text-xs text-slate-500 mt-1">Join GMUpay & activate automatic categorization</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === num
                    ? 'bg-sky-500 text-white ring-4 ring-sky-100'
                    : step > num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {num}
              </div>
              {num < 3 && (
                <div
                  className={`w-12 h-1 rounded-full mx-1.5 transition-all ${
                    step > num ? 'bg-emerald-500' : 'bg-slate-100'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Messaging */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* STEP 1: PERSONAL INFORMATION */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rahul Kumar"
                  value={fullName}
                  onBlur={autoGenerateUpi}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={validateStep1}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              Continue to UPI Setup
            </button>
          </div>
        )}

        {/* STEP 2: UPI SETUP & PIN */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-600">Your Custom UPI ID</label>
                <button
                  type="button"
                  onClick={autoGenerateUpi}
                  className="text-[10px] text-sky-500 font-bold hover:underline"
                >
                  Generate from Name
                </button>
              </div>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="rahul@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-medium"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">This will act as your mock wallet address for transfers.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Choose MPIN Length</label>
              <div className="flex gap-2 mb-3">
                {[4, 6].map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => {
                      setMpinLength(len as 4 | 6);
                      setPin('');
                      setConfirmPin('');
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      mpinLength === len
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {len} Digits
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Set {mpinLength}-Digit Secure MPIN</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      maxLength={mpinLength}
                      placeholder={"••••••••".substring(0, mpinLength)}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-bold text-center tracking-widest"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Confirm Secure MPIN</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      maxLength={mpinLength}
                      placeholder={"••••••••".substring(0, mpinLength)}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-bold text-center tracking-widest"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Crucial for authorizing GPay simulation payments.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={startRegistration}
                className="flex-[2] py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Request Registration OTP'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP VERIFICATION */}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit} className="space-y-5">
            <div className="text-center bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-[11px] text-emerald-800 font-medium">Almost done! Registration security check in progress.</p>
              <p className="text-xs font-bold text-emerald-600 mt-0.5">Registration OTP: {simulatedOtp}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 text-center">Enter Verification OTP</label>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoComplete="off"
                className="w-full py-3 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-base transition-all outline-none text-center font-extrabold tracking-widest"
              />
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">Confirm with the OTP displayed in the verification box above.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify & Create Wallet'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <button
            onClick={onNavigateToLogin}
            className="text-sky-500 font-bold hover:underline"
          >
            Sign In here
          </button>
        </div>
      </motion.div>
    </div>
  );
}
