'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload, FolderPlus, RefreshCw, Info, Globe, Lock, Folder, Eye,
  Pencil, Trash2, ChevronRight, Home, ArrowUp, ArrowDown, Download,
  FolderInput, Link2,
} from 'lucide-react';
import { Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadFile } from '@/lib/api';
import { formatSize, formatDate } from '@/lib/utils';
import { DocumentTable } from '@/components/files/document-table';
import type { DocumentItem } from '@/components/files/document-table';
import { EmptyState } from '@/components/files/empty-state';
import { BulkActionsBar } from '@/components/files/bulk-actions-bar';
import { PreviewModal } from '@/components/files/preview-modal';
import { RenameDialog } from '@/components/files/rename-dialog';
import { MoveDialog } from '@/components/files/move-dialog';
import { SearchBar } from '@/components/files/search-bar';
import { UploadModal } from '@/components/files/upload-modal';
import { DetailModal } from '@/components/files/detail-modal';
import { FileItemInfoModal } from '@/components/files/item-info-modal';
import { NoteContextMenu } from '@/components/notes/context-menu';

interface FolderItem {
  id: string;
  name: string;
  isPublic?: boolean;
  effectivePublic?: boolean;
  publicInherited?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
  docCount?: number;
  totalSize?: number;
}

interface FolderDetail extends FolderItem {
  breadcrumb: { id: string; name: string }[];
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

interface InfoModalState {
  type: 'folder' | 'document';
  id: string;
}

export default function FilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId') || null;
  const docId = searchParams.get('docId') || null;

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [currentFolder, setCurrentFolder] = useState<FolderDetail | null>(null);
  const [folderMeta, setFolderMeta] = useState<FolderMetadata | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [moveDoc, setMoveDoc] = useState<DocumentItem | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [detailDocId, setDetailDocId] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<InfoModalState | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: { icon: any; label: string; action: () => void; destructive?: boolean }[] } | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    mimeType: '',
    dateFrom: '',
    dateTo: '',
    tags: [] as string[],
  });

  const [sort, setSort] = useState({ field: 'createdAt', order: 'desc' as 'asc' | 'desc' });

  const loadFolderDetail = useCallback(async () => {
    if (!folderId) { setCurrentFolder(null); return; }
    try {
      const res = await api<{ data: FolderDetail }>(`/api/v1/files/folders/${folderId}`);
      setCurrentFolder(res.data);
    } catch { setCurrentFolder(null); }
  }, [folderId]);

  const loadFolderMeta = useCallback(async () => {
    if (!folderId) { setFolderMeta(null); return; }
    try {
      const res = await api<{ data: FolderMetadata }>(`/api/v1/files/folders/${folderId}/metadata`);
      setFolderMeta(res.data);
    } catch { setFolderMeta(null); }
  }, [folderId]);

  const loadFolders = useCallback(async () => {
    try {
      const q = folderId ? `?parentId=${folderId}` : '';
      const res = await api<{ data: FolderItem[] }>(`/api/v1/files/folders${q}`);
      setFolders(res.data);
    } catch {
      toast.error('Failed to load folders');
    }
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

  const reload = useCallback(() => {
    loadFolders();
    loadFolderMeta();
    loadFolderDetail();
    loadDocs(page);
  }, [loadFolders, loadFolderMeta, loadFolderDetail, loadDocs, page]);

  useEffect(() => {
    loadFolderDetail();
    loadFolderMeta();
    loadFolders();
    loadTags();
  }, [loadFolderDetail, loadFolderMeta, loadFolders, loadTags]);

  useEffect(() => {
    loadDocs(1);
    setSelectedIds(new Set());
  }, [loadDocs]);

  useEffect(() => {
    if (docId && !detailDocId) setDetailDocId(docId);
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const closeDetail = () => {
    setDetailDocId(null);
    if (docId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('docId');
      router.replace(`/files${params.toString() ? `?${params}` : ''}`);
    }
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
    } catch { toast.error('Failed to move'); }
  };

  const handleRename = async (doc: DocumentItem, name: string) => {
    try {
      await api(`/api/v1/files/documents/${doc.id}`, {
        method: 'PATCH', body: JSON.stringify({ name }),
      });
      toast.success('Renamed');
      loadDocs(page);
    } catch { toast.error('Failed to rename'); }
  };

  const handleMove = async (doc: DocumentItem, targetFolderId: string | null) => {
    try {
      await api(`/api/v1/files/documents/${doc.id}`, {
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
      await api('/api/v1/files/folders', {
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

  const handleToggleFolderPublic = async (id: string, makePublic: boolean) => {
    try {
      await api(`/api/v1/files/folders/${id}/public`, {
        method: 'PATCH', body: JSON.stringify({ isPublic: makePublic }),
      });
      toast.success(makePublic ? 'Folder is now public' : 'Folder is now private');
      loadFolders();
      loadFolderMeta();
      if (id === folderId) loadFolderDetail();
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const handleFolderPermission = async (id: string, perm: string) => {
    try {
      await api(`/api/v1/files/folders/${id}/public`, {
        method: 'PATCH', body: JSON.stringify({ isPublic: true, publicPermission: perm }),
      });
      loadFolders();
      loadFolderMeta();
      if (id === folderId) loadFolderDetail();
    } catch { toast.error('Failed to update permission'); }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api(`/api/v1/files/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      loadFolders();
      if (id === folderId) loadFolderDetail();
    } catch { toast.error('Failed to rename folder'); }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api(`/api/v1/files/folders/${id}`, { method: 'DELETE' });
      loadFolders();
      if (id === folderId) router.push('/files');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete folder'); }
  };

  const copyFolderLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/public/files/${id}`);
    toast.success('Public link copied');
  };

  const openFolderMenu = (e: React.MouseEvent, folder: FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    const isFolderPublic = folder.isPublic ?? false;
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: Eye, label: 'Open', action: () => navigateToFolder(folder.id) },
        { icon: Pencil, label: 'Rename', action: () => { const name = prompt('Rename folder:', folder.name); if (name?.trim()) handleRenameFolder(folder.id, name.trim()); } },
        { icon: isFolderPublic ? Lock : Globe, label: isFolderPublic ? 'Make Private' : 'Make Public', action: () => handleToggleFolderPublic(folder.id, !isFolderPublic) },
        ...(isFolderPublic ? [{ icon: LinkIcon, label: 'Copy Public Link', action: () => copyFolderLink(folder.id) }] : []),
        { icon: Info, label: 'Info', action: () => setInfoModal({ type: 'folder', id: folder.id }) },
        { icon: FolderInput, label: 'Move to...', action: () => { const target = prompt('Move to folder ID (or empty for root):'); if (target !== null) { api(`/api/v1/files/folders/${folder.id}`, { method: 'PATCH', body: JSON.stringify({ parentId: target || null }) }).then(() => { toast.success('Moved'); loadFolders(); }).catch(() => toast.error('Failed to move')); } } },
        { icon: Trash2, label: 'Delete', action: () => handleDeleteFolder(folder.id), destructive: true },
      ],
    });
  };

  const openDocMenu = (e: React.MouseEvent, doc: DocumentItem) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: Eye, label: 'Preview', action: () => setPreviewDoc(doc) },
        { icon: Download, label: 'Download', action: () => { api<{ data: { url: string } }>(`/api/v1/files/documents/${doc.id}/download`).then((res) => window.open(res.data.url, '_blank')).catch(() => {}); } },
        { icon: Pencil, label: 'Rename', action: () => setRenameDoc(doc) },
        { icon: FolderInput, label: 'Move to...', action: () => setMoveDoc(doc) },
        { icon: Info, label: 'Info', action: () => setInfoModal({ type: 'document', id: doc.id }) },
        { icon: Trash2, label: 'Delete', action: () => handleDelete(doc.id), destructive: true },
      ],
    });
  };

  const hasContent = folders.length > 0 || docs.length > 0;
  const hasFilters = filters.search || filters.mimeType || filters.dateFrom || filters.dateTo || filters.tags.length > 0;
  const totalPages = Math.ceil(total / 20);
  const folderIsPublic = (currentFolder as any)?.effectivePublic ?? currentFolder?.isPublic ?? false;
  const folderPublicInherited = (currentFolder as any)?.publicInherited ?? false;

  const bc = currentFolder?.breadcrumb || [];
  const parentCrumbs = bc.slice(0, -1);
  const currentCrumb = bc.length > 0 ? bc[bc.length - 1] : null;

  return (
    <div
      className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
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

      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-2.5 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <nav className="flex items-center gap-1 text-sm min-w-0">
            <button onClick={() => navigateToFolder(null)} className={`flex items-center gap-1 shrink-0 ${folderId ? 'text-muted-foreground hover:text-foreground' : 'font-medium text-foreground'}`}>
              <Home className="h-3.5 w-3.5" />
            </button>
            {parentCrumbs.map((b) => (
              <span key={b.id} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button onClick={() => navigateToFolder(b.id)} className="text-muted-foreground hover:text-foreground">{b.name}</button>
              </span>
            ))}
            {currentCrumb && (
              <span className="flex items-center gap-1 shrink-0">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{currentCrumb.name}</span>
              </span>
            )}
          </nav>
          {currentFolder && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleFolderPublic(folderId!, !folderIsPublic); }}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                  folderIsPublic ? 'text-info hover:bg-info/10' : 'text-muted-foreground hover:bg-muted'
                }`}
                title={folderIsPublic ? 'Make private' : 'Make public'}
              >
                {folderIsPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {folderIsPublic ? (currentFolder.publicPermission || 'public') : 'private'}
              </button>
              {folderIsPublic && (
                <select
                  value={currentFolder.publicPermission || 'view'}
                  onChange={(e) => { e.stopPropagation(); handleFolderPermission(folderId!, e.target.value); }}
                  className="rounded border bg-background px-1 py-0.5 text-[10px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="view">view</option>
                  <option value="edit">edit</option>
                  <option value="full">full</option>
                </select>
              )}
            </div>
          )}
          {folderMeta && (
            <span className="text-xs text-muted-foreground shrink-0">
              {folderMeta.docCount} files · {folderMeta.subfolderCount} folders · {formatSize(folderMeta.totalSize)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {folderId && currentFolder && (
            <button onClick={() => setInfoModal({ type: 'folder', id: folderId })} className="rounded-md border p-2 text-muted-foreground hover:bg-accent hover:text-foreground" title="Folder info">
              <Info className="h-4 w-4" />
            </button>
          )}
          <button onClick={reload} className="rounded-md border p-2 text-muted-foreground hover:bg-accent hover:text-foreground" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent">
            <FolderPlus className="h-4 w-4" /> Folder
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <SearchBar
          filters={filters}
          onChange={setFilters}
          availableTags={availableTags}
        />

        {showNewFolder && (
          <div className="flex items-center gap-2">
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="Folder name" autoFocus className="rounded-md border bg-background px-3 py-1.5 text-sm" />
            <button onClick={handleCreateFolder} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Create</button>
            <button onClick={() => setShowNewFolder(false)} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
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

        {/* Unified table: folders + files */}
        {hasContent ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={docs.length > 0 && docs.every((d) => selectedIds.has(d.id))} onChange={handleSelectAll} className="rounded border-input" />
                  </th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('name')}>
                    Name {sort.field === 'name' && (sort.order === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
                  </th>
                  <th className="px-4 py-3 w-24 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('mimeType')}>
                    Type {sort.field === 'mimeType' && (sort.order === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
                  </th>
                  <th className="px-4 py-3 w-20 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('size')}>
                    Size {sort.field === 'size' && (sort.order === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
                  </th>
                  <th className="px-4 py-3 w-36">Visibility</th>
                  <th className="px-4 py-3 w-28 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('createdAt')}>
                    Uploaded {sort.field === 'createdAt' && (sort.order === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
                  </th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {/* Folders */}
                {folders.map((folder) => {
                  const isFolderPublic = folder.effectivePublic ?? folder.isPublic ?? false;
                  return (
                    <tr
                      key={`folder-${folder.id}`}
                      className="group border-b last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigateToFolder(folder.id)}
                      onContextMenu={(e) => openFolderMenu(e, folder)}
                    >
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 shrink-0 text-warning" />
                          <span className="font-medium">{folder.name}</span>
                          {folder.docCount != null && (
                            <span className="text-xs text-muted-foreground">({folder.docCount})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">Folder</td>
                      <td className="px-4 py-3 text-muted-foreground">{folder.totalSize != null ? formatSize(folder.totalSize) : '-'}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => !folder.publicInherited && handleToggleFolderPublic(folder.id, !isFolderPublic)}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                              folder.publicInherited ? 'text-amber-500 cursor-default' :
                              isFolderPublic ? 'text-info hover:bg-info/10' : 'text-muted-foreground hover:bg-muted'
                            }`}
                            title={folder.publicInherited ? 'Public (inherited from parent)' : isFolderPublic ? 'Make private' : 'Make public'}
                          >
                            {folder.publicInherited ? <Link2 className="h-3 w-3" /> : isFolderPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {folder.publicInherited ? `${folder.publicPermission || 'public'} (inherited)` : isFolderPublic ? (folder.publicPermission || 'public') : 'private'}
                          </button>
                          {isFolderPublic && (
                            <>
                              <select
                                value={folder.publicPermission || 'view'}
                                onChange={(e) => handleFolderPermission(folder.id, e.target.value)}
                                className="rounded border bg-background px-1 py-0.5 text-[10px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="view">view</option>
                                <option value="edit">edit</option>
                                <option value="full">full</option>
                              </select>
                              <button onClick={() => copyFolderLink(folder.id)} className="rounded p-0.5 hover:bg-accent text-muted-foreground" title="Copy public link">
                                <LinkIcon className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">-</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setInfoModal({ type: 'folder', id: folder.id })} className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground" title="Info">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Documents */}
                {docs.map((doc) => (
                  <tr
                    key={`doc-${doc.id}`}
                    className="group border-b last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setDetailDocId(doc.id);
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('docId', doc.id);
                      router.push(`/files?${params}`);
                    }}
                    onContextMenu={(e) => openDocMenu(e, doc)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => handleSelect(doc.id)} className="rounded border-input" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{doc.name}</span>
                        {doc.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            {doc.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                            ))}
                            {doc.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{doc.mimeType.split('/').pop()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatSize(doc.size)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-[10px]">inherited</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setInfoModal({ type: 'document', id: doc.id })} className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground" title="Info">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !hasFilters && <EmptyState preset={folderId ? 'empty-folder' : 'no-documents'} />
        )}

        {!hasContent && hasFilters && <EmptyState preset="no-results" />}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button disabled={page <= 1} onClick={() => loadDocs(page - 1)} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => loadDocs(page + 1)} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <NoteContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}

      {/* Info modal */}
      {infoModal && (
        <FileItemInfoModal
          type={infoModal.type}
          itemId={infoModal.id}
          onClose={() => setInfoModal(null)}
          onUpdate={reload}
        />
      )}

      {/* Existing modals */}
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

      {showUpload && (
        <UploadModal
          folderId={folderId}
          onClose={() => setShowUpload(false)}
          onComplete={() => {
            setShowUpload(false);
            reload();
            loadTags();
          }}
        />
      )}

      {detailDocId && (
        <DetailModal
          documentId={detailDocId}
          onClose={closeDetail}
          onUpdate={reload}
        />
      )}
    </div>
  );
}
