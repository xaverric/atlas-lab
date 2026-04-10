'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Folder, FileText,
  Eye, Pencil, Trash2, Globe, Lock,
  ArrowUp, ArrowDown, Info,
} from 'lucide-react';
import { Link as LinkIcon, FolderInput } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatSize, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/notes/search-bar';
import { NoteDetail } from '@/components/notes/note-detail';
import { NoteContextMenu } from '@/components/notes/context-menu';
import { ItemInfoModal } from '@/components/notes/item-info-modal';
import { PageHeader } from '@/components/shared/page-header';
import { useConfirmDialog } from '@/components/shared/confirm-dialog';
import { usePromptDialog } from '@/components/shared/prompt-dialog';

interface FolderItem {
  id: string;
  name: string;
  aiAccessible: boolean;
  visibility?: string;
  publicPermission?: 'view' | 'edit' | 'full';
  noteCount?: number;
  totalSize?: number;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit';
  contentSize?: number;
  ownerName?: string;
  attachments?: { filename: string; size: number }[];
}

interface FolderDetail extends FolderItem {
  breadcrumb: { id: string; name: string }[];
}

interface ListResponse {
  data: NoteItem[];
  total: number;
  page: number;
  limit: number;
}

interface SearchResult {
  note: NoteItem;
  score: number;
}

interface InfoModalState {
  type: 'folder' | 'note';
  id: string;
}

function attachmentSummary(attachments?: { filename: string; size: number }[]): string {
  if (!attachments || attachments.length === 0) return '0';
  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);
  return `${attachments.length} (${formatSize(totalSize)})`;
}

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId') || null;
  const noteId = searchParams.get('noteId') || null;

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [currentFolder, setCurrentFolder] = useState<FolderDetail | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [folderMeta, setFolderMeta] = useState<{ noteCount: number; subfolderCount: number; totalSize: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState({ field: 'updatedAt', order: 'desc' as 'asc' | 'desc' });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: { icon: any; label: string; action: () => void; destructive?: boolean }[] } | null>(null);
  const [infoModal, setInfoModal] = useState<InfoModalState | null>(null);
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const { prompt, PromptDialogElement } = usePromptDialog();

  const loadFolderDetail = useCallback(async () => {
    if (!folderId) { setCurrentFolder(null); return; }
    try {
      const res = await api<{ data: FolderDetail }>(`/api/v1/notes/folders/${folderId}`);
      setCurrentFolder(res.data);
    } catch { setCurrentFolder(null); }
  }, [folderId]);

  const loadFolderMeta = useCallback(async () => {
    if (!folderId) { setFolderMeta(null); return; }
    try {
      const res = await api<{ data: { noteCount: number; subfolderCount: number; totalSize: number } }>(`/api/v1/notes/folders/${folderId}/metadata`);
      setFolderMeta(res.data);
    } catch { setFolderMeta(null); }
  }, [folderId]);

  const loadFolders = useCallback(async () => {
    try {
      const q = folderId ? `?parentId=${folderId}` : '';
      const res = await api<{ data: FolderItem[] }>(`/api/v1/notes/folders${q}`);
      setFolders(res.data);
    } catch { toast.error('Failed to load folders'); }
  }, [folderId]);

  const loadNotes = useCallback(async (p: number) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', '20');
      if (folderId) params.set('folderId', folderId);
      else params.set('folderId', '');
      params.set('sortBy', sort.field);
      params.set('sortOrder', sort.order);
      const res = await api<ListResponse>(`/api/v1/notes?${params}`);
      setNotes(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch { toast.error('Failed to load notes'); }
  }, [folderId, sort]);

  const handleSort = (field: string) => {
    setSort((prev) =>
      prev.field === field
        ? { field, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { field, order: 'asc' },
    );
  };

  useEffect(() => {
    loadFolderDetail();
    loadFolderMeta();
    loadFolders();
  }, [loadFolderDetail, loadFolderMeta, loadFolders]);

  useEffect(() => {
    setSearchResults(null);
    setSelectedIds(new Set());
    loadNotes(1);
  }, [loadNotes]);

  const reload = () => { loadFolders(); loadNotes(page); loadFolderDetail(); loadFolderMeta(); };

  const navigateToFolder = (id: string | null) => {
    router.push(id ? `/notes?folderId=${id}` : '/notes');
  };

  const navigateToNote = (id: string) => {
    const params = new URLSearchParams();
    if (folderId) params.set('folderId', folderId);
    params.set('noteId', id);
    router.push(`/notes?${params}`);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api('/api/v1/notes/folders', { method: 'POST', body: JSON.stringify({ name: newFolderName.trim(), parentId: folderId }) });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolders();
    } catch { toast.error('Failed to create folder'); }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      loadFolders();
      if (id === folderId) loadFolderDetail();
    } catch { toast.error('Failed to rename folder'); }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'DELETE' });
      loadFolders();
      if (id === folderId) router.push('/notes');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete folder'); }
  };

  const handleToggleFolderPublic = async (id: string, makePublic: boolean) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ visibility: makePublic ? 'public' : 'private' }) });
      loadFolders();
      if (id === folderId) loadFolderDetail();
      toast.success(makePublic ? 'Folder is now public' : 'Folder is now private');
    } catch { toast.error('Failed to update visibility'); }
  };

  const handleFolderPermission = async (id: string, perm: string) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ publicPermission: perm }) });
      loadFolders();
      if (id === folderId) loadFolderDetail();
    } catch { toast.error('Failed to update permission'); }
  };

  const handleToggleNotePublic = async (id: string, makePublic: boolean) => {
    try {
      await api(`/api/v1/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ isPublic: makePublic }) });
      loadNotes(page);
      toast.success(makePublic ? 'Note is now public' : 'Note is now private');
    } catch { toast.error('Failed to update visibility'); }
  };

  const handleNotePermission = async (id: string, perm: string) => {
    try {
      await api(`/api/v1/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ publicPermission: perm }) });
      loadNotes(page);
    } catch { toast.error('Failed to update permission'); }
  };

  const copyFolderLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/public/notes/folders/${id}`);
    toast.success('Public link copied');
  };

  const copyNoteLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/public/notes/${id}`);
    toast.success('Public link copied');
  };

  const handleSearch = async (query: string, semantic: boolean) => {
    if (!semantic) {
      const params = new URLSearchParams({ search: query, limit: '20' });
      if (folderId) params.set('folderId', folderId);
      try {
        const res = await api<ListResponse>(`/api/v1/notes?${params}`);
        setNotes(res.data);
        setTotal(res.total);
        setSearchResults(null);
      } catch { toast.error('Search failed'); }
    } else {
      try {
        const body: Record<string, unknown> = { query, limit: 20 };
        if (folderId) body.folderId = folderId;
        const res = await api<{ data: SearchResult[] }>('/api/v1/notes/search', { method: 'POST', body: JSON.stringify(body) });
        setSearchResults(res.data);
      } catch { toast.error('Semantic search failed'); }
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (displayNotes.every((n) => selectedIds.has(n.id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayNotes.map((n) => n.id)));
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({ title: 'Delete notes?', description: `Delete ${selectedIds.size} note(s)? This cannot be undone.`, confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      await Promise.all([...selectedIds].map((id) => api(`/api/v1/notes/${id}`, { method: 'DELETE' })));
      toast.success(`${selectedIds.size} note(s) deleted`);
      setSelectedIds(new Set());
      loadNotes(page);
    } catch { toast.error('Failed to delete some notes'); }
  };

  const openFolderMenu = (e: React.MouseEvent, folder: FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    const isPublic = folder.visibility === 'public';
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: Eye, label: 'Open', action: () => navigateToFolder(folder.id) },
        { icon: Pencil, label: 'Rename', action: async () => { const name = await prompt({ title: 'Rename folder', defaultValue: folder.name }); if (name?.trim()) handleRenameFolder(folder.id, name.trim()); } },
        { icon: isPublic ? Lock : Globe, label: isPublic ? 'Make Private' : 'Make Public', action: () => handleToggleFolderPublic(folder.id, !isPublic) },
        ...(isPublic ? [{ icon: LinkIcon, label: 'Copy Public Link', action: () => copyFolderLink(folder.id) }] : []),
        { icon: Info, label: 'Info', action: () => setInfoModal({ type: 'folder', id: folder.id }) },
        { icon: FolderInput, label: 'Move to...', action: async () => { const target = await prompt({ title: 'Move to folder', description: 'Enter folder ID or leave empty for root', defaultValue: '' }); if (target !== null) { api(`/api/v1/notes/folders/${folder.id}`, { method: 'PATCH', body: JSON.stringify({ parentId: target || null }) }).then(() => { toast.success('Moved'); loadFolders(); }).catch(() => toast.error('Failed to move')); } } },
        { icon: Trash2, label: 'Delete', action: () => handleDeleteFolder(folder.id), destructive: true },
      ],
    });
  };

  const openNoteMenu = (e: React.MouseEvent, note: NoteItem) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: Eye, label: 'Open', action: () => navigateToNote(note.id) },
        { icon: Pencil, label: 'Rename', action: async () => { const title = await prompt({ title: 'Rename note', defaultValue: note.title }); if (title?.trim()) { api(`/api/v1/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify({ title: title.trim() }) }).then(() => { toast.success('Renamed'); loadNotes(page); }).catch(() => toast.error('Failed to rename')); } } },
        { icon: note.isPublic ? Lock : Globe, label: note.isPublic ? 'Make Private' : 'Make Public', action: () => handleToggleNotePublic(note.id, !note.isPublic) },
        ...(note.isPublic ? [{ icon: LinkIcon, label: 'Copy Public Link', action: () => copyNoteLink(note.id) }] : []),
        { icon: Info, label: 'Info', action: () => setInfoModal({ type: 'note', id: note.id }) },
        { icon: FolderInput, label: 'Move to...', action: async () => { const target = await prompt({ title: 'Move to folder', description: 'Enter folder ID or leave empty for root', defaultValue: '' }); if (target !== null) { api(`/api/v1/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify({ folderId: target || null }) }).then(() => { toast.success('Moved'); loadNotes(page); }).catch(() => toast.error('Failed to move')); } } },
        { icon: Trash2, label: 'Delete', action: async () => { const ok = await confirm({ title: 'Delete note?', description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' }); if (ok) { api(`/api/v1/notes/${note.id}`, { method: 'DELETE' }).then(() => { toast.success('Deleted'); loadNotes(page); }).catch(() => toast.error('Failed')); } }, destructive: true },
      ],
    });
  };

  const totalPages = Math.ceil(total / 20);
  const displayNotes = searchResults ? searchResults.map((r) => r.note) : notes;

  if (noteId) {
    return (
      <div className="flex h-full flex-col">
        <NoteDetail
          noteId={noteId}
          onBack={() => navigateToFolder(folderId)}
          onNoteUpdate={reload}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title={currentFolder?.name || 'All Notes'} />
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        <SearchBar onSearch={handleSearch} />

        {showNewFolder && (
          <div className="flex items-center gap-2">
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="Folder name" autoFocus className="rounded-md border bg-background px-3 py-1.5 text-sm" />
            <button onClick={handleCreateFolder} className="rounded-md bg-[#0071e3] px-3 py-1.5 text-sm text-white hover:opacity-90">Create</button>
            <button onClick={() => setShowNewFolder(false)} className="rounded-md bg-[#f5f5f7] text-[#1d1d1f] dark:bg-[#2c2c2e] dark:text-white px-3 py-1.5 text-sm hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]">Cancel</button>
          </div>
        )}

        {searchResults && (
          <p className="text-sm text-muted-foreground">{searchResults.length} semantic result{searchResults.length !== 1 ? 's' : ''}</p>
        )}

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] px-3 py-2 text-sm">
            <span>{selectedIds.size} selected</span>
            <button onClick={handleBulkDelete} className="rounded-md bg-[#ff3b30] px-3 py-1.5 text-xs text-white">Delete</button>
            <button onClick={() => setSelectedIds(new Set())} className="rounded-md bg-[#f5f5f7] text-[#1d1d1f] dark:bg-[#2c2c2e] dark:text-white px-3 py-1.5 text-xs hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]">Clear</button>
          </div>
        )}

        {/* Unified list */}
        {(folders.length > 0 || displayNotes.length > 0) ? (
          <div className="overflow-x-auto rounded-xl bg-[#f5f5f7] dark:bg-[#1c1c1e] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#f5f5f7]/60 dark:bg-[#2c2c2e]/60 text-left">
                  <th className="px-4 py-3 w-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <input type="checkbox" checked={displayNotes.length > 0 && displayNotes.every((n) => selectedIds.has(n.id))} onChange={handleSelectAll} className="rounded border-input" />
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('title')}>
                    Name {sort.field === 'title' && (sort.order === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
                  </th>
                  <th className="px-4 py-3 w-20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('contentSize')}>
                    Size {sort.field === 'contentSize' && (sort.order === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
                  </th>
                  <th className="px-4 py-3 w-28 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Attachments</th>
                  <th className="px-4 py-3 w-36 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visibility</th>
                  <th className="px-4 py-3 w-28 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('updatedAt')}>
                    Updated {sort.field === 'updatedAt' && (sort.order === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
                  </th>
                  <th className="px-4 py-3 w-16 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {/* Folders */}
                {folders.map((folder) => {
                  const isFolderPublic = folder.visibility === 'public';
                  return (
                    <tr
                      key={`folder-${folder.id}`}
                      className="group border-b last:border-b-0 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                      onClick={() => navigateToFolder(folder.id)}
                      onContextMenu={(e) => openFolderMenu(e, folder)}
                    >
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 shrink-0 text-warning" />
                          <span className="font-medium">{folder.name}</span>
                          {folder.noteCount != null && (
                            <span className="text-xs text-muted-foreground">({folder.noteCount})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{folder.totalSize != null ? formatSize(folder.totalSize) : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">-</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleFolderPublic(folder.id, !isFolderPublic)}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                              isFolderPublic ? 'text-info hover:bg-info/10' : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                            }`}
                            title={isFolderPublic ? 'Make private' : 'Make public'}
                          >
                            {isFolderPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {isFolderPublic ? (folder.publicPermission || 'public') : 'private'}
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
                              <button onClick={() => copyFolderLink(folder.id)} className="rounded p-0.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground" title="Copy public link">
                                <LinkIcon className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">-</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setInfoModal({ type: 'folder', id: folder.id })} className="rounded p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground" title="Info">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Notes */}
                {displayNotes.map((note) => {
                  const isNotePublic = note.isPublic ?? false;
                  return (
                    <tr
                      key={`note-${note.id}`}
                      className="group border-b last:border-b-0 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                      onClick={() => navigateToNote(note.id)}
                      onContextMenu={(e) => openNoteMenu(e, note)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(note.id)} onChange={() => handleSelect(note.id)} className="rounded border-input" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium truncate">{note.title}</span>
                          {note.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {note.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                              ))}
                              {note.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{note.contentSize != null ? formatSize(note.contentSize) : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{attachmentSummary(note.attachments)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleNotePublic(note.id, !isNotePublic)}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                              isNotePublic ? 'text-info hover:bg-info/10' : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                            }`}
                            title={isNotePublic ? 'Make private' : 'Make public'}
                          >
                            {isNotePublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {isNotePublic ? (note.publicPermission || 'public') : 'private'}
                          </button>
                          {isNotePublic && (
                            <>
                              <select
                                value={note.publicPermission || 'view'}
                                onChange={(e) => handleNotePermission(note.id, e.target.value)}
                                className="rounded border bg-background px-1 py-0.5 text-[10px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="view">view</option>
                                <option value="edit">edit</option>
                              </select>
                              <button onClick={() => copyNoteLink(note.id)} className="rounded p-0.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground" title="Copy public link">
                                <LinkIcon className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(note.updatedAt)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setInfoModal({ type: 'note', id: note.id })} className="rounded p-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground" title="Info">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !searchResults && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p>No notes yet</p>
              <Link href={`/notes/new${folderId ? `?folderId=${folderId}` : ''}`} className="mt-2 text-primary hover:underline">
                Create your first note
              </Link>
            </div>
          )
        )}

        {!searchResults && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button disabled={page <= 1} onClick={() => loadNotes(page - 1)} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => loadNotes(page + 1)} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      {ctxMenu && (
        <NoteContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}

      {infoModal && (
        <ItemInfoModal
          type={infoModal.type}
          itemId={infoModal.id}
          onClose={() => setInfoModal(null)}
          onUpdate={reload}
        />
      )}

      {ConfirmDialogElement}
      {PromptDialogElement}
    </div>
  );
}
