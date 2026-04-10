'use client';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
  rows?: number;
}

export function CodeEditor({ value, onChange, placeholder, rows = 16 }: CodeEditorProps) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        className="block w-full rounded-lg bg-[#1c1c1e] text-[#f5f5f7] px-4 py-3 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <p className="text-xs text-muted-foreground">
        Available in sandbox: <code>console</code>, <code>http.fetch(url, opts)</code>, <code>storage.get/set/remove</code>, <code>env</code>, <code>jobId</code>, <code>runId</code>
      </p>
    </div>
  );
}
