'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { storageService } from '@/services/storage.service';
import { User } from '@/types';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. On tente le localStorage d'abord (rapide)
      const localUser = storageService.getUser();

      if (localUser) {
        setUser(localUser);
      } else {
        // 2. Si vide, on demande au serveur (car le cookie est là !)
        const { data } = await authService.getMe();
        setUser(data);
        storageService.setUser(data); // On synchronise le local pour la prochaine fois
      }
    } catch (error) {
      console.error('Erreur auth:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const logout = () => {
    storageService.clear();
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  return {
    user,
    isLoading,
    isAuthenticated: storageService.isAuthenticated(),
    logout,
    refreshUser: loadUser,
  };
}
