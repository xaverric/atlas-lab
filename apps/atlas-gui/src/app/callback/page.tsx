'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserManager } from '@/lib/auth';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    getUserManager()
      .signinRedirectCallback()
      .then(() => router.replace('/dashboard'))
      .catch((err) => {
        console.error('OIDC callback error:', err);
        router.replace('/');
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Completing sign in...</p>
    </main>
  );
}
