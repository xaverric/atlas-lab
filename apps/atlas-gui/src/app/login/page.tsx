'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
      return;
    }
    login();
  }, [login, isAuthenticated]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to login...</p>
    </main>
  );
}
