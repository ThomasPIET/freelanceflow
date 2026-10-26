import { afterEach, describe, expect, it } from 'vitest';
import Cookies from 'js-cookie';
import { storageService } from '@/services/storage.service';
import { User } from '@/types';

const user: User = {
  id: 1,
  email: 'john@test.com',
  first_name: 'John',
  last_name: 'Doe',
  created_at: '2026-10-26T00:00:00.000Z',
  role: 'standard',
};

describe('storageService', () => {
  afterEach(() => {
    localStorage.clear();
    Cookies.remove('token');
  });

  it('stores the token in localStorage and in a cookie', () => {
    storageService.setToken('abc');

    expect(storageService.getToken()).toBe('abc');
    expect(Cookies.get('token')).toBe('abc');
    expect(storageService.isAuthenticated()).toBe(true);
  });

  it('is not authenticated without a token', () => {
    expect(storageService.isAuthenticated()).toBe(false);
  });

  it('stores and reads the user', () => {
    storageService.setUser(user);

    expect(storageService.getUser()).toEqual(user);
  });

  it('returns null when no user is stored', () => {
    expect(storageService.getUser()).toBeNull();
  });

  it('clears token, cookie and user on logout', () => {
    storageService.setToken('abc');
    storageService.setUser(user);

    storageService.clear();

    expect(storageService.getToken()).toBeNull();
    expect(Cookies.get('token')).toBeUndefined();
    expect(storageService.getUser()).toBeNull();
  });
});
