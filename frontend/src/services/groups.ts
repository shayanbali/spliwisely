import api from './api';
import { Group } from '../types';

export const getGroups = () => api.get<Group[]>('/groups/').then(r => r.data);

export const getGroup = (id: number) => api.get<Group>(`/groups/${id}/`).then(r => r.data);

export const createGroup = (name: string, currency = 'USD', description?: string) =>
  api.post<Group>('/groups/', { name, currency, description }).then(r => r.data);

export const addMember = (groupId: number, email: string) =>
  api.post(`/groups/${groupId}/members/`, { email });

export const removeMember = (groupId: number, userId: number) =>
  api.delete(`/groups/${groupId}/members/${userId}/`);

export const getFriends = () => api.get('/groups/friends/').then(r => r.data);

export const updateGroupImage = (groupId: number, imageUri: string): Promise<Group> => {
  const form = new FormData();
  form.append('image', { uri: imageUri, name: 'group.jpg', type: 'image/jpeg' } as any);
  return api.patch<Group>(`/groups/${groupId}/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};
