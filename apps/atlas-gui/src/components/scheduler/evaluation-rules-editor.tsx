'use client';

import { Plus, X } from 'lucide-react';

interface EvaluationRule {
  type: string;
  value: string;
  path?: string;
}

interface EvaluationRulesEditorProps {
  rules: EvaluationRule[];
  onChange: (rules: EvaluationRule[]) => void;
}

const ruleTypes = [
  { value: 'statusEquals', label: 'Status Equals' },
  { value: 'bodyContains', label: 'Body Contains' },
  { value: 'jsonPathEquals', label: 'JSON Path Equals' },
  { value: 'jsonSchema', label: 'JSON Schema' },
];

export function EvaluationRulesEditor({ rules, onChange }: EvaluationRulesEditorProps) {
  const add = () => onChange([...rules, { type: 'statusEquals', value: '200' }]);

  const update = (index: number, field: string, val: string) => {
    const updated = rules.map((r, i) => (i === index ? { ...r, [field]: val } : r));
    onChange(updated);
  };

  const remove = (index: number) => onChange(rules.filter((_, i) => i !== index));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">Evaluation Rules</label>
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" /> Add Rule
        </button>
      </div>
      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex gap-2 items-start">
            <select
              value={rule.type}
              onChange={(e) => update(i, 'type', e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {ruleTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {(rule.type === 'jsonPathEquals') && (
              <input
                value={rule.path || ''}
                onChange={(e) => update(i, 'path', e.target.value)}
                placeholder="$.data.status"
                className="w-40 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
              />
            )}
            <input
              value={rule.value}
              onChange={(e) => update(i, 'value', e.target.value)}
              placeholder={rule.type === 'statusEquals' ? '200' : 'expected value'}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <button type="button" onClick={() => remove(i)} className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-xs text-muted-foreground">No evaluation rules. The job will succeed if the request completes without error.</p>
        )}
      </div>
    </div>
  );
}
