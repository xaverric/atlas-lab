'use client';

import { Plus, X } from 'lucide-react';

interface KeyValuePair {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  label: string;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({ label, pairs, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }: KeyValueEditorProps) {
  const add = () => onChange([...pairs, { key: '', value: '' }]);

  const update = (index: number, field: 'key' | 'value', val: string) => {
    const updated = pairs.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    onChange(updated);
  };

  const remove = (index: number) => onChange(pairs.filter((_, i) => i !== index));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {pairs.map((pair, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={pair.key}
              onChange={(e) => update(i, 'key', e.target.value)}
              placeholder={keyPlaceholder}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <input
              value={pair.value}
              onChange={(e) => update(i, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <button type="button" onClick={() => remove(i)} className="rounded p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-[#ff3b30] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
