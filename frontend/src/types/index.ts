export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
}

export interface Group {
  id: number;
  name: string;
  members: User[];
  created_at: string;
}

export interface Expense {
  id: number;
  group: number;
  description: string;
  amount: string;
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
  group?: number;
  created_at: string;
}
