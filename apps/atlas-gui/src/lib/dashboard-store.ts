const STORAGE_KEY = 'atlas-dashboard-pins';

export interface DashboardItem {
  jobId: string;
  jobName: string;
  addedAt: string;
}

function read(): DashboardItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function write(items: DashboardItem[]): DashboardItem[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items;
}

export const dashboardStore = {
  getItems: read,

  addItem(jobId: string, jobName: string): DashboardItem[] {
    const items = read();
    if (items.some((i) => i.jobId === jobId)) return items;
    return write([...items, { jobId, jobName, addedAt: new Date().toISOString() }]);
  },

  removeItem(jobId: string): DashboardItem[] {
    return write(read().filter((i) => i.jobId !== jobId));
  },

  hasItem(jobId: string): boolean {
    return read().some((i) => i.jobId === jobId);
  },
};
