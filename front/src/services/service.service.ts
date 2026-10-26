import api from '@/lib/api';
import { Service } from '@/types';

export const serviceService = {
  getAll: () => api.get<Service[]>('/services'),
  getOne: (id: number) => api.get<Service>(`/services/${id}`),
  create: (data: Partial<Service>) => api.post<Service>('/services', data),
  update: (id: number, data: Partial<Service>) =>
    api.put<Service>(`/services/${id}`, data),
  delete: (id: number) => api.delete(`/services/${id}`),
};
