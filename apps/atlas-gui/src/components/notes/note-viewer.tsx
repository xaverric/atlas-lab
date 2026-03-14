'use client';

import { useState, useEffect } from 'react';
import { resolveAttachmentUrls } from '@/lib/markdown';

interface NoteViewerProps {
  html: string;
}

export function NoteViewer({ html }: NoteViewerProps) {
  const [resolved, setResolved] = useState(html);

  useEffect(() => {
    let cancelled = false;
    resolveAttachmentUrls(html).then((result) => {
      if (!cancelled) setResolved(result);
    });
    return () => { cancelled = true; };
  }, [html]);

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: resolved }}
    />
  );
}
