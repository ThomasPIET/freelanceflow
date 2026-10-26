import api from '@/lib/api';
import { Invoice } from '@/types';

export const invoiceService = {
  getAll: () => api.get<Invoice[]>('/invoices'),
  getOne: (id: number) => api.get<Invoice>(`/invoices/${id}`),
  create: (data: Partial<Invoice>) => api.post<Invoice>('/invoices', data),
  update: (id: number, data: Partial<Invoice>) =>
    api.put<Invoice>(`/invoices/${id}`, data),
  delete: (id: number) => api.delete(`/invoices/${id}`),
  generatePDF: (id: number) =>
    api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  exportCSV: () => api.get('/invoices/export', { responseType: 'blob' }),
  sendEmail: (id: number) => api.post(`/invoices/${id}/send`),
};
