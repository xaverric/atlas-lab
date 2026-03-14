'use client';

import { useEffect, useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { FileIcon, canPreview } from './file-icon';
import { formatSize } from '@/lib/utils';

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

export function PreviewModal({ document: doc, onClose }: PreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isImage = doc.mimeType.startsWith('image/');
  const isVideo = doc.mimeType.startsWith('video/');
  const isText = doc.mimeType.startsWith('text/');
  const isPdf = doc.mimeType.includes('pdf');
  const previewable = canPreview(doc.mimeType);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api<{ data: { url: string } }>(`/api/v1/dms/documents/${doc.id}/preview`);
        setPreviewUrl(res.data.url);

        if (isText) {
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
  }, [doc.id, isText]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const res = await api<{ data: { url: string } }>(`/api/v1/dms/documents/${doc.id}/download`);
      window.open(res.data.url, '_blank');
    } catch { /* */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative flex max-h-[95dvh] sm:max-h-[90vh] w-full sm:mx-4 sm:max-w-4xl flex-col rounded-t-xl sm:rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="flex justify-center py-2 sm:hidden">
          <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between border-b px-4 py-2 sm:py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon mimeType={doc.mimeType} className="shrink-0" />
            <span className="font-medium truncate text-sm sm:text-base">{doc.name}</span>
            <span className="text-xs sm:text-sm text-muted-foreground shrink-0">({formatSize(doc.size)})</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
            ) : isPdf ? (
              <iframe src={previewUrl} className="h-[60dvh] sm:h-[70vh] w-full rounded border" title={doc.name} />
            ) : isText && textContent !== null ? (
              <pre className="max-h-[60dvh] sm:max-h-[70vh] overflow-auto rounded border bg-muted p-3 sm:p-4 text-xs sm:text-sm font-mono whitespace-pre-wrap break-words">
                {textContent}
              </pre>
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
