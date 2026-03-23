'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { JobForm, formToPayload, jobToFormData } from '@/components/scheduler/job-form';
import type { JobFormData } from '@/components/scheduler/job-form';
import { PageHeader } from '@/components/shared/page-header';

export default function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initialData, setInitialData] = useState<JobFormData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ data: Record<string, unknown> }>(`/api/v1/scheduler/jobs/${id}`)
      .then((res) => setInitialData(jobToFormData(res.data)))
      .catch(() => toast.error('Job not found'));
  }, [id]);

  const handleSubmit = async (form: JobFormData) => {
    setSaving(true);
    try {
      const payload = formToPayload(form);
      await api(`/api/v1/scheduler/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.success('Job updated');
      router.push(`/scheduler/jobs/${id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setSaving(false);
    }
  };

  if (!initialData) return <p className="p-8 text-muted-foreground">Loading...</p>;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Edit Job" />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl space-y-6">
          <button onClick={() => router.push(`/scheduler/jobs/${id}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Job
          </button>
          <JobForm initialData={initialData} onSubmit={handleSubmit} submitLabel="Save Changes" saving={saving} />
        </div>
      </div>
    </div>
  );
}
