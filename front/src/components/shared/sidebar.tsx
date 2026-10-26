'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Briefcase,
  LogOut,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { MobileHeader } from './mobile-header';
import { cn } from '@/lib/utils';
import { storageService } from '@/services/storage.service';

const navigation = [
  { name: 'Dashboard', href: '/homepage', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Prestations', href: '/prestations', icon: Briefcase },
  { name: 'Factures', href: '/invoices', icon: Receipt },
  { name: 'Mon Profil', href: '/profile', icon: User },
];

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <>
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-bold tracking-tight">FreelanceFlow</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              )}
            >
              <item.icon
                className={cn('h-4 w-4', isActive ? 'text-primary' : '')}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
          onClick={() => {
            storageService.clear(); // Nettoie le storage
            window.location.href = '/login'; // Redirige vers login
          }}
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </>
  );
}

function MobileMenu({
  pathname,
  isOpen,
  onClose,
}: {
  pathname: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'bg-background fixed top-0 left-0 z-50 flex h-full w-full flex-col shadow-xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <span className="text-lg font-bold tracking-tight">
            FreelanceFlow
          </span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                )}
                onClick={onClose}
              >
                <item.icon
                  className={cn('h-5 w-5', isActive ? 'text-primary' : '')}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </Button>
        </div>
      </aside>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleToggleMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleCloseMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <MobileHeader isOpen={isMobileMenuOpen} onToggle={handleToggleMenu} />

      {!isMobile && (
        <aside className="bg-background flex h-screen w-64 flex-col border-r">
          <SidebarContent pathname={pathname} />
        </aside>
      )}

      {isMobile && (
        <MobileMenu
          pathname={pathname}
          isOpen={isMobileMenuOpen}
          onClose={handleCloseMenu}
        />
      )}
    </>
  );
}
