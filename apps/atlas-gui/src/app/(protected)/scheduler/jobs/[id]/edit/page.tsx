'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { JobForm, formToPayload, jobToFormData } from '@/components/scheduler/job-form';
import type { JobFormData } from '@/components/scheduler/job-form';

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

  if (!initialData) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => router.push(`/scheduler/jobs/${id}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Job
      </button>
      <h1 className="text-2xl font-semibold tracking-tight">Edit Job</h1>
      <JobForm initialData={initialData} onSubmit={handleSubmit} submitLabel="Save Changes" saving={saving} />
    </div>
  );
}
