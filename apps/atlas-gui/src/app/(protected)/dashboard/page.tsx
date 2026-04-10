'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Briefcase, FileText, StickyNote, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { dashboardStore, type DashboardWidget } from '@/lib/dashboard-store';
import { WidgetCard } from '@/components/dashboard/dashboard-widget';
import { JobChart } from '@/components/dashboard/job-chart';
import { StatsCard } from '@/components/dashboard/stats-card';
import { TrackerTableWidget } from '@/components/dashboard/tracker-widget';
import { FolderWidget } from '@/components/dashboard/folder-widget';
import { AddWidgetDialog } from '@/components/dashboard/add-widget-dialog';
import { useNotificationContext } from '@/contexts/notification-context';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import type { User, PaginatedResponse } from '@atlas/core';

export default function DashboardPage() {
  const { user: oidcUser } = useAuth();
  const { unreadCount } = useNotificationContext();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [stats, setStats] = useState({ jobs: 0, files: 0, notes: 0 });

  useEffect(() => {
    setWidgets(dashboardStore.getWidgets());
    api<{ data: User }>('/api/v1/users/me')
      .then((res) => setProfile(res.data))
      .catch(console.error);

    Promise.allSettled([
      api<PaginatedResponse<unknown>>('/api/v1/scheduler/jobs?limit=1'),
      api<PaginatedResponse<unknown>>('/api/v1/files/documents?limit=1'),
      api<PaginatedResponse<unknown>>('/api/v1/notes?limit=1'),
    ]).then(([jobsRes, filesRes, notesRes]) => {
      setStats({
        jobs: jobsRes.status === 'fulfilled' ? jobsRes.value.total : 0,
        files: filesRes.status === 'fulfilled' ? filesRes.value.total : 0,
        notes: notesRes.status === 'fulfilled' ? notesRes.value.total : 0,
      });
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    dashboardStore.removeWidget(id);
    setWidgets(dashboardStore.getWidgets());
    toast.success('Widget removed');
  }, []);

  const handleAdded = useCallback(() => {
    setWidgets(dashboardStore.getWidgets());
  }, []);

  const handleResize = useCallback((id: string) => {
    const sizes: Record<string, string> = { sm: 'md', md: 'lg', lg: 'sm' };
    const widget = widgets.find((w) => w.id === id);
    if (!widget) return;
    const newSize = sizes[widget.size] as 'sm' | 'md' | 'lg';
    dashboardStore.updateWidget(id, { size: newSize });
    setWidgets(dashboardStore.getWidgets());
  }, [widgets]);

  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDrop = useCallback((targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    const current = dashboardStore.getWidgets();
    const sourceIdx = current.findIndex((w) => w.id === sourceId);
    const targetIdx = current.findIndex((w) => w.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const reordered = [...current];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    dashboardStore.reorderWidgets(reordered.map((w) => w.id));
    setWidgets(dashboardStore.getWidgets());
  }, []);

  const renderWidgetContent = (widget: DashboardWidget) => {
    switch (widget.type) {
      case 'job':
        return <JobChart jobId={widget.config.jobId as string} compact />;
      case 'tracker':
        return (
          <TrackerTableWidget
            endpointName={widget.config.endpointName as string}
            limit={widget.config.limit as number | undefined}
          />
        );
      case 'folder-notes':
        return (
          <FolderWidget
            type="notes"
            folderId={widget.config.folderId as string | null}
            folderName={widget.config.folderName as string}
          />
        );
      case 'folder-files':
        return (
          <FolderWidget
            type="files"
            folderId={widget.config.folderId as string | null}
            folderName={widget.config.folderName as string}
          />
        );
      case 'stats':
        return (
          <div className="space-y-2">
            <StatsCard
              title="Welcome"
              value={profile?.name || oidcUser?.profile?.name || 'User'}
              description="Good to see you"
            />
            <StatsCard
              title="Role"
              value={profile?.role || 'user'}
              description="Your current role"
            />
          </div>
        );
      default:
        return <p className="text-sm text-muted-foreground">Unknown widget type</p>;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Dashboard">
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Widget
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Jobs', value: stats.jobs, icon: Briefcase },
            { label: 'Files', value: stats.files, icon: FileText },
            { label: 'Notes', value: stats.notes, icon: StickyNote },
            { label: 'Unread Notifications', value: unreadCount, icon: Bell },
          ].map((card) => (
            <div key={card.label} className="rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-[28px] font-bold leading-none">{card.value}</p>
            </div>
          ))}
        </div>

        {widgets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widgetId={widget.id}
                title={widget.title}
                size={widget.size}
                onRemove={() => handleRemove(widget.id)}
                onResize={() => handleResize(widget.id)}
                isDragOver={dragOverId === widget.id}
                onDragOver={() => setDragOverId(widget.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => handleDrop(widget.id, e)}
              >
                {renderWidgetContent(widget)}
              </WidgetCard>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center">
            <p className="text-muted-foreground mb-3">No widgets yet. Add your first widget.</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Widget
            </button>
          </div>
        )}
      </div>

      <AddWidgetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
