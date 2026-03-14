'use client';

import { useEffect, useRef } from 'react';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { LanguageSupport } from '@codemirror/language';
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

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: SupportedLanguage;
  minHeight?: string;
  className?: string;
}

export function CodeMirrorEditor({
  value,
  onChange,
  language = 'markdown',
  minHeight = '300px',
  className,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    loadLanguage(language).then((langSupport) => {
      if (destroyed || !containerRef.current) return;

      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const extensions = [
        oneDark,
        lineNumbers(),
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.theme({
          '&': { minHeight },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, monospace)' },
          '.cm-content': { minHeight },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ];

      if (langSupport) extensions.push(langSupport);

      const state = EditorState.create({ doc: value, extensions });
      viewRef.current = new EditorView({ state, parent: containerRef.current });
    });

    return () => {
      destroyed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [language, minHeight]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div
      className={cn('rounded-md border border-zinc-700 overflow-hidden', className)}
      ref={containerRef}
    />
  );
}
