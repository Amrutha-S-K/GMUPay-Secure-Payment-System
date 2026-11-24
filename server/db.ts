import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'smartpay.db');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  // Enable foreign keys
  await dbInstance.run('PRAGMA foreign_keys = ON;');

  // Create tables
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile_number TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      upi_id TEXT UNIQUE NOT NULL,
      pin_hash TEXT NOT NULL,
      profile_photo TEXT,
      balance REAL DEFAULT 10000.0,
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'SEND', 'RECEIVE', 'RECHARGE', 'BILL', 'MERCHANT', 'TRANSFER'
      amount REAL NOT NULL,
      sender_name TEXT NOT NULL,
      sender_upi TEXT NOT NULL,
      receiver_name TEXT NOT NULL,
      receiver_upi TEXT NOT NULL,
      merchant_name TEXT,
      category TEXT NOT NULL,
      payment_method TEXT NOT NULL, -- 'UPI_PIN', 'WALLET_TRANSFER', 'BANK_TRANSFER'
      status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'PENDING'
      reference_id TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL, -- 'YYYY-MM-DD'
      time TEXT NOT NULL, -- 'HH:MM:SS'
      location TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL, -- 'Total' or specific categories
      amount REAL NOT NULL,
      month_year TEXT NOT NULL, -- 'YYYY-MM'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category, month_year),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL, -- 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'OTP', 'BUDGET_ALERT', 'SECURITY'
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS security_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_type TEXT NOT NULL, -- 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PIN_CHANGE', 'NEW_DEVICE', 'SUSPICIOUS_LOGIN'
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      device_name TEXT NOT NULL,
      status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'LOCKED'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bill_type TEXT NOT NULL, -- 'Electricity', 'Water', 'Gas', 'Internet', 'Insurance', 'Education'
      biller_name TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL, -- 'YYYY-MM-DD'
      status TEXT NOT NULL DEFAULT 'UNPAID', -- 'UNPAID', 'PAID'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mpin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL, -- 'SUCCESS', 'FAILED'
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Dynamic alterations for biometric storage columns
  try {
    await dbInstance.run('ALTER TABLE users ADD COLUMN fingerprint_hash TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await dbInstance.run('ALTER TABLE users ADD COLUMN mpin_hash TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await dbInstance.run('ALTER TABLE users ADD COLUMN mpin_length INTEGER DEFAULT 4;');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await dbInstance.run('ALTER TABLE users ADD COLUMN mpin_failed_attempts INTEGER DEFAULT 0;');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await dbInstance.run('ALTER TABLE users ADD COLUMN mpin_locked_until TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Seed default bills if none exist
  const existingBills = await dbInstance.get('SELECT COUNT(*) as count FROM bills');
  if (existingBills && existingBills.count === 0) {
    // We will dynamically populate bills per user upon user creation, or here as placeholder.
  }

  return dbInstance;
}

// Predict Expense Category based on merchant name
export function predictCategory(merchantName: string): string {
  const name = merchantName.toLowerCase().trim();

  // Mappings
  if (name.includes('swiggy') || name.includes('zomato') || name.includes('kfc') || 
      name.includes('mcdonald') || name.includes('domino') || name.includes('starbuck') || 
      name.includes('restaurant') || name.includes('cafe') || name.includes('pizza') || name.includes('burger')) {
    return 'Food';
  }
  if (name.includes('blinkit') || name.includes('bigbasket') || name.includes('dmart') || 
      name.includes('grocery') || name.includes('groceries') || name.includes('supermarket') || 
      name.includes('reliance fresh') || name.includes('zepto')) {
    return 'Groceries';
  }
  if (name.includes('amazon') || name.includes('flipkart') || name.includes('myntra') || 
      name.includes('ajio') || name.includes('shopping') || name.includes('mall') || 
      name.includes('clothing') || name.includes('zara') || name.includes('h&m') || name.includes('fashion')) {
    return 'Shopping';
  }
  if (name.includes('uber') || name.includes('ola') || name.includes('rapido') || 
      name.includes('irctc') || name.includes('metro') || name.includes('train') || 
      name.includes('flight') || name.includes('indigo') || name.includes('railway') || 
      name.includes('makemytrip') || name.includes('goibibo') || name.includes('travel')) {
    return 'Travel';
  }
  if (name.includes('hpcl') || name.includes('bpcl') || name.includes('shell') || 
      name.includes('fuel') || name.includes('petrol') || name.includes('gas station') || 
      name.includes('cng') || name.includes('diesel')) {
    return 'Fuel';
  }
  if (name.includes('udemy') || name.includes('coursera') || name.includes('school') || 
      name.includes('college') || name.includes('education') || name.includes('fees') || 
      name.includes('books') || name.includes('tuition') || name.includes('university')) {
    return 'Education';
  }
  if (name.includes('apollo') || name.includes('pharmeasy') || name.includes('hospital') || 
      name.includes('clinic') || name.includes('healthcare') || name.includes('medicine') || 
      name.includes('doctor') || name.includes('pharmacy') || name.includes('dental')) {
    return 'Healthcare';
  }
  if (name.includes('netflix') || name.includes('hotstar') || name.includes('spotify') || 
      name.includes('cinema') || name.includes('movies') || name.includes('bookmyshow') || 
      name.includes('entertainment') || name.includes('youtube') || name.includes('disney')) {
    return 'Entertainment';
  }
  if (name.includes('bescom') || name.includes('airtel') || name.includes('jio') || 
      name.includes('electricity') || name.includes('water') || name.includes('gas bill') || 
      name.includes('wifi') || name.includes('broadband') || name.includes('utilities') || 
      name.includes('vi') || name.includes('bsnl') || name.includes('recharge')) {
    return 'Bills';
  }
  if (name.includes('zerodha') || name.includes('groww') || name.includes('mutual fund') || 
      name.includes('stock') || name.includes('shares') || name.includes('investment') || 
      name.includes('gold') || name.includes('angelone')) {
    return 'Investment';
  }
  if (name.includes('house rent') || name.includes('owner') || name.includes('landlord') || 
      name.includes('rent') || name.includes('apartment')) {
    return 'Rent';
  }
  if (name.includes('salary') || name.includes('dividend') || name.includes('paycheck') || 
      name.includes('income')) {
    return 'Salary';
  }
  if (name.includes('business') || name.includes('client') || name.includes('invoice') || 
      name.includes('merchant payment')) {
    return 'Business';
  }
  if (name.includes('lic') || name.includes('hdfc life') || name.includes('insurance') || 
      name.includes('max life')) {
    return 'Insurance';
  }
  if (name.includes('donation') || name.includes('charity') || name.includes('ngo') || 
      name.includes('giving')) {
    return 'Donation';
  }

  return 'Others';
}
