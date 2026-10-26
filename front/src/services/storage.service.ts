import { User } from '@/types';
import Cookies from 'js-cookie';

export const storageService = {
  setToken(token: string): void {
    localStorage.setItem('token', token);

    Cookies.set('token', token, {
      expires: 7,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  removeToken(): void {
    localStorage.removeItem('token');

    Cookies.remove('token');
  },

  setUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  removeUser(): void {
    localStorage.removeItem('user');
  },

  clear(): void {
    this.removeToken();
    this.removeUser();

    Cookies.remove('token');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
