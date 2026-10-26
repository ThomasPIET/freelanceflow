'use client';

import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileHeader({ isOpen, onToggle }: MobileHeaderProps) {
  return (
    <header className="bg-background fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-b px-4 md:hidden">
      <span className="text-lg font-bold tracking-tight">FreelanceFlow</span>
      <Button variant="ghost" size="icon" onClick={onToggle}>
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
    </header>
  );
}
