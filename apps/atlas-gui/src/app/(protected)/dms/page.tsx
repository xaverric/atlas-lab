'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Upload, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadFile } from '@/lib/api';
import { BreadcrumbNav } from '@/components/dms/breadcrumb-nav';
import { SearchBar } from '@/components/dms/search-bar';
import { FolderCard } from '@/components/dms/folder-card';
import { DocumentTable } from '@/components/dms/document-table';
import type { DocumentItem } from '@/components/dms/document-table';
import { EmptyState } from '@/components/dms/empty-state';
import { BulkActionsBar } from '@/components/dms/bulk-actions-bar';
import { PreviewModal } from '@/components/dms/preview-modal';
import { RenameDialog } from '@/components/dms/rename-dialog';
import { MoveDialog } from '@/components/dms/move-dialog';

interface FolderItem {
  id: string;
  name: string;
}

interface FolderDetail extends FolderItem {
  breadcrumb: { id: string; name: string }[];
}

interface ListResponse {
  data: DocumentItem[];
  total: number;
  page: number;
  limit: number;
}

export default function DmsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId') || null;

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [moveDoc, setMoveDoc] = useState<DocumentItem | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    mimeType: '',
    dateFrom: '',
    dateTo: '',
    tags: [] as string[],
  });

  const [sort, setSort] = useState({ field: 'createdAt', order: 'desc' as 'asc' | 'desc' });

  const loadFolders = useCallback(async () => {
    try {
      const q = folderId ? `?parentId=${folderId}` : '';
      const res = await api<{ data: FolderItem[] }>(`/api/v1/dms/folders${q}`);
      setFolders(res.data);
    } catch {
      toast.error('Failed to load folders');
    }
  }, [folderId]);

  const loadBreadcrumb = useCallback(async () => {
    if (!folderId) { setBreadcrumb([]); return; }
    try {
      const res = await api<{ data: FolderDetail }>(`/api/v1/dms/folders/${folderId}`);
      setBreadcrumb(res.data.breadcrumb);
    } catch { setBreadcrumb([]); }
  }, [folderId]);

  const loadDocs = useCallback(async (p: number) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', '20');
      if (folderId) params.set('folderId', folderId);
      if (filters.search) params.set('search', filters.search);
      if (filters.mimeType) params.set('mimeType', filters.mimeType);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.tags.length) params.set('tags', filters.tags.join(','));
      if (sort.field) params.set('sortBy', sort.field);
      params.set('sortOrder', sort.order);

      const res = await api<ListResponse>(`/api/v1/dms/documents?${params}`);
      setDocs(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast.error('Failed to load documents');
    }
  }, [folderId, filters, sort]);

  const loadTags = useCallback(async () => {
    try {
      const res = await api<{ data: string[] }>('/api/v1/dms/documents/tags');
      setAvailableTags(res.data);
    } catch { /* */ }
  }, []);

  const reload = useCallback(() => {
    loadFolders();
    loadDocs(page);
  }, [loadFolders, loadDocs, page]);

  useEffect(() => {
    loadFolders();
    loadBreadcrumb();
    loadTags();
  }, [loadFolders, loadBreadcrumb, loadTags]);

  useEffect(() => {
    loadDocs(1);
    setSelectedIds(new Set());
  }, [loadDocs]);

  // --- drag-and-drop upload on the page ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    let uploaded = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        if (folderId) formData.append('folderId', folderId);
        await uploadFile('/api/v1/dms/documents', formData);
        uploaded++;
      } catch { /* continue with next */ }
    }
    if (uploaded > 0) {
      toast.success(`${uploaded} file(s) uploaded`);
      loadDocs(page);
      loadTags();
    }
    if (uploaded < files.length) {
      toast.error(`${files.length - uploaded} file(s) failed`);
    }
  };

  const navigateToFolder = (id: string | null) => {
    const params = new URLSearchParams();
    if (id) params.set('folderId', id);
    router.push(`/dms${params.toString() ? `?${params}` : ''}`);
  };

  const handleSort = (field: string) => {
    setSort((prev) =>
      prev.field === field
        ? { field, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { field, order: 'asc' },
    );
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (docs.every((d) => selectedIds.has(d.id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(docs.map((d) => d.id)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api(`/api/v1/dms/documents/${id}`, { method: 'DELETE' });
      toast.success('Document deleted');
      loadDocs(page);
    } catch { toast.error('Failed to delete'); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} document(s)?`)) return;
    try {
      await api('/api/v1/dms/documents/bulk-delete', {
        method: 'POST', body: JSON.stringify({ ids: [...selectedIds] }),
      });
      toast.success(`${selectedIds.size} document(s) deleted`);
      setSelectedIds(new Set());
      loadDocs(page);
    } catch { toast.error('Failed to delete'); }
  };

  const handleBulkMove = async (targetFolderId: string | null) => {
    try {
      await api('/api/v1/dms/documents/bulk-move', {
        method: 'POST', body: JSON.stringify({ ids: [...selectedIds], folderId: targetFolderId }),
      });
      toast.success(`${selectedIds.size} document(s) moved`);
      setSelectedIds(new Set());
      loadDocs(page);
    } catch { toast.error('Failed to move'); }
  };

  const handleRename = async (doc: DocumentItem, name: string) => {
    try {
      await api(`/api/v1/dms/documents/${doc.id}`, {
        method: 'PATCH', body: JSON.stringify({ name }),
      });
      toast.success('Renamed');
      loadDocs(page);
    } catch { toast.error('Failed to rename'); }
  };

  const handleMove = async (doc: DocumentItem, targetFolderId: string | null) => {
    try {
      await api(`/api/v1/dms/documents/${doc.id}`, {
        method: 'PATCH', body: JSON.stringify({ folderId: targetFolderId }),
      });
      toast.success('Moved');
      loadDocs(page);
    } catch { toast.error('Failed to move'); }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      await api('/api/v1/dms/folders', {
        method: 'POST', body: JSON.stringify({ name: trimmed, parentId: folderId }),
      });
      toast.success('Folder created');
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api(`/api/v1/dms/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      loadFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Delete this folder? It must be empty.')) return;
    try {
      await api(`/api/v1/dms/folders/${id}`, { method: 'DELETE' });
      toast.success('Folder deleted');
      loadFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  const hasContent = folders.length > 0 || docs.length > 0;
  const hasFilters = filters.search || filters.mimeType || filters.dateFrom || filters.dateTo || filters.tags.length > 0;
  const showPath = !!(hasFilters && !folderId);

  // build display path from breadcrumb for current folder
  const currentPath = breadcrumb.length > 0
    ? '/' + breadcrumb.map((b) => b.name).join('/')
    : '/';

  return (
    <div
      className="space-y-4 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="rounded-lg bg-background px-8 py-6 shadow-lg text-center">
            <Upload className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="text-lg font-medium">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">to {currentPath}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Documents</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-medium active:bg-muted"
          >
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Folder</span>
          </button>
          <Link
            href={`/dms/upload${folderId ? `?folderId=${folderId}` : ''}`}
            className="flex items-center gap-2 rounded-md bg-primary px-3 sm:px-4 py-2 text-sm font-medium text-primary-foreground active:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </Link>
        </div>
      </div>

      <BreadcrumbNav items={breadcrumb} onNavigate={navigateToFolder} />

      <SearchBar
        filters={filters}
        onChange={setFilters}
        availableTags={availableTags}
      />

      {showNewFolder && (
        <div className="flex gap-2 items-center">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            placeholder="Folder name"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <button onClick={handleCreateFolder} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
            Create
          </button>
          <button onClick={() => setShowNewFolder(false)} className="rounded-md border px-3 py-2 text-sm">
            Cancel
          </button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          onDelete={handleBulkDelete}
          onMove={handleBulkMove}
          onClear={() => setSelectedIds(new Set())}
          currentFolderId={folderId}
        />
      )}

      {folders.length > 0 && (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onClick={() => navigateToFolder(folder.id)}
              onRename={(name) => handleRenameFolder(folder.id, name)}
              onDelete={() => handleDeleteFolder(folder.id)}
            />
          ))}
        </div>
      )}

      {docs.length > 0 ? (
        <>
          <DocumentTable
            documents={docs}
            sort={sort}
            onSort={handleSort}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onDelete={handleDelete}
            onPreview={setPreviewDoc}
            onRename={setRenameDoc}
            onMove={setMoveDoc}
            showPath={showPath}
          />
          {total > 20 && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => loadDocs(page - 1)}
                disabled={page <= 1}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-muted-foreground">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => loadDocs(page + 1)}
                disabled={page * 20 >= total}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        !hasContent && !hasFilters && <EmptyState preset={folderId ? 'empty-folder' : 'no-documents'} />
      )}

      {!hasContent && hasFilters && <EmptyState preset="no-results" />}

      {previewDoc && (
        <PreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      {renameDoc && (
        <RenameDialog
          currentName={renameDoc.name}
          onConfirm={(name) => handleRename(renameDoc, name)}
          onClose={() => setRenameDoc(null)}
        />
      )}

      {moveDoc && (
        <MoveDialog
          documentName={moveDoc.name}
          currentFolderId={moveDoc.folderId ?? null}
          onConfirm={(targetId) => handleMove(moveDoc, targetId)}
          onClose={() => setMoveDoc(null)}
        />
      )}
    </div>
  );
}
