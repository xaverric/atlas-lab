'use client';

import { useMemo } from 'react';

interface CronBuilderProps {
  value: string;
  onChange: (value: string) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

const presets = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day 9AM', value: '0 9 * * *' },
  { label: 'Every day midnight', value: '0 0 * * *' },
  { label: 'Mon-Fri 9AM', value: '0 9 * * 1-5' },
  { label: 'Every Sunday', value: '0 0 * * 0' },
  { label: 'First of month', value: '0 0 1 * *' },
];

const timezones = [
  'UTC', 'Europe/Prague', 'Europe/London', 'America/New_York',
  'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai',
];

function describeCron(expression: string): string {
  try {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return 'Invalid expression';

    const preset = presets.find((p) => p.value === expression);
    if (preset) return preset.label;

    const [min, hour, dom, month, dow] = parts;

    if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
      return `Every ${min.slice(2)} minutes`;
    }
    if (min !== '*' && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
      return `Every ${hour.slice(2)} hours at minute ${min}`;
    }
    if (min !== '*' && hour !== '*' && dom === '*' && month === '*' && dow === '*') {
      return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    if (min !== '*' && hour !== '*' && dom === '*' && month === '*' && dow !== '*') {
      return `At ${hour.padStart(2, '0')}:${min.padStart(2, '0')} on day-of-week ${dow}`;
    }

    return `${expression}`;
  } catch {
    return 'Invalid expression';
  }
}

export function CronBuilder({ value, onChange, timezone, onTimezoneChange }: CronBuilderProps) {
  const description = useMemo(() => describeCron(value), [value]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Cron Expression</label>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="* * * * *"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
        />
        {value && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              value === preset.value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
