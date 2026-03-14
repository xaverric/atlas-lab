const statusMap: Record<string, string> = {
  success: 'bg-success/10 text-success',
  completed: 'bg-success/10 text-success',
  delivered: 'bg-success/10 text-success',
  enabled: 'bg-success/10 text-success',
  active: 'bg-success/10 text-success',

  error: 'bg-destructive/10 text-destructive',
  failed: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
  disabled: 'bg-destructive/10 text-destructive',

  running: 'bg-info/10 text-info',
  pending: 'bg-info/10 text-info',
  in_progress: 'bg-info/10 text-info',
  queued: 'bg-info/10 text-info',

  warning: 'bg-warning/10 text-warning',
  timeout: 'bg-warning/10 text-warning',
  stale: 'bg-warning/10 text-warning',
  paused: 'bg-warning/10 text-warning',
};

export function getStatusClasses(status: string): string {
  return statusMap[status.toLowerCase()] ?? 'bg-muted text-muted-foreground';
}
