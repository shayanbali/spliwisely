import api from './api';
import { Expense, Settlement } from '../types';

export const getExpenses = (groupId?: number) =>
  api.get<Expense[]>('/expenses/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const createExpense = (data: {
  description: string;
  amount: number;
  paid_by_id: number;
  group?: number;
  split_type: 'equal' | 'exact' | 'percentage';
  participant_ids: number[];
  exact_amounts?: Record<string, number>;
  percentages?: Record<string, number>;
}) => api.post<Expense>('/expenses/', data).then(r => r.data);

export const deleteExpense = (id: number) => api.delete(`/expenses/${id}/`);

export const getBalances = (groupId?: number) =>
  api.get('/expenses/balances/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const getSimplifiedBalances = (groupId?: number) =>
  api.get('/expenses/balances/simplified/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const createSettlement = (data: {
  payer_id: number;
  receiver_id: number;
  amount: number;
  group?: number;
  note?: string;
}) => api.post<Settlement>('/expenses/settlements/', data).then(r => r.data);

export const getActivityFeed = (groupId?: number) =>
  api.get('/expenses/activity/', { params: groupId ? { group: groupId } : {} }).then(r => r.data);

export const getGroupBalances = () =>
  api.get('/expenses/group-balances/').then(r => r.data);
