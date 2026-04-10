'use client';

import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  storageKey: string;
  onChange?: (view: ViewMode) => void;
}

export function useViewMode(storageKey: string, defaultMode: ViewMode = 'list'): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem(storageKey) as ViewMode) || defaultMode;
    return defaultMode;
  });

  const set = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(storageKey, v);
  };

  return [view, set];
}

export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div className="flex rounded-lg bg-[#f5f5f7] p-0.5 dark:bg-[#2c2c2e]">
      <button
        onClick={() => onChange('grid')}
        className={cn('rounded-md p-1.5 transition-colors', view === 'grid' ? 'bg-white text-[#1d1d1f] shadow-sm dark:bg-[#3a3a3c] dark:text-white' : 'text-[rgba(0,0,0,0.48)] hover:text-[#1d1d1f] dark:text-[rgba(255,255,255,0.48)] dark:hover:text-white')}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn('rounded-md p-1.5 transition-colors', view === 'list' ? 'bg-white text-[#1d1d1f] shadow-sm dark:bg-[#3a3a3c] dark:text-white' : 'text-[rgba(0,0,0,0.48)] hover:text-[#1d1d1f] dark:text-[rgba(255,255,255,0.48)] dark:hover:text-white')}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
