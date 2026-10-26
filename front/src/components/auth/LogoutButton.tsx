'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <Button onClick={logout} variant="outline">
      Logout
    </Button>
  );
}
