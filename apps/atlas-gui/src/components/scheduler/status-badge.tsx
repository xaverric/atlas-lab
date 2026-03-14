'use client';

import { cn } from '@/lib/utils';
import { getStatusClasses } from '@/lib/status-colors';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', getStatusClasses(status), className)}>
      {status}
    </span>
  );
}
