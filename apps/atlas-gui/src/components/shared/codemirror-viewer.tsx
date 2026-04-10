'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { LanguageSupport } from '@codemirror/language';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'css'
  | 'html'
  | 'json'
  | 'markdown'
  | 'sql'
  | 'xml'
  | 'yaml'
  | 'rust'
  | 'go'
  | 'bash'
  | 'shell';

async function loadLanguage(lang: SupportedLanguage): Promise<LanguageSupport | null> {
  switch (lang) {
    case 'javascript':
      return (await import('@codemirror/lang-javascript')).javascript();
    case 'typescript':
      return (await import('@codemirror/lang-javascript')).javascript({ typescript: true });
    case 'python':
      return (await import('@codemirror/lang-python')).python();
    case 'css':
      return (await import('@codemirror/lang-css')).css();
    case 'html':
      return (await import('@codemirror/lang-html')).html();
    case 'json':
      return (await import('@codemirror/lang-json')).json();
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
    case 'sql':
      return (await import('@codemirror/lang-sql')).sql();
    case 'xml':
      return (await import('@codemirror/lang-xml')).xml();
    case 'yaml':
      return (await import('@codemirror/lang-yaml')).yaml();
    case 'rust':
      return (await import('@codemirror/lang-rust')).rust();
    case 'go':
      return (await import('@codemirror/lang-go')).go();
    case 'bash':
    case 'shell':
      return (await import('@codemirror/lang-javascript')).javascript();
    default:
      return null;
  }
}

interface CodeMirrorViewerProps {
  code: string;
  language?: SupportedLanguage;
  maxHeight?: string;
  className?: string;
}

export function CodeMirrorViewer({
  code,
  language = 'javascript',
  maxHeight = '400px',
  className,
}: CodeMirrorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    loadLanguage(language).then((langSupport) => {
      if (destroyed || !containerRef.current) return;

      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

      const extensions = [
        ...(isDark ? [oneDark] : []),
        lineNumbers(),
        EditorState.readOnly.of(true),
        EditorView.theme({
          '&': { maxHeight },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, monospace)' },
        }),
      ];

      if (langSupport) extensions.push(langSupport);

      const state = EditorState.create({ doc: code, extensions });
      viewRef.current = new EditorView({ state, parent: containerRef.current });
    });

    return () => {
      destroyed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [language, maxHeight]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === code) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: code },
    });
  }, [code]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('rounded-lg bg-[#1c1c1e] overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1c1c1e] border-b border-white/[0.08]">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
