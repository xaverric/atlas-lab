'use client';

import { LogOut, Settings, User, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded p-1.5 hover:bg-muted md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold hidden md:block">Atlas</h2>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{user?.profile?.name || user?.profile?.email || 'User'}</span>
        </div>
        <a href="/settings" className="text-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
        </a>
        <button
          onClick={() => logout()}
          className="text-muted-foreground hover:text-foreground"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
