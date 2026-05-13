export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  preferred_currency?: string;
}

export interface Group {
  id: number;
  name: string;
  currency: string;
  image?: string | null;
  simplify_debts: boolean;
  group_type?: 'regular' | 'gaming';
  members: GroupMember[];
  member_count: number;
  created_at: string;
}

export interface PotTransaction {
  id: number;
  user: User;
  transaction_type: 'contribution' | 'payout';
  amount: string;
  currency: string;
  note?: string;
  created_at: string;
}

export interface GroupMember {
  id: number;
  user: User;
  role: string;
  joined_at: string;
}

export type RecurringInterval = 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  id: number;
  group: number;
  description: string;
  notes?: string;
  amount: string;
  currency: string;
  paid_by: User;
  split_type: 'equal' | 'exact' | 'percentage';
  participant_ids: number[];
  exact_amounts?: Record<string, number>;
  percentages?: Record<string, number>;
  interval: RecurringInterval;
  next_due: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: number;
  group: number;
  description: string;
  notes?: string;
  image?: string | null;
  receipt_data?: ReceiptData | null;
  recurring?: number | null;
  amount: string;
  currency: string;
  paid_by: User;
  split_type: 'equal' | 'exact' | 'percentage';
  splits: ExpenseSplit[];
  created_at: string;
}

export interface ReceiptData {
  items: { name: string; price: number }[];
  subtotal: number;
  tax: number;
  service_charge: number;
  tip: number;
  currency: string;
}

export interface ExpenseSplit {
  id: number;
  user: User;
  amount: string;
}

export interface Balance {
  user: User;
  amount: number; // positive = they owe you, negative = you owe them
}

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ReceiptScanResult {
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  service_charge: number;
  tip: number;
  total: number;
  currency: string;
}

export interface Settlement {
  id: number;
  payer: User;
  receiver: User;
  amount: string;
  currency: string;
  group?: number;
  note?: string;
  created_at: string;
}
