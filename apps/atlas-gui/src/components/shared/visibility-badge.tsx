'use client';

import { Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisibilityBadgeProps {
  isPublic: boolean;
  permission?: 'view' | 'edit' | 'full';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function VisibilityBadge({ isPublic, permission, size = 'sm', showLabel = true }: VisibilityBadgeProps) {
  const Icon = isPublic ? Globe : Lock;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (!isPublic) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
        <Icon className={iconSize} />
        {showLabel && 'private'}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-info', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
      <Icon className={iconSize} />
      {showLabel && (permission || 'public')}
    </span>
  );
}
