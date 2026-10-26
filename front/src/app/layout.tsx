'use client';

import './globals.css';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/shared/sidebar';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

const fontSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      setIsAuthenticated(!!token);
      setIsLoading(false);
    };

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkAuth();
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  if (isLoading) {
    return (
      <html
        lang="en"
        className={cn('h-full', fontSans.variable, fontMono.variable)}
      >
        <body className="bg-background text-foreground min-h-screen antialiased">
          <div className="flex min-h-screen items-center justify-center">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html
      lang="en"
      className={cn('h-full', fontSans.variable, fontMono.variable)}
    >
      <body
        className={cn(
          'bg-background text-foreground flex min-h-screen antialiased'
        )}
      >
        {isAuthenticated && <Sidebar />}
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            !isAuthenticated && 'w-full',
            isAuthenticated && !isMobile && 'p-10',
            isAuthenticated && isMobile && 'px-4 pt-20 pb-4'
          )}
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
