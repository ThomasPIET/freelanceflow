import api from '@/lib/api';
import { User } from '@/types';

export type AdminUser = Pick<
  User,
  'id' | 'email' | 'first_name' | 'last_name' | 'role' | 'created_at'
>;

export const userService = {
  deleteMe: () => api.delete('/users/me'),
  getAll: () => api.get<AdminUser[]>('/users'),
  delete: (id: number) => api.delete(`/users/${id}`),
};
