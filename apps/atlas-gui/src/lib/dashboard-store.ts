const STORAGE_KEY = 'atlas-dashboard-widgets';
const OLD_PINS_KEY = 'atlas-dashboard-pins';

export type WidgetType = 'job' | 'tracker' | 'folder-notes' | 'folder-files' | 'stats';
export type WidgetSize = 'sm' | 'md' | 'lg';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
  order: number;
  size: WidgetSize;
}

interface OldPin {
  jobId: string;
  jobName: string;
  addedAt: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function migrateOldPins(): DashboardWidget[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OLD_PINS_KEY);
    if (!raw) return null;
    const pins: OldPin[] = JSON.parse(raw);
    if (!Array.isArray(pins) || pins.length === 0) return null;

    const widgets: DashboardWidget[] = pins.map((pin, i) => ({
      id: generateId(),
      type: 'job' as const,
      title: pin.jobName,
      config: { jobId: pin.jobId },
      order: i,
      size: 'md' as const,
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    localStorage.removeItem(OLD_PINS_KEY);
    return widgets;
  } catch {
    return null;
  }
}

function read(): DashboardWidget[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const migrated = migrateOldPins();
    return migrated || [];
  } catch {
    return [];
  }
}

function write(widgets: DashboardWidget[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export const dashboardStore = {
  getWidgets(): DashboardWidget[] {
    return read().sort((a, b) => a.order - b.order);
  },

  addWidget(widget: Omit<DashboardWidget, 'id' | 'order'>): DashboardWidget {
    const widgets = read();
    const maxOrder = widgets.reduce((max, w) => Math.max(max, w.order), -1);
    const newWidget: DashboardWidget = {
      ...widget,
      id: generateId(),
      order: maxOrder + 1,
    };
    write([...widgets, newWidget]);
    return newWidget;
  },

  removeWidget(id: string): void {
    const widgets = read().filter((w) => w.id !== id);
    write(widgets);
  },

  updateWidget(id: string, updates: Partial<DashboardWidget>): void {
    const widgets = read().map((w) =>
      w.id === id ? { ...w, ...updates, id: w.id } : w
    );
    write(widgets);
  },

  reorderWidgets(ids: string[]): void {
    const widgets = read();
    const reordered = widgets.map((w) => ({
      ...w,
      order: ids.indexOf(w.id),
    }));
    write(reordered);
  },
};
