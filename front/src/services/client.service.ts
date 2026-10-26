import api from '@/lib/api';
import { Client } from '@/types';

export const clientService = {
  getAll: () => api.get<Client[]>('/clients'),

  getOne: (id: number) => api.get<Client>(`/clients/${id}`),

  create: (data: Partial<Client>) => api.post<Client>('/clients', data),

  update: (id: number, data: Partial<Client>) =>
    api.put<Client>(`/clients/${id}`, data),

  delete: (id: number) => api.delete(`/clients/${id}`),

  exportCSV: () => api.get('/clients/export', { responseType: 'blob' }),
};
