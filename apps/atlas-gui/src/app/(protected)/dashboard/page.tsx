'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { dashboardStore, type DashboardWidget } from '@/lib/dashboard-store';
import { WidgetCard } from '@/components/dashboard/dashboard-widget';
import { JobChart } from '@/components/dashboard/job-chart';
import { StatsCard } from '@/components/dashboard/stats-card';
import { TrackerTableWidget } from '@/components/dashboard/tracker-widget';
import { FolderWidget } from '@/components/dashboard/folder-widget';
import { AddWidgetDialog } from '@/components/dashboard/add-widget-dialog';
import { toast } from 'sonner';
import type { User } from '@atlas/core';

export default function DashboardPage() {
  const { user: oidcUser } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    setWidgets(dashboardStore.getWidgets());
    api<{ data: User }>('/api/v1/users/me')
      .then((res) => setProfile(res.data))
      .catch(console.error);
  }, []);

  const handleRemove = useCallback((id: string) => {
    dashboardStore.removeWidget(id);
    setWidgets(dashboardStore.getWidgets());
    toast.success('Widget removed');
  }, []);

  const handleAdded = useCallback(() => {
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
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Widget
        </button>
      </div>

      {widgets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              title={widget.title}
              size={widget.size}
              onRemove={() => handleRemove(widget.id)}
            >
              {renderWidgetContent(widget)}
            </WidgetCard>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-3">No widgets yet. Add your first widget.</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </button>
        </div>
      )}

      <AddWidgetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
