'use client';

import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
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
  widgetId: string;
  onRemove: () => void;
  onResize?: () => void;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  children: ReactNode;
}

const nextSize: Record<WidgetSize, WidgetSize> = { sm: 'md', md: 'lg', lg: 'sm' };

export function WidgetCard({ title, size, widgetId, onRemove, onResize, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, children }: WidgetCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-all',
        sizeClasses[size],
        isDragOver && 'ring-2 ring-primary/50 border-primary/50',
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', widgetId);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(e);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver?.(e);
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
          <h3 className="font-medium text-sm truncate">{title}</h3>
          <span className="text-[10px] text-muted-foreground/50 uppercase">{size}</span>
        </div>
        <div className="flex items-center gap-0.5 ml-2 shrink-0">
          {onResize && (
            <button
              onClick={onResize}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={`Resize to ${nextSize[size]}`}
            >
              {size === 'lg' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={onRemove}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
