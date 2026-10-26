import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

import api from '@/lib/api';
import { userService } from '@/services/user.service';

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the current account through /users/me', async () => {
    await userService.deleteMe();
    expect(api.delete).toHaveBeenCalledWith('/users/me');
  });

  it('lists accounts through /users', async () => {
    await userService.getAll();
    expect(api.get).toHaveBeenCalledWith('/users');
  });

  it('deletes an account by id', async () => {
    await userService.delete(42);
    expect(api.delete).toHaveBeenCalledWith('/users/42');
  });
});
