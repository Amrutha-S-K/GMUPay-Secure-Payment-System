import express from 'express';
import path from 'path';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { getDb, predictCategory } from './server/db.js';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';

// Encryption configuration for securing biometric data
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || 'smartpay_biometrics_secret_key_32bytes_default',
  'salt_biometrics_smartpay',
  32
);
const IV_LENGTH = 16;

function encryptBiometric(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptBiometric(text: string): string {
  const textParts = text.split(':');
  if (textParts.length < 2) return '';
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(
  session({
    secret: 'smartpay-secret-key-ultra-secure-2026',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Set to true if HTTPS is used
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// Helper for Session Cast
function getSession(req: express.Request): any {
  const sessionObj = req.session as any;

  // Robust fallback for iframe environments where third-party cookies are blocked by modern browsers.
  // We allow passing the user ID via a custom header 'x-user-id' from the client.
  const headerUserId = req.headers['x-user-id'];
  if (headerUserId) {
    sessionObj.userId = Number(headerUserId);
  }

  return sessionObj;
}

// Helper to get current Indian Standard Time (IST) date and time
function getISTDateTime(): { dateStr: string; timeStr: string; monthStr: string } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);
  const monthStr = dateStr.substring(0, 7);
  return { dateStr, timeStr, monthStr };
}

// ─── AUTHENTICATION ENDPOINTS ────────────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, mobileNumber, password, pin, upiId } = req.body;

    if (!fullName || !email || !mobileNumber || !password || !pin || !upiId) {
      return res.status(400).json({ error: 'All registration fields are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if ((pin.length !== 4 && pin.length !== 6) || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: 'MPIN must be a 4-digit or 6-digit number.' });
    }

    const db = await getDb();

    // Check if user already exists
    const existing = await db.get(
      'SELECT id FROM users WHERE email = ? OR mobile_number = ? OR upi_id = ?',
      [email, mobileNumber, upiId]
    );

    if (existing) {
      return res.status(400).json({
        error: 'An account with this email, mobile number, or UPI ID already exists.',
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const pinHash = bcrypt.hashSync(pin, 10);

    // Use a transaction block to make registration atomic (avoiding orphaned/half-created accounts on subsequent errors)
    await db.run('BEGIN TRANSACTION');

    try {
      const result = await db.run(
        `INSERT INTO users (full_name, email, mobile_number, password_hash, upi_id, pin_hash, mpin_hash, mpin_length, balance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 15000.0)`,
        [fullName, email, mobileNumber, passwordHash, upiId, pinHash, pinHash, pin.length]
      );

      const userId = result.lastID;

      // Seed default upcoming bills for simulation
      const today = new Date();
      const formatDate = (daysAhead: number) => {
        const d = new Date();
        d.setDate(today.getDate() + daysAhead);
        return d.toISOString().split('T')[0];
      };

      await db.run(
        `INSERT INTO bills (user_id, bill_type, biller_name, amount, due_date, status) VALUES 
         (?, 'Electricity', 'BESCOM Electricity', 1450.00, ?, 'UNPAID'),
         (?, 'Internet', 'Airtel Broadband', 799.00, ?, 'UNPAID'),
         (?, 'Gas', 'Indane LPG Gas', 950.00, ?, 'UNPAID'),
         (?, 'Water', 'BWSSB Water Bill', 320.00, ?, 'UNPAID')`,
        [userId, formatDate(5), userId, formatDate(12), userId, formatDate(18), userId, formatDate(25)]
      );

      // Seed sample transactions so charts immediately look awesome
      const formatPastDate = (daysAgo: number) => {
        const d = new Date();
        d.setDate(today.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
      };

      // Fix parameter count bindings (20 placeholders require 20 params in exact order)
      // To prevent multi-user seed collisions on reference_id (since reference_id is UNIQUE),
      // we append the userId directly to the transaction reference string: 'TXN' || ? || datetime(...)
      await db.run(
        `INSERT INTO transactions (user_id, type, amount, sender_name, sender_upi, receiver_name, receiver_upi, merchant_name, category, payment_method, status, reference_id, date, time, notes) VALUES
         (?, 'RECEIVE', 25000.0, 'Acme Corp', 'acme@hdfc', ?, ?, NULL, 'Salary', 'BANK_TRANSFER', 'SUCCESS', 'TXN' || ? || datetime('now', '-3 days'), ?, '10:00:00', 'Monthly Salary Credit'),
         (?, 'MERCHANT', 320.00, ?, ?, 'Swiggy Food Delivery', 'swiggy@paytm', 'Swiggy', 'Food', 'UPI_PIN', 'SUCCESS', 'TXN' || ? || datetime('now', '-2 days'), ?, '20:15:00', 'Dinner order'),
         (?, 'MERCHANT', 850.00, ?, ?, 'Blinkit Grocery', 'blinkit@ybl', 'Blinkit', 'Groceries', 'UPI_PIN', 'SUCCESS', 'TXN' || ? || datetime('now', '-1 days'), ?, '11:30:00', 'Weekly essentials'),
         (?, 'BILL', 1200.00, ?, ?, 'HDFC Ergo', 'hdfcergo@axis', 'HDFC Ergo', 'Insurance', 'UPI_PIN', 'SUCCESS', 'TXN' || ? || datetime('now'), ?, '14:20:00', 'Bike Insurance Renewal')`,
        [
          // Row 1: 5 placeholders
          userId, fullName, upiId, userId, formatPastDate(3),
          // Row 2: 5 placeholders
          userId, fullName, upiId, userId, formatPastDate(2),
          // Row 3: 5 placeholders
          userId, fullName, upiId, userId, formatPastDate(1),
          // Row 4: 5 placeholders
          userId, fullName, upiId, userId, formatPastDate(0)
        ]
      );

      // Seed security log
      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'REGISTRATION_SUCCESS', 'Account registered and wallet loaded with ₹15,000.00')`,
        [userId]
      );

      // Seed a welcome notification
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Welcome to GMUpay!', 'Your smart wallet has been created and loaded with ₹15,000.00 trial balance.', 'SECURITY')`,
        [userId]
      );

      // Add login_history entry for registration (automatic sign-in)
      await db.run(
        `INSERT INTO login_history (user_id, device_name, status) VALUES (?, 'Registered Device', 'SUCCESS')`,
        [userId]
      );

      await db.run('COMMIT');

      return res.json({ success: true, message: 'Registration successful!', userId });
    } catch (dbError: any) {
      await db.run('ROLLBACK');
      console.error('Error during registered database writes, transaction rolled back:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, deviceName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account lockout
    if (user.locked_until) {
      const lockTime = new Date(user.locked_until).getTime();
      const now = new Date().getTime();
      if (now < lockTime) {
        const remainingMinutes = Math.ceil((lockTime - now) / 60000);
        return res.status(403).json({
          error: `Account is locked due to multiple failed attempts. Try again in ${remainingMinutes} minutes.`,
        });
      } else {
        // Unlock account
        await db.run(
          'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
          [user.id]
        );
      }
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);

    if (!validPassword) {
      const failed = (user.failed_attempts || 0) + 1;
      let lockedUntil: string | null = null;
      let msg = 'Invalid email or password.';

      if (failed >= 5) {
        const lockDate = new Date();
        lockDate.setMinutes(lockDate.getMinutes() + 5); // lock for 5 minutes
        lockedUntil = lockDate.toISOString();
        msg = 'Account locked! Too many failed login attempts. Locked for 5 minutes.';
      }

      await db.run(
        'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?',
        [failed, lockedUntil, user.id]
      );

      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'LOGIN_FAILED', 'Failed attempt on device: ${deviceName || 'Unknown'}')`,
        [user.id]
      );

      await db.run(
        `INSERT INTO login_history (user_id, device_name, status) VALUES (?, ?, 'FAILED')`,
        [user.id, deviceName || 'Unknown']
      );

      return res.status(401).json({ error: msg });
    }

    // Reset failed attempts
    await db.run(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
      [user.id]
    );

    // Check for suspicious login / new device
    const lastLogin = await db.get(
      'SELECT device_name FROM login_history WHERE user_id = ? AND status = "SUCCESS" ORDER BY id DESC LIMIT 1',
      [user.id]
    );

    const device = deviceName || 'Unknown Device';
    if (lastLogin && lastLogin.device_name !== device) {
      // Trigger suspicious / new device notification
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'New Device Login Detected', 'Your account was accessed from a new device: ${device}', 'SECURITY')`,
        [user.id]
      );
      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'NEW_DEVICE', 'New device login from ${device}')`,
        [user.id]
      );
    } else {
      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'LOGIN_SUCCESS', 'Successfully logged in via password')`,
        [user.id]
      );
    }

    await db.run(
      `INSERT INTO login_history (user_id, device_name, status) VALUES (?, ?, 'SUCCESS')`,
      [user.id, device]
    );

    const sessionObj = getSession(req);
    sessionObj.userId = user.id;
    sessionObj.fullName = user.full_name;
    sessionObj.email = user.email;

    return res.json({ success: true, message: 'Login successful!', userId: user.id });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// Global in-memory storage for pending OTP verification requests.
// This ensures reliability in sandboxed preview iframes where session cookies are blocked.
const pendingOtps = new Map<string, { otp: string; expiry: number; userId: number }>();

// Mobile Number + OTP Login Simulation
app.post('/api/auth/login-otp-request', async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ error: 'Mobile number is required.' });
    }

    const cleanMobile = String(mobileNumber).trim().replace(/\D/g, '');
    const db = await getDb();
    
    // Support lookup with either exact input or cleaned digits
    const user = await db.get(
      'SELECT * FROM users WHERE mobile_number = ? OR REPLACE(REPLACE(REPLACE(REPLACE(mobile_number, " ", ""), "-", ""), "(", ""), ")", "") = ?',
      [mobileNumber, cleanMobile]
    );

    if (!user) {
      return res.status(404).json({ error: 'No account registered with this mobile number.' });
    }

    // Generate simulated OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 2 * 60 * 1000; // 2 minutes

    // Store in global map under multiple keys (original, clean, and user ID) for maximum cookie-less reliability
    const otpPayload = { otp, expiry, userId: user.id };
    pendingOtps.set(mobileNumber, otpPayload);
    if (cleanMobile) pendingOtps.set(cleanMobile, otpPayload);
    pendingOtps.set(`user_${user.id}`, otpPayload);

    const sessionObj = getSession(req);
    sessionObj.otp = otp;
    sessionObj.otpExpiry = expiry;
    sessionObj.otpUserId = user.id;

    // Log security OTP request
    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Your OTP code is ${otp}', 'Use this OTP to complete your sign-in. Expires in 2 minutes.', 'OTP')`,
      [user.id]
    );

    // We return the OTP in the API for testing convenience, but normally wouldn't
    return res.json({
      success: true,
      message: 'OTP sent successfully! Enter the 6-digit OTP received in notifications.',
      debugOtp: otp, // helpful simulator bypass
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error requested OTP.' });
  }
});

app.post('/api/auth/login-otp-verify', async (req, res) => {
  try {
    const { otp, mobileNumber, deviceName } = req.body;
    const sessionObj = getSession(req);

    if (!otp) {
      return res.status(400).json({ error: 'OTP is required.' });
    }

    // Attempt to lookup from global map first with multiple possible keys
    const cleanMobile = mobileNumber ? String(mobileNumber).trim().replace(/\D/g, '') : '';
    
    let pending = null;
    if (mobileNumber) pending = pendingOtps.get(mobileNumber);
    if (!pending && cleanMobile) pending = pendingOtps.get(cleanMobile);
    if (!pending && sessionObj.userId) pending = pendingOtps.get(`user_${sessionObj.userId}`);
    
    // Last-mile fallback to the express session
    if (!pending && sessionObj.otp && sessionObj.otpUserId) {
      pending = {
        otp: sessionObj.otp,
        expiry: sessionObj.otpExpiry,
        userId: sessionObj.otpUserId
      };
    }

    if (!pending) {
      return res.status(400).json({ error: 'No pending OTP verification request found.' });
    }

    if (Date.now() > pending.expiry) {
      if (mobileNumber) pendingOtps.delete(mobileNumber);
      if (cleanMobile) pendingOtps.delete(cleanMobile);
      pendingOtps.delete(`user_${pending.userId}`);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ error: 'Incorrect OTP. Please check your notifications.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [pending.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // OTP success
    sessionObj.userId = user.id;
    sessionObj.fullName = user.full_name;
    sessionObj.email = user.email;

    // Clean up
    if (mobileNumber) pendingOtps.delete(mobileNumber);
    if (cleanMobile) pendingOtps.delete(cleanMobile);
    pendingOtps.delete(`user_${user.id}`);
    delete sessionObj.otp;
    delete sessionObj.otpExpiry;
    delete sessionObj.otpUserId;

    const device = deviceName || 'Unknown Device';
    await db.run(
      `INSERT INTO login_history (user_id, device_name, status) VALUES (?, ?, 'SUCCESS')`,
      [user.id, device]
    );

    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'LOGIN_SUCCESS', 'Logged in via Mobile OTP')`,
      [user.id]
    );

    return res.json({ success: true, message: 'OTP verified! Login successful.', userId: user.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error verifying OTP.' });
  }
});

// Biometric verification registration
app.post('/api/auth/register-biometric', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { enabled, type, fingerprintHash } = req.body;
    const db = await getDb();

    if (type === 'FINGERPRINT') {
      if (!enabled) {
        await db.run('UPDATE users SET fingerprint_hash = NULL WHERE id = ?', [sessionObj.userId]);
      } else if (fingerprintHash) {
        const encrypted = encryptBiometric(fingerprintHash);
        await db.run('UPDATE users SET fingerprint_hash = ? WHERE id = ?', [encrypted, sessionObj.userId]);
      }
    } else {
      return res.status(400).json({ error: 'Invalid biometric type.' });
    }

    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'BIOMETRIC_TOGGLE', 'Biometric sign-in updated: ${type} ${enabled ? 'Enabled' : 'Disabled'}')`,
      [sessionObj.userId]
    );

    return res.json({ success: true, message: 'Biometric authorization set successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error updating biometric settings.' });
  }
});

// Biometric login endpoint
app.post('/api/auth/login-biometric', async (req, res) => {
  try {
    const { email, type, deviceName, fingerprintHash } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for biometric validation.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email.' });
    }

    const device = deviceName || 'Unknown Device';

    if (type === 'FINGERPRINT') {
      if (!user.fingerprint_hash) {
        return res.status(400).json({ error: 'Fingerprint biometrics not registered on this account.' });
      }
      try {
        const decryptedHash = decryptBiometric(user.fingerprint_hash);
        if (!fingerprintHash || fingerprintHash !== decryptedHash) {
          await db.run(
            `INSERT INTO login_history (user_id, device_name, status) VALUES (?, ?, 'FAILED')`,
            [user.id, device]
          );
          await db.run(
            `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'LOGIN_FAILED', 'Failed biometric login (Fingerprint mismatch)')`,
            [user.id]
          );
          return res.status(400).json({ error: 'Fingerprint verification failed.' });
        }
      } catch (err) {
        console.error("Error verifying fingerprint:", err);
        return res.status(400).json({ error: 'Fingerprint verification failed.' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid biometric type.' });
    }

    // Successful biometric validation
    const sessionObj = getSession(req);
    sessionObj.userId = user.id;
    sessionObj.fullName = user.full_name;
    sessionObj.email = user.email;

    await db.run(
      `INSERT INTO login_history (user_id, device_name, status) VALUES (?, ?, 'SUCCESS')`,
      [user.id, device]
    );

    const logDetails = 'Logged in via Fingerprint';
    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'LOGIN_SUCCESS', ?)`,
      [user.id, logDetails]
    );

    return res.json({ success: true, message: 'Biometric login successful!', userId: user.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error with biometrics.' });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  const sessionObj = getSession(req);
  if (sessionObj.userId) {
    const db = await getDb();
    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'LOGOUT', 'Logged out of current session')`,
      [sessionObj.userId]
    );
  }
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// Get user profile info
app.get('/api/auth/me', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const user = await db.get(
      'SELECT id, full_name, email, mobile_number, upi_id, profile_photo, balance, mpin_hash, mpin_length, created_at FROM users WHERE id = ?',
      [sessionObj.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const hasMpin = user.mpin_hash ? true : false;
    const { mpin_hash, ...userProfile } = user;

    return res.json({ ...userProfile, has_mpin: hasMpin });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error retrieving current user.' });
  }
});

// Set initial MPIN upon login
app.post('/api/auth/set-initial-mpin', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { mpin } = req.body;
    if (!mpin) {
      return res.status(400).json({ error: 'MPIN is required.' });
    }

    if (mpin.length !== 4 && mpin.length !== 6) {
      return res.status(400).json({ error: 'MPIN must be a 4-digit or 6-digit number.' });
    }

    const db = await getDb();
    const mpinHash = bcrypt.hashSync(mpin, 10);
    await db.run(
      'UPDATE users SET mpin_hash = ?, pin_hash = ?, mpin_length = ?, mpin_failed_attempts = 0, mpin_locked_until = NULL WHERE id = ?',
      [mpinHash, mpinHash, mpin.length, sessionObj.userId]
    );

    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'MPIN_SETUP_SUCCESS', 'Created initial transaction MPIN successfully')`,
      [sessionObj.userId]
    );

    return res.json({ success: true, message: 'MPIN created successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error setting MPIN.' });
  }
});

// ─── MPIN SETTINGS & RESET ENDPOINTS ─────────────────────────────────────────

// Forgot MPIN OTP request
app.post('/api/auth/forgot-mpin-otp-request', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [sessionObj.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 2 * 60 * 1000; // 2 mins

    pendingOtps.set(`forgot_mpin_${sessionObj.userId}`, { otp, expiry, userId: sessionObj.userId });

    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Your Forgot MPIN OTP is ${otp}', 'Use this OTP to reset your MPIN. Expires in 2 minutes.', 'OTP')`,
      [sessionObj.userId]
    );

    return res.json({
      success: true,
      message: 'OTP sent successfully to your registered device.',
      debugOtp: otp
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error requesting Forgot MPIN OTP.' });
  }
});

// Forgot MPIN Reset
app.post('/api/auth/forgot-mpin-reset', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { otp, newMpin } = req.body;
    if (!otp || !newMpin) {
      return res.status(400).json({ error: 'OTP and new MPIN are required.' });
    }

    if (newMpin.length !== 4 && newMpin.length !== 6) {
      return res.status(400).json({ error: 'MPIN must be a 4-digit or 6-digit number.' });
    }

    const pending = pendingOtps.get(`forgot_mpin_${sessionObj.userId}`);
    if (!pending || Date.now() > pending.expiry) {
      return res.status(400).json({ error: 'OTP has expired or is invalid. Please request a new one.' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    const db = await getDb();
    const mpinHash = bcrypt.hashSync(newMpin, 10);

    await db.run(
      'UPDATE users SET mpin_hash = ?, pin_hash = ?, mpin_length = ?, mpin_failed_attempts = 0, mpin_locked_until = NULL WHERE id = ?',
      [mpinHash, mpinHash, newMpin.length, sessionObj.userId]
    );

    pendingOtps.delete(`forgot_mpin_${sessionObj.userId}`);

    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'MPIN_RESET_SUCCESS', 'Reset MPIN successfully via OTP verification')`,
      [sessionObj.userId]
    );

    return res.json({ success: true, message: 'MPIN has been reset successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error resetting MPIN.' });
  }
});

// Change MPIN OTP request
app.post('/api/auth/change-mpin-otp-request', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [sessionObj.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 2 * 60 * 1000; // 2 mins

    pendingOtps.set(`change_mpin_${sessionObj.userId}`, { otp, expiry, userId: sessionObj.userId });

    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Your Change MPIN OTP is ${otp}', 'Use this OTP to confirm changing your MPIN. Expires in 2 minutes.', 'OTP')`,
      [sessionObj.userId]
    );

    return res.json({
      success: true,
      message: 'OTP sent successfully to confirm MPIN change.',
      debugOtp: otp
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error requesting Change MPIN OTP.' });
  }
});

// Change MPIN
app.post('/api/auth/change-mpin', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { currentMpin, newMpin, otp } = req.body;
    if (!currentMpin || !newMpin || !otp) {
      return res.status(400).json({ error: 'Current MPIN, new MPIN, and OTP confirmation are required.' });
    }

    if (newMpin.length !== 4 && newMpin.length !== 6) {
      return res.status(400).json({ error: 'New MPIN must be 4 or 6 digits.' });
    }

    const pending = pendingOtps.get(`change_mpin_${sessionObj.userId}`);
    if (!pending || Date.now() > pending.expiry) {
      return res.status(400).json({ error: 'OTP has expired or is invalid. Please request a new one.' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [sessionObj.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const storedHash = user.mpin_hash || user.pin_hash;
    const validCurrent = bcrypt.compareSync(currentMpin, storedHash);
    if (!validCurrent) {
      return res.status(401).json({ error: 'Incorrect current MPIN entered.' });
    }

    const mpinHash = bcrypt.hashSync(newMpin, 10);
    await db.run(
      'UPDATE users SET mpin_hash = ?, pin_hash = ?, mpin_length = ?, mpin_failed_attempts = 0, mpin_locked_until = NULL WHERE id = ?',
      [mpinHash, mpinHash, newMpin.length, sessionObj.userId]
    );

    pendingOtps.delete(`change_mpin_${sessionObj.userId}`);

    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'MPIN_CHANGE_SUCCESS', 'Changed MPIN successfully with current MPIN and OTP confirmation')`,
      [sessionObj.userId]
    );

    return res.json({ success: true, message: 'MPIN changed successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error changing MPIN.' });
  }
});


// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const userId = sessionObj.userId;

    // Get Wallet Balance
    const user = await db.get('SELECT balance, full_name, upi_id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { dateStr: todayStr, monthStr } = getISTDateTime();

    // Today's Spending (only debit payments: MERCHANT, BILL, RECHARGE, SEND)
    const todaySpendingRes = await db.get(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND status = "SUCCESS" AND date = ? AND type != "RECEIVE"`,
      [userId, todayStr]
    );

    // Monthly Spending
    const monthSpendingRes = await db.get(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND status = "SUCCESS" AND strftime('%Y-%m', date) = ? AND type != "RECEIVE"`,
      [userId, monthStr]
    );

    // Monthly Income
    const monthIncomeRes = await db.get(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND status = "SUCCESS" AND strftime('%Y-%m', date) = ? AND type = "RECEIVE"`,
      [userId, monthStr]
    );

    // Monthly Budget Status
    const totalBudgetRes = await db.get(
      'SELECT amount FROM budgets WHERE user_id = ? AND category = "Total" AND month_year = ?',
      [userId, monthStr]
    );

    const monthlyBudget = totalBudgetRes ? totalBudgetRes.amount : 0.0;
    const monthlySpending = monthSpendingRes?.total || 0.0;
    const monthlyIncome = monthIncomeRes?.total || 0.0;

    return res.json({
      balance: user.balance,
      todaySpending: todaySpendingRes?.total || 0.0,
      monthlySpending: monthlySpending,
      monthlyBudget: monthlyBudget,
      remainingBudget: monthlyBudget > 0 ? Math.max(0, monthlyBudget - monthlySpending) : null,
      savingsThisMonth: Math.max(0, monthlyIncome - monthlySpending),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error retrieving stats.' });
  }
});


// ─── PAYMENTS & TRANSACTION CREATION ─────────────────────────────────────────

app.post('/api/transactions/pay', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const userId = sessionObj.userId;
    const { type, amount, receiverUpi, receiverName, notes, pin, merchantName, billId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'A valid transaction amount is required.' });
    }

    if (!pin) {
      return res.status(400).json({ error: 'MPIN is required to authorize transactions.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if MPIN is locked
    if (user.mpin_locked_until) {
      const lockTime = new Date(user.mpin_locked_until).getTime();
      const now = Date.now();
      if (now < lockTime) {
        const remainingMinutes = Math.ceil((lockTime - now) / 60000);
        return res.status(403).json({
          error: `Transaction blocked due to multiple failed MPIN attempts. Please try again in ${remainingMinutes} minutes.`
        });
      } else {
        // Unlock after 15 mins has passed
        await db.run(
          'UPDATE users SET mpin_failed_attempts = 0, mpin_locked_until = NULL WHERE id = ?',
          [userId]
        );
      }
    }

    // Verify MPIN
    const storedMpinHash = user.mpin_hash || user.pin_hash;
    const validMpin = bcrypt.compareSync(pin, storedMpinHash);

    const { dateStr, timeStr } = getISTDateTime();

    if (!validMpin) {
      const failed = (user.mpin_failed_attempts || 0) + 1;
      let mpinLockedUntil: string | null = null;
      let errorMsg = `Incorrect MPIN. ${3 - failed} attempts remaining.`;

      if (failed >= 3) {
        const lockDate = new Date();
        lockDate.setMinutes(lockDate.getMinutes() + 15); // block for 15 minutes
        mpinLockedUntil = lockDate.toISOString();
        errorMsg = 'Maximum MPIN attempts exceeded. Please try again after 15 minutes.';
      }

      await db.run(
        'UPDATE users SET mpin_failed_attempts = ?, mpin_locked_until = ? WHERE id = ?',
        [failed, mpinLockedUntil, userId]
      );

      await db.run(
        `INSERT INTO mpin_logs (user_id, date, time, status) VALUES (?, ?, ?, 'FAILED')`,
        [userId, dateStr, timeStr]
      );

      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) 
         VALUES (?, 'MPIN_VERIFICATION_FAILED', 'Failed MPIN attempt ${failed}/3 for payment of ₹${amount}')`,
        [userId]
      );

      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES (?, 'Payment Denied', 'An attempt to spend ₹${amount} failed due to incorrect MPIN.', 'SECURITY')`,
        [userId]
      );

      return res.status(401).json({ error: errorMsg });
    }

    // Successful MPIN verification: reset failed attempts
    await db.run(
      'UPDATE users SET mpin_failed_attempts = 0, mpin_locked_until = NULL WHERE id = ?',
      [userId]
    );

    await db.run(
      `INSERT INTO mpin_logs (user_id, date, time, status) VALUES (?, ?, ?, 'SUCCESS')`,
      [userId, dateStr, timeStr]
    );

    await db.run(
      `INSERT INTO security_logs (user_id, event_type, details) 
       VALUES (?, 'MPIN_VERIFICATION_SUCCESS', 'Successful MPIN verification for payment of ₹${amount}')`,
      [userId]
    );

    // Verify balance
    if (user.balance < amount) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES (?, 'Payment Failed', 'Transaction of ₹${amount} failed due to insufficient funds.', 'PAYMENT_FAILED')`,
        [userId]
      );
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    // High value check
    if (amount >= 5000) {
      // Simulate large transaction secondary authorization
      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) 
         VALUES (?, 'HIGH_VALUE_TX', 'High-value transaction of ₹${amount} authorized with secure PIN')`,
        [userId]
      );
    }

    // Category identification
    const resolvedMerchant = merchantName || receiverName || 'Transfer';
    const category = predictCategory(resolvedMerchant);

    // Perform transaction
    const refId = 'TXN' + Math.floor(1000000000 + Math.random() * 9000000000).toString();

    // Deduct user balance
    await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);

    // Insert transaction
    const recName = receiverName || resolvedMerchant;
    const recUpi = receiverUpi || 'merchant@pay';

    await db.run(
      `INSERT INTO transactions (user_id, type, amount, sender_name, sender_upi, receiver_name, receiver_upi, merchant_name, category, payment_method, status, reference_id, date, time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPI_PIN', 'SUCCESS', ?, ?, ?, ?)`,
      [
        userId, type, amount, user.full_name, user.upi_id, recName, recUpi,
        merchantName || null, category, refId, dateStr, timeStr, notes || `Paid to ${recName}`
      ]
    );

    // If it's a bill payment, update bill status
    if (billId) {
      await db.run('UPDATE bills SET status = "PAID" WHERE id = ? AND user_id = ?', [billId, userId]);
    }

    // Budget checks and notification triggering
    const monthStr = dateStr.substring(0, 7);
    const categoryBudget = await db.get(
      'SELECT amount FROM budgets WHERE user_id = ? AND category = ? AND month_year = ?',
      [userId, category, monthStr]
    );

    const totalBudget = await db.get(
      'SELECT amount FROM budgets WHERE user_id = ? AND category = "Total" AND month_year = ?',
      [userId, monthStr]
    );

    // Calculate current month's expenditures for category
    const catSpentRes = await db.get(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND status = "SUCCESS" AND strftime('%Y-%m', date) = ? AND category = ? AND type != "RECEIVE"`,
      [userId, monthStr, category]
    );

    const totalSpentRes = await db.get(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND status = "SUCCESS" AND strftime('%Y-%m', date) = ? AND type != "RECEIVE"`,
      [userId, monthStr]
    );

    const catSpent = catSpentRes?.total || 0.0;
    const totalSpent = totalSpentRes?.total || 0.0;

    const budgetAlerts: string[] = [];

    // Trigger alert functions
    const checkAlert = async (spent: number, budgetAmt: number, label: string) => {
      const pctBefore = ((spent - amount) / budgetAmt) * 100;
      const pctAfter = (spent / budgetAmt) * 100;

      let alertMsg = '';
      if (pctAfter >= 100 && pctBefore < 100) {
        alertMsg = `⚠️ Budget exceeded for ${label}! Spent ₹${spent.toFixed(2)} of ₹${budgetAmt.toFixed(2)}.`;
      } else if (pctAfter >= 80 && pctBefore < 80) {
        alertMsg = `🔔 80% of budget reached for ${label}! Spent ₹${spent.toFixed(2)} of ₹${budgetAmt.toFixed(2)}.`;
      } else if (pctAfter >= 50 && pctBefore < 50) {
        alertMsg = `💡 50% of budget used for ${label}! Spent ₹${spent.toFixed(2)} of ₹${budgetAmt.toFixed(2)}.`;
      }

      if (alertMsg) {
        budgetAlerts.push(alertMsg);
        await db.run(
          'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, "BUDGET_ALERT")',
          [userId, `${label} Budget Alert`, alertMsg]
        );
      }
    };

    if (categoryBudget && categoryBudget.amount > 0) {
      await checkAlert(catSpent, categoryBudget.amount, category);
    }

    if (totalBudget && totalBudget.amount > 0) {
      await checkAlert(totalSpent, totalBudget.amount, 'Monthly Total');
    }

    // Success transaction notification
    await db.run(
      `INSERT INTO notifications (user_id, title, message, type) 
       VALUES (?, 'Payment Successful', '₹${amount.toFixed(2)} sent to ${recName}. Ref: ${refId}', 'PAYMENT_SUCCESS')`,
      [userId]
    );

    return res.json({
      success: true,
      message: 'Transaction completed successfully!',
      transaction: {
        referenceId: refId,
        amount,
        receiverName: recName,
        category,
        date: dateStr,
      },
      budgetAlerts,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error processing payment.' });
  }
});

// Add manual expense transaction
app.post('/api/transactions/manual', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const userId = sessionObj.userId;
    const { receiverName, amount, category, date, notes, paymentMethod, deductFromWallet } = req.body;

    if (!receiverName) {
      return res.status(400).json({ error: 'Merchant / Vendor name is required.' });
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      return res.status(400).json({ error: 'A valid transaction amount is required.' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Category is required.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (deductFromWallet && user.balance < amtNum) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    const { dateStr: istDateStr, timeStr: istTimeStr } = getISTDateTime();
    const dateStr = date || istDateStr;
    const timeStr = istTimeStr;
    const refId = 'MAN' + Math.floor(1000000000 + Math.random() * 9000000000).toString();

    await db.run('BEGIN TRANSACTION');

    try {
      if (deductFromWallet) {
        await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amtNum, userId]);
      }

      const method = paymentMethod || 'Cash';

      await db.run(
        `INSERT INTO transactions (user_id, type, amount, sender_name, sender_upi, receiver_name, receiver_upi, merchant_name, category, payment_method, status, reference_id, date, time, notes)
         VALUES (?, 'MERCHANT', ?, ?, ?, ?, 'manual@expense', ?, ?, ?, 'SUCCESS', ?, ?, ?, ?)`,
        [
          userId, amtNum, user.full_name, user.upi_id, receiverName,
          receiverName, category, method, refId, dateStr, timeStr, notes || `Manual expense at ${receiverName}`
        ]
      );

      // Run budget alerts check
      const monthStr = dateStr.substring(0, 7);
      const categoryBudget = await db.get(
        'SELECT amount FROM budgets WHERE user_id = ? AND category = ? AND month_year = ?',
        [userId, category, monthStr]
      );

      const totalBudget = await db.get(
        'SELECT amount FROM budgets WHERE user_id = ? AND category = "Total" AND month_year = ?',
        [userId, monthStr]
      );

      // Calculate current month's expenditures for category
      const catSpentRes = await db.get(
        `SELECT SUM(amount) as total FROM transactions 
         WHERE user_id = ? AND status = "SUCCESS" AND strftime('%Y-%m', date) = ? AND category = ? AND type != "RECEIVE"`,
         [userId, monthStr, category]
      );

      const totalSpentRes = await db.get(
        `SELECT SUM(amount) as total FROM transactions 
         WHERE user_id = ? AND status = "SUCCESS" AND strftime('%Y-%m', date) = ? AND type != "RECEIVE"`,
         [userId, monthStr]
      );

      const catSpent = catSpentRes?.total || 0.0;
      const totalSpent = totalSpentRes?.total || 0.0;

      const budgetAlerts: string[] = [];

      const checkAlert = async (spent: number, budgetAmt: number, label: string) => {
        const pctBefore = ((spent - amtNum) / budgetAmt) * 100;
        const pctAfter = (spent / budgetAmt) * 100;

        let alertMsg = '';
        if (pctAfter >= 100 && pctBefore < 100) {
          alertMsg = `⚠️ Budget exceeded for ${label}! Spent ₹${spent.toFixed(2)} of ₹${budgetAmt.toFixed(2)}.`;
        } else if (pctAfter >= 80 && pctBefore < 80) {
          alertMsg = `🔔 80% of budget reached for ${label}! Spent ₹${spent.toFixed(2)} of ₹${budgetAmt.toFixed(2)}.`;
        } else if (pctAfter >= 50 && pctBefore < 50) {
          alertMsg = `💡 50% of budget used for ${label}! Spent ₹${spent.toFixed(2)} of ₹${budgetAmt.toFixed(2)}.`;
        }

        if (alertMsg) {
          budgetAlerts.push(alertMsg);
          await db.run(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, "BUDGET_ALERT")',
            [userId, `${label} Budget Alert`, alertMsg]
          );
        }
      };

      if (categoryBudget && categoryBudget.amount > 0) {
        await checkAlert(catSpent, categoryBudget.amount, category);
      }

      if (totalBudget && totalBudget.amount > 0) {
        await checkAlert(totalSpent, totalBudget.amount, 'Monthly Total');
      }

      // Add success notification
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES (?, 'Manual Expense Logged', 'Logged ₹${amtNum.toFixed(2)} spend at ${receiverName}. Method: ${method}', 'PAYMENT_SUCCESS')`,
        [userId]
      );

      await db.run('COMMIT');

      return res.json({
        success: true,
        message: 'Manual expense added successfully!',
        transaction: {
          referenceId: refId,
          amount: amtNum,
          receiverName,
          category,
          date: dateStr,
        },
        budgetAlerts,
      });
    } catch (dbError) {
      await db.run('ROLLBACK');
      console.error(dbError);
      return res.status(500).json({ error: 'Database error adding manual expense.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error adding manual expense.' });
  }
});



// Delete Transaction Endpoint
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { id } = req.params;
    const userId = sessionObj.userId;
    const db = await getDb();

    const tx = await db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found or unauthorized.' });
    }

    await db.run('BEGIN TRANSACTION');

    try {
      if (tx.status === 'SUCCESS') {
        if (tx.type === 'RECEIVE') {
          // Received money gets deducted from wallet balance
          await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [tx.amount, userId]);
        } else {
          // Sent money gets refunded if it used wallet balance
          const didDeduct = tx.payment_method === 'UPI_PIN' || tx.payment_method === 'WALLET_TRANSFER' || tx.payment_method === 'BANK_TRANSFER' || tx.payment_method === 'UPI';
          // Also check if they explicitly subtracted manual expense from wallet balance
          // If reference_id starts with 'MAN' and there's a record we can refund, or let's refund it anyway if it is UPI or WALLET
          if (didDeduct) {
            await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [tx.amount, userId]);
          }
        }
      }

      // Revert associated bills if applicable
      const matchingBill = await db.get(
        'SELECT id FROM bills WHERE user_id = ? AND biller_name = ? AND amount = ? AND status = "PAID" LIMIT 1',
        [userId, tx.receiver_name, tx.amount]
      );
      if (matchingBill) {
        await db.run('UPDATE bills SET status = "UNPAID" WHERE id = ?', [matchingBill.id]);
      }

      await db.run('DELETE FROM transactions WHERE id = ?', [id]);

      await db.run(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES (?, 'Transaction Deleted', 'Transaction Ref: ${tx.reference_id} for ₹${tx.amount.toFixed(2)} was deleted and balance adjusted.', 'SECURITY')`,
        [userId]
      );

      await db.run('COMMIT');
      return res.json({ success: true, message: 'Transaction deleted and balance reverted successfully.' });
    } catch (dbError) {
      await db.run('ROLLBACK');
      console.error(dbError);
      return res.status(500).json({ error: 'Database rollback during deletion.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error deleting transaction.' });
  }
});

// Update manual transaction category
app.post('/api/transactions/update-category', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { transactionId, category } = req.body;

    if (!transactionId || !category) {
      return res.status(400).json({ error: 'Transaction ID and Category are required.' });
    }

    const db = await getDb();
    const result = await db.run(
      'UPDATE transactions SET category = ? WHERE id = ? AND user_id = ?',
      [category, transactionId, sessionObj.userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found or unauthorized.' });
    }

    return res.json({ success: true, message: 'Expense category updated successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error updating category.' });
  }
});

// Get transactions history
app.get('/api/transactions', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const userId = sessionObj.userId;
    const { search, category, sort, type } = req.query;

    let query = 'SELECT * FROM transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (search) {
      query += ' AND (receiver_name LIKE ? OR sender_name LIKE ? OR notes LIKE ? OR reference_id LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild, searchWild);
    }

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (type && type !== 'All') {
      query += ' AND type = ?';
      params.push(type);
    }

    if (sort === 'oldest') {
      query += ' ORDER BY date ASC, time ASC';
    } else if (sort === 'amount-desc') {
      query += ' ORDER BY amount DESC';
    } else if (sort === 'amount-asc') {
      query += ' ORDER BY amount ASC';
    } else {
      query += ' ORDER BY date DESC, time DESC'; // default newest
    }

    const txs = await db.all(query, params);
    return res.json(txs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error fetching history.' });
  }
});


// ─── BUDGET MANAGEMENT ───────────────────────────────────────────────────────

app.get('/api/budgets', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const budgets = await db.all(
      'SELECT id, category, amount, month_year FROM budgets WHERE user_id = ?',
      [sessionObj.userId]
    );

    return res.json(budgets);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error retrieving budgets.' });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { category, amount } = req.body;
    if (!category || amount === undefined || amount < 0) {
      return res.status(400).json({ error: 'Category and positive amount are required.' });
    }

    const db = await getDb();
    const { monthStr: monthYear } = getISTDateTime();

    // Upsert budget
    await db.run(
      `INSERT INTO budgets (user_id, category, amount, month_year)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, category, month_year) 
       DO UPDATE SET amount = excluded.amount`,
      [sessionObj.userId, category, amount, monthYear]
    );

    return res.json({ success: true, message: `Budget for ${category} successfully configured!` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error configuring budget.' });
  }
});

app.delete('/api/budgets/:category', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    await db.run(
      'DELETE FROM budgets WHERE user_id = ? AND category = ?',
      [sessionObj.userId, req.params.category]
    );

    return res.json({ success: true, message: 'Budget removed.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error removing budget.' });
  }
});


// ─── BILLS SIMULATOR ─────────────────────────────────────────────────────────

app.get('/api/bills', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const bills = await db.all(
      'SELECT * FROM bills WHERE user_id = ? ORDER BY status DESC, due_date ASC',
      [sessionObj.userId]
    );

    return res.json(bills);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error fetching bills.' });
  }
});


// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

app.get('/api/notifications', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const notices = await db.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC',
      [sessionObj.userId]
    );

    return res.json(notices);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error fetching notifications.' });
  }
});

app.post('/api/notifications/mark-read', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [sessionObj.userId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error marking read.' });
  }
});

app.post('/api/notifications/clear-all', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    await db.run(
      'DELETE FROM notifications WHERE user_id = ?',
      [sessionObj.userId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error clearing notifications.' });
  }
});

app.post('/api/notifications/delete-multiple', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided.' });
    }

    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    await db.run(
      `DELETE FROM notifications WHERE user_id = ? AND id IN (${placeholders})`,
      [sessionObj.userId, ...ids]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error deleting selected notifications.' });
  }
});


// ─── PROFILE & SECURITY SETTINGS ──────────────────────────────────────────────

app.get('/api/profile/security-logs', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const logs = await db.all(
      'SELECT * FROM security_logs WHERE user_id = ? ORDER BY id DESC LIMIT 50',
      [sessionObj.userId]
    );

    return res.json(logs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error fetching security logs.' });
  }
});

app.get('/api/profile/login-history', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const history = await db.all(
      'SELECT * FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 50',
      [sessionObj.userId]
    );

    return res.json(history);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error fetching login history.' });
  }
});

app.post('/api/profile/update', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { fullName, email, mobileNumber, password, pin } = req.body;
    const db = await getDb();

    if (password) {
      const passwordHash = bcrypt.hashSync(password, 10);
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, sessionObj.userId]);
      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'PASSWORD_CHANGE', 'Password changed successfully')`,
        [sessionObj.userId]
      );
    }

    if (pin) {
      if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        return res.status(400).json({ error: 'UPI PIN must be 4 digits.' });
      }
      const pinHash = bcrypt.hashSync(pin, 10);
      await db.run('UPDATE users SET pin_hash = ? WHERE id = ?', [pinHash, sessionObj.userId]);
      await db.run(
        `INSERT INTO security_logs (user_id, event_type, details) VALUES (?, 'PIN_CHANGE', 'UPI PIN updated successfully')`,
        [sessionObj.userId]
      );
    }

    await db.run(
      `UPDATE users SET full_name = ?, email = ?, mobile_number = ?, profile_photo = NULL WHERE id = ?`,
      [
        fullName || sessionObj.fullName,
        email || sessionObj.email,
        mobileNumber || '',
        sessionObj.userId
      ]
    );

    sessionObj.fullName = fullName || sessionObj.fullName;
    sessionObj.email = email || sessionObj.email;

    return res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error updating profile.' });
  }
});

// Delete Account & Reset Data (Anonymization style to preserve transaction history and database integrity)
app.post('/api/profile/delete-account', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const userId = sessionObj.userId;
    const db = await getDb();

    // Delete personal history log, OTP records, notifications, and settings
    await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM login_history WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM security_logs WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM mpin_logs WHERE user_id = ?', [userId]);

    // Replace personal details in transaction records with "Deleted User" to maintain integrity
    await db.run(
      `UPDATE transactions 
       SET sender_name = 'Deleted User', 
           sender_upi = 'deleted_user@gmu',
           receiver_name = 'Deleted User', 
           receiver_upi = 'deleted_user@gmu' 
       WHERE user_id = ?`,
      [userId]
    );

    // Anonymize the users table record instead of deleting the primary key
    const deletedEmail = `deleted_${userId}_${Date.now()}@deleted.com`;
    const deletedMobile = `DELETED_${userId}_${Date.now()}`;
    const deletedUpi = `deleted_user_${userId}`;

    await db.run(
      `UPDATE users 
       SET full_name = 'Deleted User',
           email = ?,
           mobile_number = ?,
           password_hash = 'DELETED',
           upi_id = ?,
           pin_hash = 'DELETED',
           profile_photo = NULL,
           fingerprint_hash = NULL,
           mpin_hash = NULL,
           failed_attempts = 0,
           locked_until = NULL,
           mpin_failed_attempts = 0,
           mpin_locked_until = NULL,
           balance = 0.0
       WHERE id = ?`,
      [deletedEmail, deletedMobile, deletedUpi, userId]
    );

    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error during account deactivation:', err);
      }
      return res.json({ success: true, message: 'Account deactivated and personal information cleared successfully!' });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error during account deactivation.' });
  }
});


// ─── ANALYTICS CHARTS DATA ───────────────────────────────────────────────────

app.get('/api/analytics/summary', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const db = await getDb();
    const userId = sessionObj.userId;
    const { monthStr } = getISTDateTime();

    // Spending by category
    const catSpent = await db.all(
      `SELECT category, SUM(amount) as value FROM transactions
       WHERE user_id = ? AND status = "SUCCESS" AND strftime('%Y-%m', date) = ? AND type != "RECEIVE"
       GROUP BY category`,
      [userId, monthStr]
    );

    // Monthly trend (last 6 months)
    const monthlyTrend = await db.all(
      `SELECT strftime('%Y-%m', date) as month, 
              SUM(CASE WHEN type = "RECEIVE" THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type != "RECEIVE" THEN amount ELSE 0 END) as expenses
       FROM transactions
       WHERE user_id = ? AND status = "SUCCESS"
       GROUP BY month
       ORDER BY month ASC
       LIMIT 6`,
      [userId]
    );

    // Weekly trend (last 4 weeks)
    const weeklyTrend = await db.all(
      `SELECT strftime('%W', date) as week, 
              SUM(amount) as expenses
       FROM transactions
       WHERE user_id = ? AND status = "SUCCESS" AND type != "RECEIVE"
       GROUP BY week
       ORDER BY week ASC
       LIMIT 4`,
      [userId]
    );

    // Daily spending (last 15 days)
    const dailyTrend = await db.all(
      `SELECT date, SUM(amount) as amount FROM transactions
       WHERE user_id = ? AND status = "SUCCESS" AND type != "RECEIVE"
       GROUP BY date
       ORDER BY date DESC
       LIMIT 15`,
      [userId]
    );

    // Top merchant
    const topMerchant = await db.get(
      `SELECT merchant_name, COUNT(*) as count, SUM(amount) as total FROM transactions
       WHERE user_id = ? AND status = "SUCCESS" AND merchant_name IS NOT NULL
       GROUP BY merchant_name
       ORDER BY total DESC
       LIMIT 1`,
      [userId]
    );

    // Highest Expense
    const highestExpense = await db.get(
      `SELECT receiver_name, amount, category, date FROM transactions
       WHERE user_id = ? AND status = "SUCCESS" AND type != "RECEIVE"
       ORDER BY amount DESC
       LIMIT 1`,
      [userId]
    );

    return res.json({
      categoryData: catSpent,
      monthlyTrend: monthlyTrend,
      weeklyTrend: weeklyTrend,
      dailyTrend: dailyTrend.reverse(),
      topMerchant: topMerchant || null,
      highestExpense: highestExpense || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error retrieving analytics.' });
  }
});


// ─── DATA EXPORT ENDPOINTS ───────────────────────────────────────────────────

// CSV
app.get('/api/export/csv', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).send('Unauthorized');
    }

    const db = await getDb();
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, time DESC',
      [sessionObj.userId]
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=SmartPay_Transactions.csv');

    let csvContent = 'TransactionID,Date,Time,Type,Sender,Receiver,Amount,Category,Method,Status,Notes\n';
    for (const t of transactions) {
      csvContent += `"${t.reference_id}","${t.date}","${t.time}","${t.type}","${t.sender_name}","${t.receiver_name}",${t.amount},"${t.category}","${t.payment_method}","${t.status}","${t.notes || ''}"\n`;
    }

    return res.send(csvContent);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server Error generating CSV');
  }
});

// Excel
app.get('/api/export/excel', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).send('Unauthorized');
    }

    const db = await getDb();
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, time DESC',
      [sessionObj.userId]
    );

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', 'attachment; filename=SmartPay_Transactions.xls');

    let html = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
        <!--[if gte mso 9]>
        <xml>
            <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                    <x:ExcelWorksheet>
                        <x:Name>Transactions</x:Name>
                        <x:WorksheetOptions>
                            <x:DisplayGridlines/>
                        </x:WorksheetOptions>
                    </x:ExcelWorksheet>
                </x:ExcelWorksheets>
            </x:ExcelWorkbook>
        </xml>
        <![endif]-->
    </head>
    <body>
        <table border="1">
            <tr>
                <th style="background-color: #0284c7; color: white;">Transaction ID</th>
                <th style="background-color: #0284c7; color: white;">Date</th>
                <th style="background-color: #0284c7; color: white;">Time</th>
                <th style="background-color: #0284c7; color: white;">Type</th>
                <th style="background-color: #0284c7; color: white;">Sender Name</th>
                <th style="background-color: #0284c7; color: white;">Receiver Name</th>
                <th style="background-color: #0284c7; color: white;">Amount (INR)</th>
                <th style="background-color: #0284c7; color: white;">Category</th>
                <th style="background-color: #0284c7; color: white;">Payment Method</th>
                <th style="background-color: #0284c7; color: white;">Status</th>
                <th style="background-color: #0284c7; color: white;">Notes</th>
            </tr>
    `;

    for (const t of transactions) {
      html += `
        <tr>
            <td>${t.reference_id}</td>
            <td>${t.date}</td>
            <td>${t.time}</td>
            <td>${t.type}</td>
            <td>${t.sender_name}</td>
            <td>${t.receiver_name}</td>
            <td>${t.amount.toFixed(2)}</td>
            <td>${t.category}</td>
            <td>${t.payment_method}</td>
            <td>${t.status}</td>
            <td>${t.notes || ''}</td>
        </tr>
      `;
    }

    html += '</table></body></html>';
    return res.send(html);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error generating Excel file.');
  }
});

// PDF
app.get('/api/export/pdf', async (req, res) => {
  try {
    const sessionObj = getSession(req);
    if (!sessionObj.userId) {
      return res.status(401).send('Unauthorized');
    }

    const db = await getDb();
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, time DESC',
      [sessionObj.userId]
    );

    res.setHeader('Content-Type', 'text/html');

    let html = `
    <html>
    <head>
        <title>GMUpay - Financial Transaction Statement</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background-color: #f8fafc; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 28px; font-weight: bold; color: #0284c7; }
            .subtitle { font-size: 14px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); background-color: white; border-radius: 8px; overflow: hidden; }
            th, td { border: 1px solid #e2e8f0; padding: 12px 16px; text-align: left; }
            th { background-color: #0284c7; color: white; font-weight: 600; font-size: 14px; }
            td { font-size: 13px; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .badge { padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
            .success { background-color: #dcfce7; color: #15803d; }
            .failed { background-color: #fee2e2; color: #b91c1c; }
            .no-print { margin-bottom: 20px; padding: 10px 20px; background-color: #0284c7; color: white; border: none; cursor: pointer; border-radius: 6px; font-weight: 600; transition: background-color 0.2s; }
            .no-print:hover { background-color: #0369a1; }
            @media print {
                .no-print { display: none; }
                body { padding: 0; background-color: white; }
            }
        </style>
    </head>
    <body>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <button class="no-print" onclick="window.print()">Print Statement / Save as PDF</button>
        </div>
        <div class="header">
            <div>
                <div class="title">GMUpay</div>
                <div class="subtitle">Official Account Transaction Statement</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 600;">Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'Asia/Kolkata' })}</div>
                <div class="subtitle">User: ${sessionObj.fullName} (${sessionObj.email})</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Reference ID</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Recipient / Source</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const t of transactions) {
      const isReceive = t.type === 'RECEIVE';
      const statusClass = t.status === 'SUCCESS' ? 'success' : 'failed';
      html += `
        <tr>
            <td style="font-family: monospace; font-weight: 500;">${t.reference_id}</td>
            <td>${t.date} ${t.time}</td>
            <td style="font-weight: 600; color: ${isReceive ? '#16a34a' : '#ef4444'}">${t.type}</td>
            <td>${isReceive ? t.sender_name : t.receiver_name}</td>
            <td>${t.category}</td>
            <td style="font-weight: 600;">₹${t.amount.toFixed(2)}</td>
            <td><span class="badge ${statusClass}">${t.status}</span></td>
        </tr>
      `;
    }

    html += `
            </tbody>
        </table>
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8;">
            This statement is computer generated and does not require a physical signature.
        </div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;

    return res.send(html);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error exporting statement.');
  }
});


// ─── VITE AND STATIC ASSETS HANDLERS ─────────────────────────────────────────

async function startServer() {
  // Setup database connection and table creation before start
  await getDb();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
