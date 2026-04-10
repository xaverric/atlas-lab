'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  maxHeight?: string;
}

export function CodeBlock({ code, language = 'javascript', maxHeight = '300px' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg bg-[#1c1c1e] text-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08] text-xs text-[rgba(255,255,255,0.48)]">
        <span>{language}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-[rgba(255,255,255,0.48)] hover:text-white hover:bg-white/[0.06] transition-colors rounded px-1.5 py-0.5">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-auto text-sm leading-relaxed" style={{ maxHeight }}>
        <code className="font-mono text-white whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}
