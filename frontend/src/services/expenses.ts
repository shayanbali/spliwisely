import api from './api';
import { Expense, Settlement, RecurringExpense, RecurringInterval, ReceiptScanResult } from '../types';

export const getExpenses = (groupId?: number) =>
  api.get<Expense[]>('/expenses/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const createExpense = (data: {
  description: string;
  notes?: string;
  amount: number;
  currency: string;
  paid_by_id: number;
  group?: number;
  split_type: 'equal' | 'exact' | 'percentage';
  participant_ids: number[];
  exact_amounts?: Record<string, number>;
  percentages?: Record<string, number>;
  receipt_data?: object;
}) => api.post<Expense>('/expenses/', data).then(r => r.data);

export const deleteExpense = (id: number) => api.delete(`/expenses/${id}/`);

export const updateExpense = (id: number, data: {
  description?: string;
  notes?: string;
  amount?: number;
  currency?: string;
  paid_by_id?: number;
  split_type?: 'equal' | 'exact' | 'percentage';
  participant_ids?: number[];
  exact_amounts?: Record<string, number>;
  percentages?: Record<string, number>;
  receipt_data?: object;
}) => api.patch<Expense>(`/expenses/${id}/`, data).then(r => r.data);

export const voteOnExpense = (id: number, approved: boolean) =>
  api.post<{ status: string }>(`/expenses/${id}/vote/`, { approved }).then(r => r.data);

export const getBalances = (groupId?: number) =>
  api.get('/expenses/balances/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const getSimplifiedBalances = (groupId?: number) =>
  api.get('/expenses/balances/simplified/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const createSettlement = (data: {
  payer_id: number;
  receiver_id: number;
  amount: number;
  currency: string;
  group?: number;
  note?: string;
}) => api.post<Settlement>('/expenses/settlements/', data).then(r => r.data);

export const getSettlements = (groupId?: number) =>
  api.get<Settlement[]>('/expenses/settlements/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const getRates = () =>
  api.get<{ base: string; rates: Record<string, number> }>('/expenses/rates/').then(r => r.data);

export const getActivityFeed = (groupId?: number) =>
  api.get('/expenses/activity/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const getGroupBalances = () =>
  api.get('/expenses/group-balances/').then(r => r.data);

export const getRecurringExpenses = (groupId: number) =>
  api.get<RecurringExpense[]>('/expenses/recurring/', { params: { group: groupId } }).then(r => r.data);

export const createRecurringExpense = (data: {
  group: number;
  description: string;
  notes?: string;
  amount: number;
  currency: string;
  paid_by_id: number;
  split_type: 'equal' | 'exact' | 'percentage';
  participant_ids: number[];
  exact_amounts?: Record<string, number>;
  percentages?: Record<string, number>;
  interval: RecurringInterval;
}) => api.post<RecurringExpense>('/expenses/recurring/', data).then(r => r.data);

export const updateRecurringExpense = (id: number, data: Partial<{ is_active: boolean; description: string; amount: number }>) =>
  api.patch<RecurringExpense>(`/expenses/recurring/${id}/`, data).then(r => r.data);

export const deleteRecurringExpense = (id: number) =>
  api.delete(`/expenses/recurring/${id}/`);

export const generateRecurringExpenses = (groupId: number) =>
  api.post('/expenses/recurring/generate/', { group: groupId }).then(r => r.data);

export interface AnalyticsPeriod { label: string; total: string; }
export interface AnalyticsCategory { label: string; total: string; percentage: number; }
export interface MemberSpending {
  user: { id: number; name: string; email: string; avatar?: string };
  amount: string;
  percentage: number;
}
export interface AnalyticsData {
  periods: AnalyticsPeriod[];
  categories: AnalyticsCategory[];
  current_total: string;
  previous_total: string;
  change_pct: number | null;
  currency: string;
  member_spending?: MemberSpending[];
}
export const getAnalytics = (period: 'monthly' | 'weekly', groupId?: number) =>
  api.get<AnalyticsData>('/expenses/analytics/', {
    params: { period, ...(groupId ? { group: groupId } : {}) },
  }).then(r => r.data);

export const scanReceipt = (imageUri: string): Promise<ReceiptScanResult> => {
  const form = new FormData();
  form.append('image', { uri: imageUri, type: 'image/jpeg', name: 'receipt.jpg' } as any);
  return api.post<ReceiptScanResult>('/expenses/scan-receipt/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  }).then(r => r.data);
};

export const uploadExpenseImage = (id: number, uri: string | null) => {
  if (uri === null) {
    return api.patch<Expense>(`/expenses/${id}/`, { image: null }).then(r => r.data);
  }
  const form = new FormData();
  form.append('image', { uri, type: 'image/jpeg', name: 'expense_photo.jpg' } as any);
  return api.patch<Expense>(`/expenses/${id}/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};
