'use client';

import { useState, useEffect } from 'react';
import { resolveAttachmentUrls } from '@/lib/markdown';

interface NoteViewerProps {
  html: string;
  skipAttachmentResolve?: boolean;
}

export function NoteViewer({ html, skipAttachmentResolve }: NoteViewerProps) {
  const [resolved, setResolved] = useState(html);

  useEffect(() => {
    if (skipAttachmentResolve) {
      setResolved(html);
      return;
    }
    let cancelled = false;
    resolveAttachmentUrls(html).then((result) => {
      if (!cancelled) setResolved(result);
    });
    return () => { cancelled = true; };
  }, [html, skipAttachmentResolve]);

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <div dangerouslySetInnerHTML={{ __html: resolved }} />
    </div>
  );
}
