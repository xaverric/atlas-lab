'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload, FolderPlus, RefreshCw, Info, Pencil, Globe, Lock, Trash2, Folder,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadFile } from '@/lib/api';
import { formatSize } from '@/lib/utils';
import { TreeSidebar } from '@/components/shared/tree-sidebar';
import type { TreeItem } from '@/components/shared/tree-sidebar';
import { VisibilityBadge } from '@/components/shared/visibility-badge';
import { DocumentTable } from '@/components/files/document-table';
import type { DocumentItem } from '@/components/files/document-table';
import { EmptyState } from '@/components/files/empty-state';
import { BulkActionsBar } from '@/components/files/bulk-actions-bar';
import { PreviewModal } from '@/components/files/preview-modal';
import { RenameDialog } from '@/components/files/rename-dialog';
import { MoveDialog } from '@/components/files/move-dialog';
import { FolderInfoPanel } from '@/components/files/folder-info-panel';
import { SearchBar } from '@/components/files/search-bar';
import { BreadcrumbNav } from '@/components/files/breadcrumb-nav';
import { UploadModal } from '@/components/files/upload-modal';

interface FolderItem {
  id: string;
  name: string;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
}

interface FolderMetadata {
  id: string;
  name: string;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
  docCount: number;
  subfolderCount: number;
  totalSize: number;
  createdAt: string;
}

interface ListResponse {
  data: DocumentItem[];
  total: number;
  page: number;
  limit: number;
}

export default function FilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId') || null;

  const [treeKey, setTreeKey] = useState(0);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [folderMeta, setFolderMeta] = useState<FolderMetadata | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [moveDoc, setMoveDoc] = useState<DocumentItem | null>(null);
  const [infoFolderId, setInfoFolderId] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [showUpload, setShowUpload] = useState(false);

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
      const res = await api<{ data: FolderItem[] }>(`/api/v1/files/folders${q}`);
      setFolders(res.data);
    } catch {
      toast.error('Failed to load folders');
    }
  }, [folderId]);

  const loadFolderMeta = useCallback(async () => {
    if (!folderId) { setFolderMeta(null); setBreadcrumb([]); return; }
    try {
      const [metaRes, detailRes] = await Promise.all([
        api<{ data: FolderMetadata }>(`/api/v1/files/folders/${folderId}/metadata`),
        api<{ data: { breadcrumb: { id: string; name: string }[] } }>(`/api/v1/files/folders/${folderId}`),
      ]);
      setFolderMeta(metaRes.data);
      setBreadcrumb(detailRes.data.breadcrumb);
    } catch { setFolderMeta(null); setBreadcrumb([]); }
  }, [folderId]);

  const loadDocs = useCallback(async (p: number) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', '20');
      if (folderId) params.set('folderId', folderId);
      else params.set('folderId', '');
      if (filters.search) params.set('search', filters.search);
      if (filters.mimeType) params.set('mimeType', filters.mimeType);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.tags.length) params.set('tags', filters.tags.join(','));
      if (sort.field) params.set('sortBy', sort.field);
      params.set('sortOrder', sort.order);

      const res = await api<ListResponse>(`/api/v1/files/documents?${params}`);
      setDocs(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast.error('Failed to load documents');
    }
  }, [folderId, filters, sort]);

  const loadTags = useCallback(async () => {
    try {
      const res = await api<{ data: string[] }>('/api/v1/files/documents/tags');
      setAvailableTags(res.data);
    } catch { /* */ }
  }, []);

  const loadTreeChildren = useCallback(async (parentId: string | null): Promise<TreeItem[]> => {
    const folderQ = parentId ? `?parentId=${parentId}` : '';
    const docParams = new URLSearchParams({ limit: '100', folderId: parentId ?? '' });

    const [foldersRes, docsRes] = await Promise.all([
      api<{ data: FolderItem[] }>(`/api/v1/files/folders${folderQ}`),
      api<ListResponse>(`/api/v1/files/documents?${docParams}`),
    ]);

    const folderItems: TreeItem[] = foldersRes.data.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'folder' as const,
      isPublic: f.isPublic,
      publicPermission: f.publicPermission,
    }));

    const docItems: TreeItem[] = docsRes.data.map((d) => ({
      id: d.id,
      name: d.name,
      type: 'item' as const,
      size: d.size,
    }));

    return [...folderItems, ...docItems];
  }, []);

  const reload = useCallback(() => {
    loadFolders();
    loadFolderMeta();
    loadDocs(page);
  }, [loadFolders, loadFolderMeta, loadDocs, page]);

  const refreshAll = useCallback(() => {
    setTreeKey((k) => k + 1);
    reload();
  }, [reload]);

  useEffect(() => {
    loadFolders();
    loadFolderMeta();
    loadTags();
  }, [loadFolders, loadFolderMeta, loadTags]);

  useEffect(() => {
    loadDocs(1);
    setSelectedIds(new Set());
  }, [loadDocs]);

  // drag-and-drop upload
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
        await uploadFile('/api/v1/files/documents', formData);
        uploaded++;
      } catch { /* continue */ }
    }
    if (uploaded > 0) {
      toast.success(`${uploaded} file(s) uploaded`);
      loadDocs(page);
      loadTags();
      setTreeKey((k) => k + 1);
    }
    if (uploaded < files.length) {
      toast.error(`${files.length - uploaded} file(s) failed`);
    }
  };

  const navigateToFolder = (id: string | null) => {
    const params = new URLSearchParams();
    if (id) params.set('folderId', id);
    router.push(`/files${params.toString() ? `?${params}` : ''}`);
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
      await api(`/api/v1/files/documents/${id}`, { method: 'DELETE' });
      toast.success('Document deleted');
      loadDocs(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to delete'); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} document(s)?`)) return;
    try {
      await api('/api/v1/files/documents/bulk-delete', {
        method: 'POST', body: JSON.stringify({ ids: [...selectedIds] }),
      });
      toast.success(`${selectedIds.size} document(s) deleted`);
      setSelectedIds(new Set());
      loadDocs(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to delete'); }
  };

  const handleBulkMove = async (targetFolderId: string | null) => {
    try {
      await api('/api/v1/files/documents/bulk-move', {
        method: 'POST', body: JSON.stringify({ ids: [...selectedIds], folderId: targetFolderId }),
      });
      toast.success(`${selectedIds.size} document(s) moved`);
      setSelectedIds(new Set());
      loadDocs(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to move'); }
  };

  const handleRename = async (doc: DocumentItem, name: string) => {
    try {
      await api(`/api/v1/files/documents/${doc.id}`, {
        method: 'PATCH', body: JSON.stringify({ name }),
      });
      toast.success('Renamed');
      loadDocs(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to rename'); }
  };

  const handleMove = async (doc: DocumentItem, targetFolderId: string | null) => {
    try {
      await api(`/api/v1/files/documents/${doc.id}`, {
        method: 'PATCH', body: JSON.stringify({ folderId: targetFolderId }),
      });
      toast.success('Moved');
      loadDocs(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to move'); }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      await api('/api/v1/files/folders', {
        method: 'POST', body: JSON.stringify({ name: trimmed, parentId: folderId }),
      });
      toast.success('Folder created');
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolders();
      setTreeKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleToggleFolderPublic = async (id: string, isPublic: boolean) => {
    try {
      await api(`/api/v1/files/folders/${id}/public`, {
        method: 'PATCH', body: JSON.stringify({ isPublic }),
      });
      toast.success(isPublic ? 'Folder is now public' : 'Folder is now private');
      loadFolders();
      loadFolderMeta();
      setTreeKey((k) => k + 1);
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api(`/api/v1/files/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      loadFolders();
      loadFolderMeta();
      setTreeKey((k) => k + 1);
      setRenamingFolder(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Delete this folder? It must be empty.')) return;
    try {
      await api(`/api/v1/files/folders/${id}`, { method: 'DELETE' });
      toast.success('Folder deleted');
      loadFolders();
      setTreeKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  const hasContent = folders.length > 0 || docs.length > 0;
  const hasFilters = filters.search || filters.mimeType || filters.dateFrom || filters.dateTo || filters.tags.length > 0;
  const showPath = !!(hasFilters && !folderId);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <TreeSidebar
        key={treeKey}
        storageKey="files"
        selectedFolderId={folderId}
        onSelectFolder={navigateToFolder}
        onSelectItem={(id) => router.push(`/files/${id}`)}
        loadChildren={loadTreeChildren}
        title="Files"
      />

      <div
        className="flex-1 flex flex-col overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragging && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <div className="rounded-lg bg-background px-8 py-6 shadow-lg text-center">
              <Upload className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="text-lg font-medium">Drop files to upload</p>
              <p className="text-sm text-muted-foreground">
                to {folderMeta?.name || 'root'}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-lg font-semibold tracking-tight truncate">
                {folderMeta?.name || 'File Storage'}
              </h1>
              {folderMeta && (
                <VisibilityBadge
                  isPublic={folderMeta.isPublic ?? false}
                  permission={folderMeta.publicPermission}
                  size="md"
                />
              )}
              {folderMeta && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {folderMeta.docCount} files · {folderMeta.subfolderCount} folders · {formatSize(folderMeta.totalSize)}
                </span>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {folderId && (
                <button
                  onClick={() => setInfoFolderId(folderId)}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-sm active:bg-muted"
                  title="Folder settings"
                >
                  <Info className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={refreshAll}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-sm active:bg-muted"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-medium active:bg-muted"
              >
                <FolderPlus className="h-4 w-4" />
                <span className="hidden sm:inline">New Folder</span>
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 rounded-md bg-primary px-3 sm:px-4 py-2 text-sm font-medium text-primary-foreground active:bg-primary/90"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="shrink-0 border-b px-4 py-1.5">
            <BreadcrumbNav items={breadcrumb} onNavigate={navigateToFolder} />
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

          {/* Folder rows */}
          {folders.length > 0 && (
            <div className="rounded-lg border divide-y">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigateToFolder(folder.id)}
                >
                  <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                  {renamingFolder === folder.id ? (
                    <input
                      value={renameFolderName}
                      onChange={(e) => setRenameFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleRenameFolder(folder.id, renameFolderName);
                        if (e.key === 'Escape') setRenamingFolder(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border border-input bg-background px-2 py-0.5 text-sm flex-1 min-w-0"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm truncate flex-1 min-w-0">{folder.name}</span>
                  )}
                  {folder.isPublic && (
                    <VisibilityBadge isPublic showLabel={false} />
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setInfoFolderId(folder.id)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                      title="Info"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { setRenamingFolder(folder.id); setRenameFolderName(folder.name); }}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                      title="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleFolderPublic(folder.id, !folder.isPublic)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                      title={folder.isPublic ? 'Make private' : 'Make public'}
                    >
                      {folder.isPublic ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
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
                view="list"
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
        </div>
      </div>

      {/* Modals */}
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

      {infoFolderId && (
        <FolderInfoPanel
          folderId={infoFolderId}
          onClose={() => setInfoFolderId(null)}
        />
      )}

      {showUpload && (
        <UploadModal
          folderId={folderId}
          onClose={() => setShowUpload(false)}
          onComplete={() => {
            setShowUpload(false);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
