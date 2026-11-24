export interface User {
  id: number;
  full_name: string;
  email: string;
  mobile_number: string;
  upi_id: string;
  profile_photo: string | null;
  balance: number;
  mpin_length: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: 'SEND' | 'RECEIVE' | 'RECHARGE' | 'BILL' | 'MERCHANT' | 'TRANSFER';
  amount: number;
  sender_name: string;
  sender_upi: string;
  receiver_name: string;
  receiver_upi: string;
  merchant_name: string | null;
  category: string;
  payment_method: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  reference_id: string;
  date: string;
  time: string;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface Budget {
  id: number;
  user_id: number;
  category: string;
  amount: number;
  month_year: string;
}

export interface Bill {
  id: number;
  user_id: number;
  bill_type: 'Electricity' | 'Water' | 'Gas' | 'Internet' | 'Insurance' | 'Education';
  biller_name: string;
  amount: number;
  due_date: string;
  status: 'UNPAID' | 'PAID';
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'OTP' | 'BUDGET_ALERT' | 'SECURITY';
  is_read: number;
  created_at: string;
}

export interface SecurityLog {
  id: number;
  user_id: number | null;
  event_type: string;
  details: string;
  ip_address: string | null;
  created_at: string;
}
