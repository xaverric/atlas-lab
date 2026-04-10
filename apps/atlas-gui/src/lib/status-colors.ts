const statusMap: Record<string, string> = {
  success: 'bg-[#34c759]/10 text-[#34c759]',
  completed: 'bg-[#34c759]/10 text-[#34c759]',
  delivered: 'bg-[#34c759]/10 text-[#34c759]',
  enabled: 'bg-[#34c759]/10 text-[#34c759]',
  active: 'bg-[#34c759]/10 text-[#34c759]',

  error: 'bg-[#ff3b30]/10 text-[#ff3b30]',
  failed: 'bg-[#ff3b30]/10 text-[#ff3b30]',
  rejected: 'bg-[#ff3b30]/10 text-[#ff3b30]',
  disabled: 'bg-[#ff3b30]/10 text-[#ff3b30]',

  running: 'bg-[#007aff]/10 text-[#007aff]',
  pending: 'bg-[#007aff]/10 text-[#007aff]',
  in_progress: 'bg-[#007aff]/10 text-[#007aff]',
  queued: 'bg-[#007aff]/10 text-[#007aff]',

  warning: 'bg-[#ff9500]/10 text-[#ff9500]',
  timeout: 'bg-[#ff9500]/10 text-[#ff9500]',
  stale: 'bg-[#ff9500]/10 text-[#ff9500]',
  paused: 'bg-[#ff9500]/10 text-[#ff9500]',
};

export function getStatusClasses(status?: string | null): string {
  if (!status) return 'bg-[#f5f5f7] text-[rgba(0,0,0,0.48)] dark:bg-[#1c1c1e] dark:text-[rgba(255,255,255,0.48)]';
  return statusMap[status.toLowerCase()] ?? 'bg-[#f5f5f7] text-[rgba(0,0,0,0.48)] dark:bg-[#1c1c1e] dark:text-[rgba(255,255,255,0.48)]';
}
