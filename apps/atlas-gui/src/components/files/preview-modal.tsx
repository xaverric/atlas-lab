'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, Download, ExternalLink, Code, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { FileIcon, canPreview } from './file-icon';
import { formatSize } from '@/lib/utils';
import { markdownToHtml } from '@/lib/markdown';

interface PreviewDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

interface PreviewModalProps {
  document: PreviewDocument;
  onClose: () => void;
}

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/javascript',
  'application/xml',
  'application/x-yaml',
  'application/x-sh',
  'application/x-python',
  'application/typescript',
]);

const EXTENSION_LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  css: 'css', html: 'html', htm: 'html', svg: 'xml',
  md: 'markdown', mdx: 'markdown',
  sql: 'sql', graphql: 'graphql',
  dockerfile: 'dockerfile', makefile: 'makefile',
  csv: 'csv', tsv: 'tsv',
};

function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function detectLanguage(mimeType: string, name: string): string | null {
  if (mimeType === 'application/json') return 'json';
  if (mimeType === 'application/javascript') return 'javascript';
  if (mimeType === 'application/xml' || mimeType === 'text/xml') return 'xml';
  if (mimeType === 'text/css') return 'css';
  if (mimeType === 'text/html') return 'html';
  if (mimeType === 'text/markdown') return 'markdown';
  if (mimeType === 'text/csv') return 'csv';
  if (mimeType === 'text/tab-separated-values') return 'tsv';
  const ext = getFileExtension(name);
  return EXTENSION_LANG_MAP[ext] || null;
}

function isTextLike(mimeType: string, name: string): boolean {
  if (mimeType.startsWith('text/')) return true;
  if (TEXT_MIME_TYPES.has(mimeType)) return true;
  const ext = getFileExtension(name);
  return ext in EXTENSION_LANG_MAP;
}

function isMarkdown(mimeType: string, name: string): boolean {
  if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') return true;
  const ext = getFileExtension(name);
  return ext === 'md' || ext === 'mdx';
}

function isCsv(mimeType: string, name: string): boolean {
  if (mimeType === 'text/csv' || mimeType === 'text/tab-separated-values') return true;
  const ext = getFileExtension(name);
  return ext === 'csv' || ext === 'tsv';
}

function isJson(mimeType: string): boolean {
  return mimeType === 'application/json';
}

function parseCsv(text: string, name: string): { headers: string[]; rows: string[][]; total: number } {
  const ext = getFileExtension(name);
  const separator = ext === 'tsv' ? '\t' : ',';
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const parse = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = lines.length > 0 ? parse(lines[0]) : [];
  const allRows = lines.slice(1).map(parse);
  return { headers, rows: allRows.slice(0, 100), total: allRows.length };
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function addLineNumbers(text: string): { lines: string[]; gutterWidth: number } {
  const lines = text.split('\n');
  const gutterWidth = String(lines.length).length;
  return { lines, gutterWidth };
}

export function PreviewModal({ document: doc, onClose }: PreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  const isImage = doc.mimeType.startsWith('image/');
  const isVideo = doc.mimeType.startsWith('video/');
  const isAudio = doc.mimeType.startsWith('audio/');
  const isPdf = doc.mimeType.includes('pdf');
  const isTextFile = isTextLike(doc.mimeType, doc.name);
  const isMd = isMarkdown(doc.mimeType, doc.name);
  const isCsvFile = isCsv(doc.mimeType, doc.name);
  const isJsonFile = isJson(doc.mimeType);
  const previewable = canPreview(doc.mimeType, doc.name);
  const language = detectLanguage(doc.mimeType, doc.name);
  const hasRenderedView = isMd || isCsvFile || isJsonFile;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${doc.id}/preview`);
        setPreviewUrl(res.data.url);

        if (isTextFile) {
          const textRes = await fetch(res.data.url);
          if (textRes.ok) setTextContent(await textRes.text());
        }
      } catch {
        setPreviewUrl(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [doc.id, isTextFile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${doc.id}/download`);
      window.open(res.data.url, '_blank');
    } catch { /* */ }
  };

  const renderedMarkdown = useMemo(() => {
    if (!isMd || !textContent) return '';
    return markdownToHtml(textContent);
  }, [isMd, textContent]);

  const csvData = useMemo(() => {
    if (!isCsvFile || !textContent) return null;
    return parseCsv(textContent, doc.name);
  }, [isCsvFile, textContent, doc.name]);

  const formattedJson = useMemo(() => {
    if (!isJsonFile || !textContent) return '';
    return formatJson(textContent);
  }, [isJsonFile, textContent]);

  const renderCodeBlock = (content: string) => {
    const { lines, gutterWidth } = addLineNumbers(content);
    return (
      <div className="max-h-[60dvh] sm:max-h-[70vh] overflow-auto rounded border bg-muted">
        <pre className="text-xs sm:text-sm font-mono p-0 m-0">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-muted-foreground/5">
                <span
                  className="select-none text-muted-foreground/50 text-right pr-3 pl-2 py-0 border-r border-muted-foreground/10 shrink-0"
                  style={{ minWidth: `${gutterWidth + 2}ch` }}
                >
                  {i + 1}
                </span>
                <span className="pl-3 whitespace-pre-wrap break-all">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    );
  };

  const renderTextContent = () => {
    if (textContent === null) return <NoPreview onDownload={handleDownload} mimeType={doc.mimeType} />;

    if (hasRenderedView && !showRaw) {
      if (isMd) {
        return (
          <div
            className="prose prose-sm dark:prose-invert max-w-none max-h-[60dvh] sm:max-h-[70vh] overflow-auto p-4"
            dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
          />
        );
      }

      if (isCsvFile && csvData) {
        return (
          <div className="max-h-[60dvh] sm:max-h-[70vh] overflow-auto">
            {csvData.total > 100 && (
              <p className="text-xs text-muted-foreground mb-2 px-1">
                Showing 100 of {csvData.total} rows
              </p>
            )}
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {csvData.headers.map((h, i) => (
                    <th key={i} className="border px-2 py-1.5 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-muted/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="border px-2 py-1 whitespace-nowrap max-w-[300px] truncate">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (isJsonFile) {
        return renderCodeBlock(formattedJson);
      }
    }

    const display = isJsonFile ? formattedJson : textContent;
    return renderCodeBlock(display);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative flex max-h-[95dvh] sm:max-h-[90vh] w-full sm:mx-4 sm:max-w-5xl flex-col rounded-t-xl sm:rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center py-2 sm:hidden">
          <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between border-b px-4 py-2 sm:py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon mimeType={doc.mimeType} className="shrink-0" />
            <span className="font-medium truncate text-sm sm:text-base">{doc.name}</span>
            <span className="text-xs sm:text-sm text-muted-foreground shrink-0">({formatSize(doc.size)})</span>
            {language && (
              <span className="text-xs text-muted-foreground/70 shrink-0 hidden sm:inline">{language}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isTextFile && hasRenderedView && textContent !== null && (
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-xs active:bg-muted hover:bg-muted"
                title={showRaw ? 'Show rendered' : 'Show raw'}
              >
                {showRaw ? <Eye className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{showRaw ? 'Rendered' : 'Raw'}</span>
              </button>
            )}
            <button onClick={handleDownload} className="rounded p-2 active:bg-muted" title="Download">
              <Download className="h-4 w-4" />
            </button>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="rounded p-2 active:bg-muted" title="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button onClick={onClose} className="rounded p-2 active:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex h-48 sm:h-64 items-center justify-center text-muted-foreground">
              Loading preview...
            </div>
          ) : previewable && previewUrl ? (
            isImage ? (
              <img src={previewUrl} alt={doc.name} className="mx-auto max-h-[60dvh] sm:max-h-[70vh] object-contain" />
            ) : isVideo ? (
              <video src={previewUrl} controls playsInline className="mx-auto max-h-[60dvh] sm:max-h-[70vh] w-full">
                Your browser does not support video playback.
              </video>
            ) : isAudio ? (
              <div className="flex h-48 sm:h-64 items-center justify-center">
                <audio controls className="w-full max-w-md" src={previewUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            ) : isPdf ? (
              <iframe src={previewUrl} className="h-[60dvh] sm:h-[70vh] w-full rounded border" title={doc.name} />
            ) : isTextFile ? (
              renderTextContent()
            ) : (
              <NoPreview onDownload={handleDownload} mimeType={doc.mimeType} />
            )
          ) : (
            <NoPreview onDownload={handleDownload} mimeType={doc.mimeType} />
          )}
        </div>
      </div>
    </div>
  );
}

function NoPreview({ onDownload, mimeType }: { onDownload: () => void; mimeType: string }) {
  return (
    <div className="flex h-48 sm:h-64 flex-col items-center justify-center gap-3">
      <FileIcon mimeType={mimeType} className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/50" />
      <p className="text-muted-foreground text-sm">Preview not available for this file type</p>
      <button
        onClick={onDownload}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground active:bg-primary/90"
      >
        <Download className="h-4 w-4" /> Download
      </button>
    </div>
  );
}
