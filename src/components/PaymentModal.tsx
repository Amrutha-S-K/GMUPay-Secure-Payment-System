import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Landmark, HelpCircle, CheckCircle2, RefreshCw, KeyRound, Smartphone, ShieldCheck, QrCode } from 'lucide-react';
import { User, Bill } from '../types';

interface PaymentModalProps {
  user: User;
  type: 'SEND' | 'BILL' | 'RECHARGE' | 'REQUEST';
  targetBill?: Bill | null;
  onClose: () => void;
  onPaymentSuccess: (budgetAlerts: string[]) => void;
}

export default function PaymentModal({
  user,
  type,
  targetBill,
  onClose,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [receiverName, setReceiverName] = useState(targetBill ? targetBill.biller_name : '');
  const [receiverUpi, setReceiverUpi] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [operator, setOperator] = useState('Jio Pre-paid');
  const [amount, setAmount] = useState(targetBill ? targetBill.amount.toString() : '');
  const [notes, setNotes] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'form' | 'pin' | 'processing' | 'success' | 'forgot-mpin'>('form');
  const [error, setError] = useState('');
  const [refId, setRefId] = useState('');
  const [exceededAlerts, setExceededAlerts] = useState<string[]>([]);

  // Forgot MPIN sub-states
  const [forgotOtp, setForgotOtp] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotOtpCodeSent, setForgotOtpCodeSent] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Interactive bills state
  const [unpaidBills, setUnpaidBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string>('custom');

  // Trigger Forgot MPIN request
  const handleForgotMpinRequest = async () => {
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const res = await fetch('/api/auth/forgot-mpin-otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request OTP.');
      setForgotOtpCodeSent(data.debugOtp);
      setStep('forgot-mpin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // Submit Forgot MPIN reset
  const handleForgotMpinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    if (newMpin.length !== 4 && newMpin.length !== 6) {
      setForgotError('New MPIN must be exactly 4 or 6 digits.');
      setForgotLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/forgot-mpin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: forgotOtp, newMpin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset MPIN.');
      setForgotSuccess('MPIN reset successfully! Try entering it now.');
      setPin('');
      setTimeout(() => {
        setStep('pin');
        setForgotSuccess('');
        setForgotOtp('');
        setNewMpin('');
      }, 2000);
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  React.useEffect(() => {
    if (type === 'BILL') {
      if (targetBill) {
        setReceiverName(targetBill.biller_name);
        setAmount(targetBill.amount.toString());
        setSelectedBillId(targetBill.id.toString());
      } else {
        setLoadingBills(true);
        fetch('/api/bills')
          .then((res) => (res.ok ? res.json() : []))
          .then((data: Bill[]) => {
            const unpaid = data.filter((b) => b.status === 'UNPAID');
            setUnpaidBills(unpaid);
            if (unpaid.length > 0) {
              setSelectedBillId(unpaid[0].id.toString());
              setReceiverName(unpaid[0].biller_name);
              setAmount(unpaid[0].amount.toString());
            } else {
              setSelectedBillId('custom');
              setReceiverName('');
              setAmount('');
            }
          })
          .catch((err) => console.error('Error retrieving unpaid bills:', err))
          .finally(() => setLoadingBills(false));
      }
    }
  }, [type, targetBill]);

  const handleBillSelectChange = (billIdVal: string) => {
    setSelectedBillId(billIdVal);
    if (billIdVal === 'custom') {
      setReceiverName('');
      setAmount('');
    } else {
      const selected = unpaidBills.find((b) => b.id.toString() === billIdVal);
      if (selected) {
        setReceiverName(selected.biller_name);
        setAmount(selected.amount.toString());
      }
    }
  };

  const handleNextStep = () => {
    setError('');
    if (type === 'SEND') {
      if (!receiverName) return setError('Recipient name is required.');
      if (!receiverUpi || !receiverUpi.includes('@')) return setError('Please enter a valid recipient UPI ID (e.g., name@okaxis).');
      if (!amount || parseFloat(amount) <= 0) return setError('Please enter a valid transfer amount.');
    } else if (type === 'RECHARGE') {
      if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) return setError('Please enter a valid 10-digit mobile number.');
      if (!amount || parseFloat(amount) <= 0) return setError('Please enter a valid recharge amount.');
    } else if (type === 'BILL') {
      if (!receiverName) return setError('Utility Biller Name is required.');
      if (!amount || parseFloat(amount) <= 0) return setError('Bill amount is invalid.');
    }

    setStep('pin');
  };

  const requiredLen = user.mpin_length || 4;

  const handleKeyPress = (num: string) => {
    if (pin.length < requiredLen) {
      setPin((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleAuthorizePayment = async () => {
    if (pin.length !== requiredLen) {
      setError(`Please enter your ${requiredLen}-digit MPIN.`);
      return;
    }

    setError('');
    setStep('processing');

    const paymentBody: any = {
      amount: parseFloat(amount),
      pin,
      notes: notes || `${type} Payment`,
    };

    if (type === 'SEND') {
      paymentBody.type = 'SEND';
      paymentBody.receiverName = receiverName;
      paymentBody.receiverUpi = receiverUpi;
    } else if (type === 'BILL') {
      paymentBody.type = 'BILL';
      paymentBody.receiverName = receiverName;
      paymentBody.receiverUpi = 'billing@merchant';
      if (selectedBillId !== 'custom' && selectedBillId) {
        paymentBody.billId = parseInt(selectedBillId);
      }
    } else if (type === 'RECHARGE') {
      paymentBody.type = 'RECHARGE';
      paymentBody.receiverName = `${operator} (${mobileNumber})`;
      paymentBody.receiverUpi = 'recharge@carrier';
    }

    try {
      const res = await fetch('/api/transactions/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentBody),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Payment failed.');
      }

      setRefId(data.transaction.referenceId);
      setExceededAlerts(data.budgetAlerts || []);
      setStep('success');
    } catch (err: any) {
      setError(err.message);
      setStep('pin');
      setPin('');
    }
  };

  // QR Simulation for Request Money
  const getRequestQrLink = () => {
    const requestedAmt = parseFloat(amount) || 0;
    const upiLink = `upi://pay?pa=${user.upi_id}&pn=${encodeURIComponent(user.full_name)}&am=${requestedAmt}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`;
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
          <div>
            <span className="text-[10px] bg-sky-50 text-sky-600 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {type === 'REQUEST' ? 'Receive Money' : 'GPay Instant Secure'}
            </span>
            <h3 className="text-base font-extrabold text-slate-800 font-display mt-1">
              {type === 'SEND' && 'Send Money To Friend'}
              {type === 'BILL' && (targetBill ? `Pay Utility: ${targetBill.biller_name}` : 'Pay Utility & Bills')}
              {type === 'RECHARGE' && 'Mobile Operator Recharge'}
              {type === 'REQUEST' && 'Generate QR Code'}
            </h3>
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

          {/* ── STEP 1: FILL FORM ── */}
          {step === 'form' && (
            <div className="space-y-4">
              {type === 'SEND' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Friend Name</label>
                    <input
                      type="text"
                      placeholder="Rahul Kumar"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Recipient UPI ID</label>
                    <input
                      type="text"
                      placeholder="rahul@okaxis"
                      value={receiverUpi}
                      onChange={(e) => setReceiverUpi(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-medium"
                    />
                  </div>
                </>
              )}

              {type === 'RECHARGE' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">10-Digit Mobile Number</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Select Network Operator</label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all outline-none"
                    >
                      <option>Jio Pre-paid</option>
                      <option>Airtel Pre-paid</option>
                      <option>Vi (Vodafone Idea)</option>
                      <option>BSNL Pre-paid</option>
                    </select>
                  </div>
                </>
              )}

              {/* Dynamic Biller Selection for BILL type when no targetBill is supplied */}
              {type === 'BILL' && (
                <>
                  {!targetBill && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Select Outstanding Bill</label>
                        {loadingBills ? (
                          <div className="text-xs text-slate-400 font-medium py-2.5 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-4">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
                            Querying unpaid bills registry...
                          </div>
                        ) : (
                          <select
                            value={selectedBillId}
                            onChange={(e) => handleBillSelectChange(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all outline-none"
                          >
                            {unpaidBills.length > 0 ? (
                              unpaidBills.map((b) => (
                                <option key={b.id} value={b.id.toString()}>
                                  {b.bill_type} - {b.biller_name} (₹{b.amount.toFixed(2)})
                                </option>
                              ))
                            ) : (
                              <option disabled value="">No outstanding bills</option>
                            )}
                            <option value="custom">Pay a New Custom Utility Bill</option>
                          </select>
                        )}
                      </div>

                      {selectedBillId === 'custom' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Utility Biller Name</label>
                          <input
                            type="text"
                            placeholder="e.g. BESCOM Electricity, Airtel Broadband, Gas Bill"
                            value={receiverName}
                            onChange={(e) => setReceiverName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Amount & Notes (Generic for transfers) */}
              {type !== 'REQUEST' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Amount (INR)</label>
                    <input
                      type="number"
                      disabled={type === 'BILL' && selectedBillId !== 'custom'}
                      placeholder="100.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none font-bold text-slate-800 disabled:opacity-75 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">What is this for? (Notes)</label>
                    <input
                      type="text"
                      placeholder="Dinner party splitted expense..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                    />
                  </div>
                  <button
                    onClick={handleNextStep}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer"
                  >
                    Proceed with Secure PIN
                  </button>
                </>
              )}

              {/* REQUEST TYPE VIEW */}
              {type === 'REQUEST' && (
                <div className="text-center space-y-4 py-2">
                  <p className="text-xs text-slate-500">
                    Enter the amount you'd like to request. Friends can scan this customized QR code with any digital app.
                  </p>
                  <div className="max-w-xs mx-auto">
                    <label className="block text-left text-xs font-semibold text-slate-500 mb-1">Requested Amount (Optional)</label>
                    <input
                      type="number"
                      placeholder="Enter amount (e.g. ₹500)"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-center font-bold text-slate-800"
                    />
                  </div>

                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl w-fit mx-auto shadow-sm">
                    <img src={getRequestQrLink()} alt="payment-qr" className="w-40 h-40 object-contain rounded-lg" />
                    <span className="text-[11px] font-mono font-bold text-slate-600 mt-3 select-all">{user.upi_id}</span>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Every payment received via this QR will be simulated instantly on your wallet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: UPI PIN ENTRY (GPAY PIN SCREEN) ── */}
          {step === 'pin' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-semibold">GMUpay Secured Gateway</p>
                <div className="text-3xl font-extrabold font-display text-slate-800 mt-1">₹{parseFloat(amount).toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">To: {receiverName || 'Service Biller'}</p>
              </div>

              {/* PIN Indicator dots */}
              <div className="flex flex-col items-center space-y-1.5 my-3">
                <div className="flex justify-center gap-4">
                  {Array.from({ length: requiredLen }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border-2 border-sky-500 transition-all ${
                        pin.length > idx ? 'bg-sky-500 scale-110 shadow-sm shadow-sky-500/35' : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide text-center">
                  Enter exactly {requiredLen}-digit MPIN and press the Checkmark
                </span>
              </div>

              {/* Numeric Pad Grid */}
              <div className="grid grid-cols-3 gap-y-3 gap-x-6 max-w-xs mx-auto text-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-2xl text-lg transition-all active:scale-95 cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleBackspace}
                  className="py-3 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleKeyPress('0')}
                  className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-2xl text-lg transition-all active:scale-95 cursor-pointer"
                >
                  0
                </button>
                <button
                  disabled={pin.length !== requiredLen}
                  onClick={handleAuthorizePayment}
                  className={`py-3 font-bold rounded-2xl transition-all flex items-center justify-center cursor-pointer ${
                    pin.length === requiredLen
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>

              {/* Forgot MPIN Option */}
              <div className="text-center mt-4">
                <button
                  type="button"
                  disabled={forgotLoading}
                  onClick={handleForgotMpinRequest}
                  className="text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors cursor-pointer"
                >
                  {forgotLoading ? 'Sending Reset OTP...' : 'Forgot MPIN? Reset via OTP'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2.5: FORGOT MPIN RESET SCREEN ── */}
          {step === 'forgot-mpin' && (
            <form onSubmit={handleForgotMpinReset} className="space-y-4">
              <div className="text-center">
                <h4 className="text-sm font-extrabold text-slate-800">Reset Secured MPIN</h4>
                <p className="text-xs text-slate-400 mt-1">Verify with OTP code sent to your registered number</p>
              </div>

              {forgotOtpCodeSent && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold tracking-wider">Simulated Reset OTP</p>
                  <p className="text-lg font-black font-mono text-emerald-600 mt-0.5">{forgotOtpCodeSent}</p>
                </div>
              )}

              {forgotError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl font-medium">
                  {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl font-medium text-center">
                  {forgotSuccess}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Enter Reset OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-extrabold tracking-widest text-sm outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Set New 4 or 6-digit MPIN</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    placeholder="••••••"
                    value={newMpin}
                    onChange={(e) => setNewMpin(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold tracking-widest text-sm outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('pin')}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition-all shadow shadow-sky-500/10 flex items-center justify-center gap-1"
                >
                  {forgotLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Confirm Reset'}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3: PROCESSING SPINNER ── */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <RefreshCw className="w-12 h-12 text-sky-500 animate-spin" />
              <div className="text-center">
                <h4 className="text-sm font-bold text-slate-800">Processing Secured Transaction</h4>
                <p className="text-xs text-slate-400 mt-1">Verifying encrypted details and updating categories...</p>
              </div>
            </div>
          )}

          {/* ── STEP 4: SUCCESS VIEW ── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-bold text-slate-800 font-display">Payment Successful!</h4>
                <p className="text-xs text-slate-400 font-mono mt-1 select-all">TXN REF: {refId}</p>
                <div className="text-2xl font-extrabold text-emerald-600 mt-3">₹{parseFloat(amount).toFixed(2)}</div>
              </div>

              {/* Exceeded Alerts */}
              {exceededAlerts.length > 0 && (
                <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 mt-4 space-y-2.5">
                  <span className="text-xs font-bold text-rose-700 block">Proactive Budget Warning:</span>
                  {exceededAlerts.map((alert, i) => (
                    <p key={i} className="text-xs text-rose-600">
                      • {alert}
                    </p>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  onPaymentSuccess(exceededAlerts);
                  onClose();
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-sm mt-6 cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
