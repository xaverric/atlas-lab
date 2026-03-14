'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Download, Eye, MoreVertical } from 'lucide-react';
import { FileIcon, canPreview } from './file-icon';
import { ContextMenu } from './context-menu';
import { cn, formatSize, formatDate } from '@/lib/utils';
import { api } from '@/lib/api';

export interface DocumentItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  tags: string[];
  createdAt: string;
  folderId?: string | null;
  folderPath?: string;
}

interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

interface ContextMenuState {
  doc: DocumentItem;
  x: number;
  y: number;
}

import type { ViewMode } from '@/components/shared/view-toggle';

interface DocumentTableProps {
  documents: DocumentItem[];
  sort: SortConfig;
  onSort: (field: string) => void;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onDelete: (id: string) => void;
  onPreview: (doc: DocumentItem) => void;
  onRename: (doc: DocumentItem) => void;
  onMove: (doc: DocumentItem) => void;
  onDetails?: (doc: DocumentItem) => void;
  showPath?: boolean;
  view?: ViewMode;
}

function SortIcon({ field, sort }: { field: string; sort: SortConfig }) {
  if (sort.field !== field) return null;
  return sort.order === 'asc'
    ? <ArrowUp className="inline h-3 w-3 ml-1" />
    : <ArrowDown className="inline h-3 w-3 ml-1" />;
}

export function DocumentTable({
  documents, sort, onSort, selectedIds, onSelect, onSelectAll,
  onDelete, onPreview, onRename, onMove, onDetails, showPath, view = 'list',
}: DocumentTableProps) {
  const router = useRouter();
  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id));
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const handleContextMenu = (e: React.MouseEvent, doc: DocumentItem) => {
    e.preventDefault();
    setCtxMenu({ doc, x: e.clientX, y: e.clientY });
  };

  const openContextMenu = useCallback((doc: DocumentItem, x: number, y: number) => {
    setCtxMenu({ doc, x, y });
  }, []);

  const handleTouchStart = useCallback((doc: DocumentItem, e: React.TouchEvent) => {
    longPressTriggered.current = false;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      openContextMenu(doc, x, y);
    }, 500);
  }, [openContextMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const res = await api<{ data: { url: string } }>(`/api/v1/files/documents/${doc.id}/download`);
      window.open(res.data.url, '_blank');
    } catch { /* */ }
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    ...(showPath ? [{ key: 'path', label: 'Path', sortable: false }] : []),
    { key: 'mimeType', label: 'Type', sortable: true },
    { key: 'size', label: 'Size', sortable: true },
    { key: 'tags', label: 'Tags', sortable: false },
    { key: 'createdAt', label: 'Uploaded', sortable: true },
  ];

  if (view === 'grid') {
    return (
      <>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
              onContextMenu={(e) => handleContextMenu(e, doc)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(doc.id)}
                  onChange={() => onSelect(doc.id)}
                  className="mt-1 rounded border-input shrink-0"
                />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onDetails ? onDetails(doc) : router.push(`/files/${doc.id}`)}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileIcon mimeType={doc.mimeType} className="text-muted-foreground shrink-0" />
                    <span className="truncate text-sm font-medium">{doc.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(doc.size)} · {doc.mimeType.split('/').pop()}
                  </p>
                  {doc.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {doc.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{tag}</span>
                      ))}
                      {doc.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 3}</span>}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canPreview(doc.mimeType, doc.name) && (
                    <button onClick={() => onPreview(doc)} className="text-muted-foreground hover:text-foreground p-1 transition-colors"><Eye className="h-4 w-4" /></button>
                  )}
                  <button onClick={() => handleDownload(doc)} className="text-muted-foreground hover:text-foreground p-1 transition-colors"><Download className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {ctxMenu && (
          <ContextMenu x={ctxMenu.x} y={ctxMenu.y} mimeType={ctxMenu.doc.mimeType} onClose={() => setCtxMenu(null)}
            onPreview={() => onPreview(ctxMenu.doc)} onDownload={() => handleDownload(ctxMenu.doc)}
            onRename={() => onRename(ctxMenu.doc)} onMove={() => onMove(ctxMenu.doc)}
            onDetails={() => onDetails ? onDetails(ctxMenu.doc) : router.push(`/files/${ctxMenu.doc.id}`)} onDelete={() => onDelete(ctxMenu.doc.id)} />
        )}
      </>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="rounded border-input"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('p-3 whitespace-nowrap', col.sortable && 'cursor-pointer select-none hover:text-foreground')}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  {col.label}
                  {col.sortable && <SortIcon field={col.key} sort={sort} />}
                </th>
              ))}
              <th className="p-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                onContextMenu={(e) => handleContextMenu(e, doc)}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => onSelect(doc.id)}
                    className="rounded border-input"
                  />
                </td>
                <td className="p-3">
                  <button onClick={() => onDetails ? onDetails(doc) : router.push(`/files/${doc.id}`)} className="flex items-center gap-2 hover:underline text-left">
                    <FileIcon mimeType={doc.mimeType} className="text-muted-foreground shrink-0" />
                    <span className="truncate max-w-xs">{doc.name}</span>
                  </button>
                </td>
                {showPath && (
                  <td className="p-3 text-sm text-muted-foreground">
                    <span className="truncate max-w-[200px] inline-block">{doc.folderPath || '/'}</span>
                  </td>
                )}
                <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{doc.mimeType.split('/').pop()}</td>
                <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{formatSize(doc.size)}</td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {doc.tags.map((tag) => (
                      <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(doc.createdAt)}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {canPreview(doc.mimeType, doc.name) && (
                      <button onClick={() => onPreview(doc)} className="text-muted-foreground hover:text-foreground p-1 transition-colors" title="Preview">
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => handleDownload(doc)} className="text-muted-foreground hover:text-foreground p-1 transition-colors" title="Download">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="rounded border-input"
          />
          <span className="text-xs text-muted-foreground">Select all</span>
          <div className="ml-auto flex gap-2">
            {[
              { key: 'name', label: 'Name' },
              { key: 'size', label: 'Size' },
              { key: 'createdAt', label: 'Date' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => onSort(s.key)}
                className={cn(
                  'text-xs px-2 py-1 rounded border transition-colors',
                  sort.field === s.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
                {sort.field === s.key && (sort.order === 'asc' ? ' ^' : ' v')}
              </button>
            ))}
          </div>
        </div>

        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 active:bg-muted/50 transition-colors"
            onContextMenu={(e) => handleContextMenu(e, doc)}
            onTouchStart={(e) => handleTouchStart(doc, e)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(doc.id)}
              onChange={() => onSelect(doc.id)}
              className="rounded border-input shrink-0"
            />
            <div className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer" onClick={() => onDetails ? onDetails(doc) : router.push(`/files/${doc.id}`)}>
              <FileIcon mimeType={doc.mimeType} className="text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(doc.size)} · {formatDate(doc.createdAt)}
                </p>
                {showPath && doc.folderPath && (
                  <p className="truncate text-xs text-muted-foreground">{doc.folderPath}</p>
                )}
                {doc.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {doc.tags.map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                openContextMenu(doc, rect.left, rect.bottom);
              }}
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-foreground active:bg-muted transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          mimeType={ctxMenu.doc.mimeType}
          onClose={() => setCtxMenu(null)}
          onPreview={() => onPreview(ctxMenu.doc)}
          onDownload={() => handleDownload(ctxMenu.doc)}
          onRename={() => onRename(ctxMenu.doc)}
          onMove={() => onMove(ctxMenu.doc)}
          onDetails={() => onDetails ? onDetails(ctxMenu.doc) : router.push(`/files/${ctxMenu.doc.id}`)}
          onDelete={() => onDelete(ctxMenu.doc.id)}
        />
      )}
    </>
  );
}
