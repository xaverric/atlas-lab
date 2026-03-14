'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, FolderPlus, Folder, FileText, RefreshCw,
  Eye, Pencil, Trash2, Bot, Globe, Lock, ChevronRight, Home, Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatSize, formatDate } from '@/lib/utils';
import { TreeSidebar, type TreeItem } from '@/components/shared/tree-sidebar';
import { VisibilityBadge } from '@/components/shared/visibility-badge';
import { SearchBar } from '@/components/notes/search-bar';

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

function attachmentSummary(attachments?: { filename: string; size: number }[]): string {
  if (!attachments || attachments.length === 0) return '0';
  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);
  return `${attachments.length} (${formatSize(totalSize)})`;
}

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId') || null;

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [currentFolder, setCurrentFolder] = useState<FolderDetail | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [treeKey, setTreeKey] = useState(0);
  const [folderMeta, setFolderMeta] = useState<{ noteCount: number; subfolderCount: number; totalSize: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [editingFolderName, setEditingFolderName] = useState(false);
  const [folderNameDraft, setFolderNameDraft] = useState('');

  const refreshTree = () => setTreeKey((k) => k + 1);

  const loadFolderDetail = useCallback(async () => {
    if (!folderId) { setCurrentFolder(null); return; }
    try {
      const res = await api<{ data: FolderDetail }>(`/api/v1/notes/folders/${folderId}`);
      setCurrentFolder(res.data);
    } catch {
      setCurrentFolder(null);
    }
  }, [folderId]);

  const loadFolderMeta = useCallback(async () => {
    if (!folderId) { setFolderMeta(null); return; }
    try {
      const res = await api<{ data: { noteCount: number; subfolderCount: number; totalSize: number } }>(`/api/v1/notes/folders/${folderId}/metadata`);
      setFolderMeta(res.data);
    } catch { setFolderMeta(null); }
  }, [folderId]);

  const loadNotes = useCallback(async (p: number) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', '20');
      if (folderId) params.set('folderId', folderId);
      else params.set('folderId', '');
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');

      const res = await api<ListResponse>(`/api/v1/notes?${params}`);
      setNotes(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast.error('Failed to load notes');
    }
  }, [folderId]);

  const loadTreeChildren = useCallback(async (parentId: string | null): Promise<TreeItem[]> => {
    const folderQuery = parentId ? `?parentId=${parentId}` : '';
    const noteParams = new URLSearchParams({ limit: '100', sortBy: 'updatedAt', sortOrder: 'desc' });
    noteParams.set('folderId', parentId ?? '');

    const [foldersRes, notesRes] = await Promise.all([
      api<{ data: FolderItem[] }>(`/api/v1/notes/folders${folderQuery}`),
      api<ListResponse>(`/api/v1/notes?${noteParams}`),
    ]);

    const folderItems: TreeItem[] = foldersRes.data.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'folder' as const,
      isPublic: f.visibility === 'public',
      publicPermission: f.publicPermission,
      itemCount: f.noteCount,
      totalSize: f.totalSize,
    }));

    const noteItems: TreeItem[] = notesRes.data.map((n) => ({
      id: n.id,
      name: n.title,
      type: 'item' as const,
      size: n.contentSize,
    }));

    return [...folderItems, ...noteItems];
  }, []);

  useEffect(() => { loadFolderDetail(); loadFolderMeta(); }, [loadFolderDetail, loadFolderMeta]);

  useEffect(() => {
    setSearchResults(null);
    loadNotes(1);
  }, [loadNotes]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api('/api/v1/notes/folders', {
        method: 'POST',
        body: JSON.stringify({ name: newFolderName.trim(), parentId: folderId }),
      });
      setNewFolderName('');
      setShowNewFolder(false);
      refreshTree();
    } catch {
      toast.error('Failed to create folder');
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      refreshTree();
      if (id === folderId) loadFolderDetail();
    } catch {
      toast.error('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'DELETE' });
      refreshTree();
      if (id === folderId) router.push('/notes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  const handleToggleAi = async (id: string, current: boolean) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ aiAccessible: !current }) });
      refreshTree();
      if (id === folderId) loadFolderDetail();
      toast.success(`AI access ${current ? 'disabled' : 'enabled'}`);
    } catch {
      toast.error('Failed to toggle AI access');
    }
  };

  const handleTogglePublic = async (id: string, isPublic: boolean, publicPermission?: string) => {
    try {
      const body: Record<string, unknown> = { visibility: isPublic ? 'public' : 'private' };
      if (publicPermission) body.publicPermission = publicPermission;
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      refreshTree();
      if (id === folderId) loadFolderDetail();
      toast.success(isPublic ? 'Folder is now public' : 'Folder is now private');
    } catch {
      toast.error('Failed to update visibility');
    }
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
      } catch {
        toast.error('Search failed');
      }
    } else {
      try {
        const body: Record<string, unknown> = { query, limit: 20 };
        if (folderId) body.folderId = folderId;
        const res = await api<{ data: SearchResult[] }>('/api/v1/notes/search', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setSearchResults(res.data);
      } catch {
        toast.error('Semantic search failed');
      }
    }
  };

  const handleSelectFolder = (id: string | null) => {
    router.push(id ? `/notes?folderId=${id}` : '/notes');
  };

  const handleSelectItem = (id: string) => {
    router.push(`/notes/${id}`);
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
    if (!confirm(`Delete ${selectedIds.size} note(s)?`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => api(`/api/v1/notes/${id}`, { method: 'DELETE' })));
      toast.success(`${selectedIds.size} note(s) deleted`);
      setSelectedIds(new Set());
      loadNotes(page);
      refreshTree();
    } catch { toast.error('Failed to delete some notes'); }
  };

  const totalPages = Math.ceil(total / 20);
  const displayNotes = searchResults ? searchResults.map((r) => r.note) : notes;
  const folderIsPublic = currentFolder?.visibility === 'public';

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <TreeSidebar
        key={treeKey}
        storageKey="notes"
        selectedFolderId={folderId}
        onSelectFolder={handleSelectFolder}
        onSelectItem={handleSelectItem}
        loadChildren={loadTreeChildren}
        title="Notes"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              {currentFolder ? currentFolder.name : 'All Notes'}
            </h1>
            {currentFolder && (
              <>
                <VisibilityBadge isPublic={folderIsPublic} permission={currentFolder.publicPermission} />
                {currentFolder.aiAccessible && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-purple-500">
                    <Bot className="h-3 w-3" /> AI
                  </span>
                )}
              </>
            )}
            {folderMeta && (
              <span className="text-xs text-muted-foreground">
                {folderMeta.noteCount} notes · {folderMeta.subfolderCount} folders · {formatSize(folderMeta.totalSize)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {folderId && currentFolder && (
              <button
                onClick={() => setShowFolderSettings((v) => !v)}
                className="rounded-md border p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Folder settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => { refreshTree(); loadNotes(page); if (folderId) { loadFolderDetail(); loadFolderMeta(); } }}
              className="rounded-md border p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              <FolderPlus className="h-4 w-4" /> Folder
            </button>
            <Link
              href={`/notes/new${folderId ? `?folderId=${folderId}` : ''}`}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Note
            </Link>
          </div>
        </div>

        {/* Breadcrumb */}
        {currentFolder?.breadcrumb && currentFolder.breadcrumb.length > 0 && (
          <div className="shrink-0 border-b px-6 py-1.5">
            <nav className="flex items-center gap-1 text-sm">
              <button onClick={() => handleSelectFolder(null)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Home className="h-4 w-4" /> Root
              </button>
              {currentFolder.breadcrumb.map((b, i) => (
                <span key={b.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  {i === currentFolder.breadcrumb.length - 1 ? (
                    <span className="font-medium">{b.name}</span>
                  ) : (
                    <button onClick={() => handleSelectFolder(b.id)} className="text-muted-foreground hover:text-foreground">{b.name}</button>
                  )}
                </span>
              ))}
            </nav>
          </div>
        )}

        {/* Folder settings panel */}
        {showFolderSettings && folderId && currentFolder && (
          <div className="shrink-0 border-b px-6 py-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Folder Settings</span>
              <button onClick={() => { setShowFolderSettings(false); setEditingFolderName(false); }} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {editingFolderName ? (
                <div className="flex items-center gap-1">
                  <input
                    value={folderNameDraft}
                    onChange={(e) => setFolderNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && folderNameDraft.trim()) { handleRenameFolder(folderId, folderNameDraft.trim()); setEditingFolderName(false); }
                      if (e.key === 'Escape') setEditingFolderName(false);
                    }}
                    className="rounded border bg-background px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button onClick={() => { if (folderNameDraft.trim()) { handleRenameFolder(folderId, folderNameDraft.trim()); setEditingFolderName(false); } }} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Save</button>
                  <button onClick={() => setEditingFolderName(false)} className="rounded border px-2 py-1 text-xs">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => { setFolderNameDraft(currentFolder.name); setEditingFolderName(true); }}
                  className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                >
                  <Pencil className="h-3 w-3" /> Rename
                </button>
              )}
              <button
                onClick={() => handleTogglePublic(folderId, !folderIsPublic)}
                className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                {folderIsPublic ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {folderIsPublic ? 'Make Private' : 'Make Public'}
              </button>
              <button
                onClick={() => handleToggleAi(folderId, currentFolder.aiAccessible)}
                className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                <Bot className="h-3 w-3" />
                {currentFolder.aiAccessible ? 'Disable AI' : 'Enable AI'}
              </button>
              <button
                onClick={() => handleDeleteFolder(folderId)}
                className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" /> Delete Folder
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <SearchBar onSearch={handleSearch} />

          {showNewFolder && (
            <div className="flex items-center gap-2">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                placeholder="Folder name"
                autoFocus
                className="rounded-md border bg-background px-3 py-1.5 text-sm"
              />
              <button onClick={handleCreateFolder} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Create</button>
              <button onClick={() => setShowNewFolder(false)} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
            </div>
          )}

          {searchResults && (
            <p className="text-sm text-muted-foreground">{searchResults.length} semantic result{searchResults.length !== 1 ? 's' : ''}</p>
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <span>{selectedIds.size} selected</span>
              <button onClick={handleBulkDelete} className="rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground">Delete</button>
              <button onClick={() => setSelectedIds(new Set())} className="rounded-md border px-3 py-1.5 text-xs">Clear</button>
            </div>
          )}

          {displayNotes.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-2 w-10">
                      <input type="checkbox" checked={displayNotes.length > 0 && displayNotes.every((n) => selectedIds.has(n.id))} onChange={handleSelectAll} className="rounded border-input" />
                    </th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2 w-20">Size</th>
                    <th className="px-4 py-2 w-28">Attachments</th>
                    <th className="px-4 py-2 w-24">Visibility</th>
                    <th className="px-4 py-2 w-28">Author</th>
                    <th className="px-4 py-2 w-28">Updated</th>
                    <th className="px-4 py-2 w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayNotes.map((note) => (
                    <tr
                      key={note.id}
                      className="group border-b last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/notes/${note.id}`)}
                    >
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(note.id)} onChange={() => handleSelect(note.id)} className="rounded border-input" />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium truncate">{note.title}</span>
                          {note.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {note.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {tag}
                                </span>
                              ))}
                              {note.tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {note.contentSize != null ? formatSize(note.contentSize) : '-'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {attachmentSummary(note.attachments)}
                      </td>
                      <td className="px-4 py-2">
                        <VisibilityBadge isPublic={note.isPublic ?? false} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground truncate">
                        {note.ownerName ?? '-'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(note.updatedAt)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/notes/${note.id}`); }}
                            className="rounded p-1 hover:bg-accent"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this note?')) { api(`/api/v1/notes/${note.id}`, { method: 'DELETE' }).then(() => { toast.success('Note deleted'); loadNotes(page); refreshTree(); }).catch(() => toast.error('Failed to delete')); } }}
                            className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => loadNotes(page - 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => loadNotes(page + 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
