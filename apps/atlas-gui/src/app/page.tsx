'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Atlas</h1>
        <p className="mt-4 text-lg text-muted-foreground">Your personal platform</p>
      </div>
      <div>
        {isAuthenticated ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign In
          </Link>
        )}
      </div>
    </main>
  );
}
