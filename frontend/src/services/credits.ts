import api from './api';
import { CreditTransaction } from '../types';

export async function getCreditTransactions(): Promise<CreditTransaction[]> {
  const { data } = await api.get('/auth/credits/transactions/');
  return data;
}

export async function transferCredits(params: {
  to_user_id: number;
  amount: number;
  currency: string;
  note?: string;
  create_settlement?: boolean;
  group_id?: number | null;
}): Promise<{ balance: string; detail: string }> {
  const { data } = await api.post('/auth/credits/transfer/', params);
  return data;
}

export async function topUpDemo(amount: number): Promise<{ balance: string; detail: string }> {
  const { data } = await api.post('/auth/credits/topup-demo/', { amount });
  return data;
}
