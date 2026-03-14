'use client';

import { useEffect, useState } from 'react';
import { X, Briefcase, Activity, StickyNote, FileText, BarChart3, ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { dashboardStore, type WidgetType, type WidgetSize, type DashboardWidget } from '@/lib/dashboard-store';
import { toast } from 'sonner';

interface AddWidgetDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (widget: DashboardWidget) => void;
}

type Step = 'type' | 'config' | 'size';

interface WidgetTypeOption {
  type: WidgetType;
  label: string;
  description: string;
  icon: typeof Briefcase;
}

const widgetTypes: WidgetTypeOption[] = [
  { type: 'job', label: 'Job Monitor', description: 'Track a scheduler job with charts', icon: Briefcase },
  { type: 'tracker', label: 'Tracker Table', description: 'Recent data from a tracker endpoint', icon: Activity },
  { type: 'folder-notes', label: 'Notes Folder', description: 'Recent notes from a folder', icon: StickyNote },
  { type: 'folder-files', label: 'Files Folder', description: 'Recent files from a folder', icon: FileText },
  { type: 'stats', label: 'Stats', description: 'User profile summary', icon: BarChart3 },
];

const sizeOptions: { value: WidgetSize; label: string; desc: string }[] = [
  { value: 'sm', label: 'Small', desc: '1 column' },
  { value: 'md', label: 'Medium', desc: '2 columns' },
  { value: 'lg', label: 'Large', desc: '3 columns' },
];

interface SelectOption {
  value: string;
  label: string;
  extra?: string;
}

export function AddWidgetDialog({ open, onClose, onAdded }: AddWidgetDialogProps) {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<WidgetSize>('md');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('type');
      setSelectedType(null);
      setSelectedValue('');
      setSelectedLabel('');
      setSelectedSize('md');
      setOptions([]);
    }
  }, [open]);

  const handleSelectType = (type: WidgetType) => {
    setSelectedType(type);

    if (type === 'stats') {
      setSelectedSize('sm');
      setStep('size');
      return;
    }

    setStep('config');
    setLoadingOptions(true);
    loadOptions(type);
  };

  const loadOptions = async (type: WidgetType) => {
    try {
      if (type === 'job') {
        const res = await api<{ data: { id: string; name: string }[] }>('/api/v1/scheduler/jobs');
        setOptions(res.data.map((j) => ({ value: j.id, label: j.name })));
      } else if (type === 'tracker') {
        const res = await api<{ data: { name: string; displayName: string }[] }>('/api/v1/tracker/endpoints');
        setOptions(res.data.map((e) => ({ value: e.name, label: e.displayName })));
      } else if (type === 'folder-notes') {
        const res = await api<{ data: { id: string; name: string }[] }>('/api/v1/notes/folders');
        setOptions([
          { value: '__root__', label: 'Root (no folder)' },
          ...res.data.map((f) => ({ value: f.id, label: f.name })),
        ]);
      } else if (type === 'folder-files') {
        const res = await api<{ data: { id: string; name: string }[] }>('/api/v1/files/folders');
        setOptions([
          { value: '__root__', label: 'Root (no folder)' },
          ...res.data.map((f) => ({ value: f.id, label: f.name })),
        ]);
      }
    } catch {
      toast.error('Failed to load options');
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSelectOption = (opt: SelectOption) => {
    setSelectedValue(opt.value);
    setSelectedLabel(opt.label);
    setStep('size');
  };

  const handleAdd = () => {
    if (!selectedType) return;

    let title = '';
    let config: Record<string, unknown> = {};

    switch (selectedType) {
      case 'job':
        title = selectedLabel;
        config = { jobId: selectedValue };
        break;
      case 'tracker':
        title = selectedLabel;
        config = { endpointName: selectedValue, limit: 10 };
        break;
      case 'folder-notes':
        title = `Notes: ${selectedLabel}`;
        config = {
          folderId: selectedValue === '__root__' ? null : selectedValue,
          folderName: selectedLabel,
        };
        break;
      case 'folder-files':
        title = `Files: ${selectedLabel}`;
        config = {
          folderId: selectedValue === '__root__' ? null : selectedValue,
          folderName: selectedLabel,
        };
        break;
      case 'stats':
        title = 'Stats';
        config = {};
        break;
    }

    const widget = dashboardStore.addWidget({ type: selectedType, title, config, size: selectedSize });
    onAdded(widget);
    toast.success('Widget added');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {step !== 'type' && (
              <button
                onClick={() => setStep(step === 'size' && selectedType !== 'stats' ? 'config' : 'type')}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {step === 'type' && 'Choose Widget Type'}
              {step === 'config' && 'Configure Widget'}
              {step === 'size' && 'Choose Size'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'type' && (
          <div className="space-y-2">
            {widgetTypes.map((wt) => {
              const Icon = wt.icon;
              return (
                <button
                  key={wt.type}
                  onClick={() => handleSelectType(wt.type)}
                  className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors"
                >
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{wt.label}</p>
                    <p className="text-xs text-muted-foreground">{wt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-2">
            {loadingOptions ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No items found</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectOption(opt)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'size' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {sizeOptions.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSelectedSize(s.value)}
                  className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    selectedSize === s.value
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.desc}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleAdd}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add Widget
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
