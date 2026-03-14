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
    <div className="flex rounded-md border">
      <button
        onClick={() => onChange('grid')}
        className={cn('rounded-l-md p-1.5 transition-colors', view === 'grid' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50')}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn('rounded-r-md p-1.5 transition-colors', view === 'list' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50')}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
