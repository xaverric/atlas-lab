'use client';

import { Globe, Lock, Link } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisibilityBadgeProps {
  isPublic: boolean;
  permission?: 'view' | 'edit' | 'full';
  inherited?: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function VisibilityBadge({ isPublic, permission, inherited, size = 'sm', showLabel = true }: VisibilityBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  if (!isPublic) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', textSize)}>
        <Lock className={iconSize} />
        {showLabel && 'private'}
      </span>
    );
  }

  if (inherited) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-amber-500', textSize)} title="Public (inherited from parent folder)">
        <Link className={iconSize} />
        {showLabel && (
          <span>
            {permission || 'public'}
            <span className="opacity-60 ml-0.5">(inherited)</span>
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-info', textSize)}>
      <Globe className={iconSize} />
      {showLabel && (permission || 'public')}
    </span>
  );
}
