'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { JobChart } from './job-chart';

interface DashboardWidgetProps {
  jobId: string;
  jobName: string;
  onRemove: () => void;
}

export function DashboardWidget({ jobId, jobName, onRemove }: DashboardWidgetProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <Link
          href={`/scheduler/jobs/${jobId}`}
          className="font-medium text-sm hover:underline truncate"
        >
          {jobName}
        </Link>
        <button
          onClick={onRemove}
          className="ml-2 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <JobChart jobId={jobId} compact />
    </div>
  );
}
