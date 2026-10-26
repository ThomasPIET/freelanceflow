import api from '@/lib/api';
import { User, AuthResponse } from '@/types';

export const authService = {
  login: (credentials: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', credentials),

  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    address_line1: string;
    address_line2?: string;
    zip_code: string;
    city: string;
    country: string;
  }) => api.post<User>('/auth/register', data),

  getMe: () => api.get<User>('/auth/me'),

  updateMe: (data: Partial<User>) => api.put<User>('/auth/me', data),

  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post<{ logo_data: string }>('/auth/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
