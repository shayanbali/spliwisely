import api from './api';
import { Group, PotTransaction } from '../types';

export const getGroups = () => api.get<Group[]>('/groups/').then(r => r.data);

export const getGroup = (id: number) => api.get<Group>(`/groups/${id}/`).then(r => r.data);

export const createGroup = (name: string, currency = 'USD', description?: string, groupType: 'regular' | 'gaming' = 'regular') =>
  api.post<Group>('/groups/', { name, currency, description, group_type: groupType }).then(r => r.data);

export const getPotTransactions = (groupId: number) =>
  api.get<PotTransaction[]>(`/groups/${groupId}/pot/`).then(r => r.data);

export const getPotBalance = (groupId: number) =>
  api.get<{ balance: string; currency: string }>(`/groups/${groupId}/pot/balance/`).then(r => r.data);

export const createPotTransaction = (groupId: number, data: {
  user_id: number;
  transaction_type: 'contribution' | 'payout';
  amount: number;
  currency: string;
  note?: string;
}) => api.post(`/groups/${groupId}/pot/`, data).then(r => r.data);

export const addMember = (groupId: number, email: string) =>
  api.post(`/groups/${groupId}/members/`, { email });

export const removeMember = (groupId: number, userId: number) =>
  api.delete(`/groups/${groupId}/members/${userId}/`);

export const getFriends = () => api.get('/groups/friends/').then(r => r.data);

export const updateGroupSettings = (groupId: number, settings: { simplify_debts?: boolean; name?: string }): Promise<Group> =>
  api.patch<Group>(`/groups/${groupId}/`, settings).then(r => r.data);

export const updateGroupImage = (groupId: number, imageUri: string): Promise<Group> => {
  const form = new FormData();
  form.append('image', { uri: imageUri, name: 'group.jpg', type: 'image/jpeg' } as any);
  return api.patch<Group>(`/groups/${groupId}/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};
