'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WidgetSize } from '@/lib/dashboard-store';
import { cn } from '@/lib/utils';

const sizeClasses: Record<WidgetSize, string> = {
  sm: 'col-span-1',
  md: 'col-span-1 sm:col-span-2',
  lg: 'col-span-1 sm:col-span-2 lg:col-span-3',
};

interface WidgetCardProps {
  title: string;
  size: WidgetSize;
  onRemove: () => void;
  children: ReactNode;
}

export function WidgetCard({ title, size, onRemove, children }: WidgetCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', sizeClasses[size])}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm truncate">{title}</h3>
        <button
          onClick={onRemove}
          className="ml-2 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
