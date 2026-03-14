'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatSize } from '@/lib/utils';

function AttachmentImageView({ node }: { node: any }) {
  const src = node.attrs.src as string;
  const isAttachment = src?.startsWith('attachment:');
  const docId = isAttachment ? src.replace('attachment:', '') : null;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docInfo, setDocInfo] = useState<{ name: string; size: number } | null>(null);

  useEffect(() => {
    if (!docId) return;
    api<{ data: { url: string } }>(`/api/v1/files/documents/${docId}/preview`)
      .then((res) => setPreviewUrl(res.data.url))
      .catch(() => {});
    api<{ data: { name: string; size: number } }>(`/api/v1/files/documents/${docId}`)
      .then((res) => setDocInfo(res.data))
      .catch(() => {});
  }, [docId]);

  if (!isAttachment) {
    return (
      <NodeViewWrapper>
        <img src={src} alt={node.attrs.alt || ''} className="max-w-full rounded" />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className="rounded-lg border overflow-hidden my-3">
        {previewUrl ? (
          <img src={previewUrl} alt={node.attrs.alt || ''} className="max-w-full" />
        ) : (
          <div className="h-40 bg-muted/50 flex items-center justify-center text-muted-foreground text-sm">
            Loading preview...
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-t text-xs">
          <span className="bg-info/20 text-info px-2 py-0.5 rounded text-[10px] font-medium">
            DMS Attachment
          </span>
          {docInfo && (
            <span className="text-muted-foreground">
              {docInfo.name} · {formatSize(docInfo.size)}
            </span>
          )}
          <a
            href={`/files/${docId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-info hover:underline"
          >
            Open in Files →
          </a>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const AttachmentImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentImageView);
  },
});
