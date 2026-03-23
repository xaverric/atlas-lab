'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { JobForm, formToPayload } from '@/components/scheduler/job-form';
import type { JobFormData } from '@/components/scheduler/job-form';
import { PageHeader } from '@/components/shared/page-header';

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (form: JobFormData) => {
    setSaving(true);
    try {
      const payload = formToPayload(form);
      await api('/api/v1/scheduler/jobs', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('Job created');
      router.push('/scheduler');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="New Job" />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <button onClick={() => router.push('/scheduler')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </button>
          <JobForm onSubmit={handleSubmit} submitLabel="Create Job" saving={saving} />
        </div>
      </div>
    </div>
  );
}
