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
  members: GroupMember[];
  member_count: number;
  created_at: string;
}

export interface GroupMember {
  id: number;
  user: User;
  role: string;
  joined_at: string;
}

export interface Expense {
  id: number;
  group: number;
  description: string;
  notes?: string;
  amount: string;
  currency: string;
  paid_by: User;
  split_type: 'equal' | 'exact' | 'percentage';
  splits: ExpenseSplit[];
  created_at: string;
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

export interface Settlement {
  id: number;
  payer: User;
  receiver: User;
  amount: string;
  currency: string;
  group?: number;
  created_at: string;
}
