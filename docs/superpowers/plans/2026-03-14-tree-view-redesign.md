# Tree View Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat folder-cards + item-list layout in Notes and Files with a sidebar tree + content table, showing rich metadata (size, visibility, attachments, author).

**Architecture:** Shared components (`TreeSidebar`, `TreeNode`, `ContentTable`, `VisibilityBadge`) consumed by both `/notes` and `/files` pages with different column configs. Backend changes only in atlas-notes (add folder metadata, contentSize field). DMS needs only a frontend interface update.

**Tech Stack:** Next.js 15 (App Router), React, Tailwind CSS, Lucide icons, Mongoose/MongoDB aggregation, Express

**Spec:** `docs/superpowers/specs/2026-03-14-tree-view-redesign.md`

---

## Chunk 1: Backend — atlas-notes API enhancements

### Task 1: Add `contentSize` field to Note model

**Files:**
- Modify: `apps/atlas-notes/src/models/Note.ts`
- Modify: `apps/atlas-notes/src/services/noteService.ts`
- Modify: `apps/atlas-notes/src/daos/noteDao.ts`

- [ ] **Step 1: Add `contentSize` to Note schema**

In `apps/atlas-notes/src/models/Note.ts`, add `contentSize` field after `isPublic`:

```typescript
contentSize: { type: Number, default: 0 },
```

- [ ] **Step 2: Add `contentSize` to noteDao `create` and `updateById` type signatures**

In `apps/atlas-notes/src/daos/noteDao.ts`, update the `create` function type (line 16-23) to accept `contentSize`:

```typescript
export const create = (data: {
  title: string;
  content?: string;
  folderId?: string | null;
  ownerId: string;
  tags?: string[];
  isPublic?: boolean;
  contentSize?: number;
}) => Note.create({ ...data, folderId: data.folderId || null });
```

Also update `updateById` to accept `contentSize`:

```typescript
export const updateById = (id: string, data: Partial<{ title: string; content: string; tags: string[]; folderId: string | null; isPublic: boolean; contentSize: number }>) =>
  Note.findByIdAndUpdate(id, data, { new: true });
```

- [ ] **Step 3: Compute `contentSize` on create in noteService**

In `apps/atlas-notes/src/services/noteService.ts`, modify the `create` function (line 59-63). Compute contentSize and pass it. Note: `embedAndUpsert` takes 7 args: `(noteId, title, content, tags, ownerId, folderId, isPublic)` — keep the existing call signature:

```typescript
export const create = async (input: CreateInput) => {
  const contentSize = Buffer.byteLength(input.content || '', 'utf8');
  const note = await noteDao.create({ ...input, contentSize });
  embedAndUpsert(note.id, note.title, note.content || '', note.tags || [], note.ownerId, note.folderId?.toString() || null, note.isPublic ?? false);
  return note;
};
```

- [ ] **Step 4: Recompute `contentSize` on update in noteService**

In `apps/atlas-notes/src/services/noteService.ts`, in the `update` function (around line 73), add contentSize computation when content changes. Keep all existing embedding logic unchanged:

```typescript
  // After: const existing = await noteDao.findById(id, ownerId, isAdmin);
  // Add contentSize computation before the updateById call:
  const updateData: Record<string, unknown> = { ...data };
  if (data.content !== undefined) {
    updateData.contentSize = Buffer.byteLength(data.content, 'utf8');
  }
  const updated = await noteDao.updateById(id, updateData);
  // ... rest of existing embedding logic stays exactly the same
```

- [ ] **Step 5: Verify by running dev server**

Run: `npm run dev:notes`
Expected: Server starts without errors. Existing note CRUD still works.

- [ ] **Step 6: Commit**

```bash
git add apps/atlas-notes/src/models/Note.ts apps/atlas-notes/src/services/noteService.ts apps/atlas-notes/src/daos/noteDao.ts
git commit -m "feat(notes): add contentSize field to Note model, computed on save"
```

---

### Task 2: Add folder metadata endpoint and inline counts to folder list

**Files:**
- Modify: `apps/atlas-notes/src/daos/noteFolderDao.ts`
- Modify: `apps/atlas-notes/src/daos/noteDao.ts`
- Modify: `apps/atlas-notes/src/services/noteFolderService.ts`
- Modify: `apps/atlas-notes/src/controllers/noteFolderController.ts`
- Modify: `apps/atlas-notes/src/routes/folder.ts`

- [ ] **Step 1: Add aggregate helpers to noteDao**

In `apps/atlas-notes/src/daos/noteDao.ts`, add `Types` import at the top (after the existing `import type { FilterQuery } from 'mongoose';`):

```typescript
import { Types } from 'mongoose';
```

Then add at the end of the file:

```typescript
export const countByFolder = (ownerId: string, folderId: string | null) =>
  Note.countDocuments({ ownerId, folderId });

export const totalSizeByFolder = async (ownerId: string, folderId: string | null) => {
  const result = await Note.aggregate([
    { $match: { ownerId, folderId: folderId ? new Types.ObjectId(folderId) : null } },
    { $group: { _id: null, total: { $sum: '$contentSize' } } },
  ]);
  return result[0]?.total ?? 0;
};
```

- [ ] **Step 2: Add `noteDao` import to noteFolderService and add `getMetadata`**

In `apps/atlas-notes/src/services/noteFolderService.ts`, add import at the top:

```typescript
import * as noteDao from '../daos/noteDao.js';
```

Then add the `getMetadata` function:

```typescript
const getMetadata = async (id: string, ownerId: string, isAdmin = false) => {
  const folder = await noteFolderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const [noteCount, subfolderCount, totalSize] = await Promise.all([
    noteDao.countByFolder(ownerId, id),
    noteFolderDao.countChildren(id),
    noteDao.totalSizeByFolder(ownerId, id),
  ]);

  return { id: folder.id, name: (folder as any).name, noteCount, subfolderCount, totalSize };
};
```

Export it.

- [ ] **Step 3: Add `listWithCounts` to noteFolderService**

In `apps/atlas-notes/src/services/noteFolderService.ts`, add a new function that enriches folder list with counts:

```typescript
const listWithCounts = async (ownerId: string, parentId: string | null, isAdmin = false) => {
  const folders = await noteFolderDao.listByParent(ownerId, parentId, isAdmin);
  const enriched = await Promise.all(
    folders.map(async (f: any) => {
      const [noteCount, totalSize] = await Promise.all([
        noteDao.countByFolder(isAdmin ? (f as any).ownerId : ownerId, f.id),
        noteDao.totalSizeByFolder(isAdmin ? (f as any).ownerId : ownerId, f.id),
      ]);
      return { ...f.toJSON(), noteCount, totalSize };
    }),
  );
  return enriched;
};
```

Export it.

- [ ] **Step 4: Add `getMetadata` controller**

In `apps/atlas-notes/src/controllers/noteFolderController.ts`, add:

```typescript
const getMetadata: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const meta = await noteFolderService.getMetadata(req.params.id, ownerId, isAdmin);
    res.json({ data: meta });
  } catch (err) { next(err); }
};
```

Export it.

- [ ] **Step 5: Update `list` controller to use enriched response**

In `apps/atlas-notes/src/controllers/noteFolderController.ts`, modify the `list` handler to call `listWithCounts` instead of `listByParent`:

```typescript
const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const parentId = (req.query.parentId as string) || null;
    const folders = await noteFolderService.listWithCounts(ownerId, parentId, isAdmin);
    res.json({ data: folders });
  } catch (err) { next(err); }
};
```

- [ ] **Step 6: Add metadata route**

In `apps/atlas-notes/src/routes/folder.ts`, add between the `GET /:id` and `PATCH /:id` routes:

```typescript
router.get('/:id/metadata', validate(idParamSchema, 'params'), noteFolderController.getMetadata);
```

- [ ] **Step 7: Verify**

Run: `npm run dev:notes`
Test: `curl -H "Authorization: Bearer $TOKEN" http://localhost:4004/api/v1/notes/folders` — should return folders with `noteCount` and `totalSize` fields.

- [ ] **Step 8: Commit**

```bash
git add apps/atlas-notes/src/
git commit -m "feat(notes): add folder metadata endpoint and inline counts to folder list"
```

---

### Task 3: Add `ownerName` to note list response

**Files:**
- Modify: `apps/atlas-notes/src/services/noteService.ts`

The JWT token (`req.auth`) contains `name` field. Since the tree view only shows the current user's notes, the owner is always the current user. We pass the auth name from the controller through to the service, and tag each note with `ownerName`.

- [ ] **Step 1: Update `list` in noteService to accept and attach ownerName**

In `apps/atlas-notes/src/services/noteService.ts`, modify the `list` function:

```typescript
const list = async (opts: ListInput & { ownerName?: string }) => {
  const result = await noteDao.list(opts);
  const ownerName = opts.ownerName || 'Unknown';
  return {
    ...result,
    data: result.data.map((n: any) => ({ ...n.toJSON(), ownerName })),
  };
};
```

- [ ] **Step 2: Pass ownerName from controller**

In `apps/atlas-notes/src/controllers/noteController.ts`, in the `list` handler (around line 22-40), add `ownerName` from `req.auth`:

After the existing `const { ownerId, isAdmin } = resolveOwner(req);` line, extract the name and pass it:

```typescript
const ownerName = (req as any).auth?.name || (req as any).auth?.preferred_username || 'Unknown';
```

Then add it to the service call options: `{ ...opts, ownerName }`

- [ ] **Step 3: Verify**

Run: `npm run dev:notes`
Expected: `GET /api/v1/notes` response includes `ownerName` on each note.

- [ ] **Step 4: Commit**

```bash
git add apps/atlas-notes/src/services/noteService.ts apps/atlas-notes/src/controllers/noteController.ts
git commit -m "feat(notes): add ownerName to note list response from JWT"
```

---

## Chunk 2: Shared frontend components

### Task 4: Create `VisibilityBadge` component

**Files:**
- Create: `apps/atlas-gui/src/components/shared/visibility-badge.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisibilityBadgeProps {
  isPublic: boolean;
  permission?: 'view' | 'edit' | 'full';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function VisibilityBadge({ isPublic, permission, size = 'sm', showLabel = true }: VisibilityBadgeProps) {
  const Icon = isPublic ? Globe : Lock;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (!isPublic) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
        <Icon className={iconSize} />
        {showLabel && 'private'}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-info', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
      <Icon className={iconSize} />
      {showLabel && (permission || 'public')}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/components/shared/visibility-badge.tsx
git commit -m "feat(gui): add shared VisibilityBadge component"
```

---

### Task 5: Create `TreeNode` component

**Files:**
- Create: `apps/atlas-gui/src/components/shared/tree-node.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { cn, formatSize } from '@/lib/utils';
import { VisibilityBadge } from './visibility-badge';

export interface TreeNodeData {
  id: string;
  name: string;
  type: 'folder' | 'item';
  size?: number;
  itemCount?: number;
  totalSize?: number;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
  isExpanded?: boolean;
  isSelected?: boolean;
  isLoading?: boolean;
  depth: number;
}

interface TreeNodeProps {
  node: TreeNodeData;
  onToggle?: () => void;
  onClick?: () => void;
}

const MAX_DEPTH = 5;

export function TreeNode({ node, onToggle, onClick }: TreeNodeProps) {
  const indent = Math.min(node.depth, MAX_DEPTH) * 16;
  const isFolder = node.type === 'folder';

  return (
    <div
      className={cn(
        'group flex items-center gap-1 py-1 px-2 text-[11px] cursor-pointer hover:bg-accent/50 transition-colors',
        node.isSelected && 'bg-accent',
        isFolder && (node.isPublic ? 'border-l-2 border-info' : 'border-l-2 border-muted-foreground/30'),
        !isFolder && 'border-l-2 border-transparent',
      )}
      style={{ paddingLeft: `${indent + 8}px` }}
      onClick={onClick}
    >
      {isFolder && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
        >
          {node.isLoading ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
          ) : node.isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      )}
      {!isFolder && <span className="w-4 shrink-0" />}

      {isFolder ? (
        <Folder className="h-3.5 w-3.5 shrink-0 text-warning" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}

      <span className="truncate flex-1 min-w-0">{node.name}</span>

      {isFolder && node.isPublic && (
        <VisibilityBadge isPublic permission={node.publicPermission} size="sm" showLabel={false} />
      )}

      <span className="shrink-0 text-[10px] text-muted-foreground ml-auto pl-2">
        {isFolder
          ? `${node.itemCount ?? 0} · ${formatSize(node.totalSize ?? 0)}`
          : formatSize(node.size ?? 0)
        }
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/components/shared/tree-node.tsx
git commit -m "feat(gui): add shared TreeNode component"
```

---

### Task 6: Create `TreeSidebar` component

**Files:**
- Create: `apps/atlas-gui/src/components/shared/tree-sidebar.tsx`

- [ ] **Step 1: Create the component**

This component manages the tree state (expanded folders, loading states), fetches children lazily, and renders `TreeNode` recursively.

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeNode, type TreeNodeData } from './tree-node';

export interface TreeItem {
  id: string;
  name: string;
  type: 'folder' | 'item';
  size?: number;
  itemCount?: number;
  totalSize?: number;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
}

interface TreeSidebarProps {
  storageKey: string;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectItem: (id: string) => void;
  loadChildren: (parentId: string | null) => Promise<TreeItem[]>;
  title: string;
}

interface TreeState {
  [parentKey: string]: {
    children: TreeItem[];
    expanded: boolean;
    loaded: boolean;
    loading: boolean;
    error: boolean;
  };
}

const STORAGE_PREFIX = 'tree-expanded-';

export function TreeSidebar({ storageKey, selectedFolderId, onSelectFolder, onSelectItem, loadChildren, title }: TreeSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [tree, setTree] = useState<TreeState>({});

  // Restore sidebar open state
  useEffect(() => {
    const stored = localStorage.getItem(`${storageKey}-sidebar-open`);
    if (stored !== null) setIsOpen(stored === 'true');
  }, [storageKey]);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(`${storageKey}-sidebar-open`, String(next));
  };

  // Restore expanded state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (stored) {
        const expandedIds: string[] = JSON.parse(stored);
        setTree((prev) => {
          const next = { ...prev };
          expandedIds.forEach((id) => {
            if (next[id]) next[id] = { ...next[id], expanded: true };
          });
          return next;
        });
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Persist expanded state
  const persistExpanded = useCallback((state: TreeState) => {
    const expandedIds = Object.entries(state)
      .filter(([, v]) => v.expanded)
      .map(([k]) => k);
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(expandedIds));
  }, [storageKey]);

  // Load root on mount
  useEffect(() => {
    const loadRoot = async () => {
      setTree((prev) => ({ ...prev, root: { children: [], expanded: true, loaded: false, loading: true, error: false } }));
      try {
        const items = await loadChildren(null);
        setTree((prev) => {
          const next = { ...prev, root: { children: items, expanded: true, loaded: true, loading: false, error: false } };
          return next;
        });
      } catch {
        setTree((prev) => ({ ...prev, root: { children: [], expanded: true, loaded: true, loading: false, error: true } }));
      }
    };
    loadRoot();
  }, [loadChildren]);

  const toggleFolder = async (folderId: string) => {
    const entry = tree[folderId];
    if (entry?.expanded) {
      setTree((prev) => {
        const next = { ...prev, [folderId]: { ...prev[folderId], expanded: false } };
        persistExpanded(next);
        return next;
      });
      return;
    }

    if (entry?.loaded) {
      setTree((prev) => {
        const next = { ...prev, [folderId]: { ...prev[folderId], expanded: true } };
        persistExpanded(next);
        return next;
      });
      return;
    }

    // Load children
    setTree((prev) => ({
      ...prev,
      [folderId]: { children: [], expanded: true, loaded: false, loading: true, error: false },
    }));

    try {
      const items = await loadChildren(folderId);
      setTree((prev) => {
        const next = {
          ...prev,
          [folderId]: { children: items, expanded: true, loaded: true, loading: false, error: false },
        };
        persistExpanded(next);
        return next;
      });
    } catch {
      setTree((prev) => ({
        ...prev,
        [folderId]: { children: [], expanded: true, loaded: true, loading: false, error: true },
      }));
    }
  };

  const retryLoad = (folderId: string | null) => {
    const key = folderId ?? 'root';
    setTree((prev) => ({ ...prev, [key]: { ...prev[key], loading: true, error: false } }));
    loadChildren(folderId).then((items) => {
      setTree((prev) => ({
        ...prev,
        [key]: { children: items, expanded: true, loaded: true, loading: false, error: false },
      }));
    }).catch(() => {
      setTree((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: false, error: true },
      }));
    });
  };

  const renderChildren = (parentKey: string, depth: number) => {
    const entry = tree[parentKey];
    if (!entry || !entry.expanded) return null;

    if (entry.loading) {
      return (
        <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1 text-[10px] text-muted-foreground animate-pulse">
          Loading...
        </div>
      );
    }

    if (entry.error) {
      return (
        <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1 text-[10px] text-destructive flex items-center gap-1">
          Failed to load
          <button onClick={() => retryLoad(parentKey === 'root' ? null : parentKey)} className="underline hover:no-underline">
            retry
          </button>
        </div>
      );
    }

    // Separate folders and items
    const folders = entry.children.filter((c) => c.type === 'folder');
    const items = entry.children.filter((c) => c.type === 'item');

    return (
      <>
        {folders.map((child) => {
          const childEntry = tree[child.id];
          const nodeData: TreeNodeData = {
            ...child,
            depth: depth + 1,
            isExpanded: childEntry?.expanded ?? false,
            isSelected: child.id === selectedFolderId,
            isLoading: childEntry?.loading ?? false,
          };
          return (
            <div key={child.id}>
              <TreeNode
                node={nodeData}
                onToggle={() => toggleFolder(child.id)}
                onClick={() => onSelectFolder(child.id)}
              />
              {renderChildren(child.id, depth + 1)}
            </div>
          );
        })}
        {items.map((item) => {
          const nodeData: TreeNodeData = {
            ...item,
            depth: depth + 1,
            isExpanded: false,
            isSelected: false,
            isLoading: false,
          };
          return (
            <TreeNode
              key={item.id}
              node={nodeData}
              onClick={() => onSelectItem(item.id)}
            />
          );
        })}
      </>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="shrink-0 p-2 border-r hover:bg-accent transition-colors"
        title="Open explorer"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="shrink-0 w-60 border-r flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        <button onClick={toggleOpen} className="p-1 text-muted-foreground hover:text-foreground rounded">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {/* Root "All" item */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-[11px] cursor-pointer hover:bg-accent/50 transition-colors',
            selectedFolderId === null && 'bg-accent font-medium',
          )}
          onClick={() => onSelectFolder(null)}
        >
          All {title === 'Explorer' ? 'Items' : title}
        </div>
        {renderChildren('root', -1)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/components/shared/tree-sidebar.tsx
git commit -m "feat(gui): add shared TreeSidebar component with lazy loading"
```

---

**Note:** `ContentTable` is not created in this phase. Both pages build their tables inline (Files reuses existing `DocumentTable`, Notes builds a custom table). A shared `ContentTable` can be extracted as a follow-up refactor once both pages are working.

---

## Chunk 3: Files page integration

### Task 8: Update Files `FolderItem` interface and rewire page to tree layout

**Files:**
- Modify: `apps/atlas-gui/src/app/(protected)/files/page.tsx`

This is the largest task — rewiring the entire Files page to use the new sidebar tree + content table layout while preserving all existing functionality (drag-drop, bulk actions, preview, rename, move, folder info).

- [ ] **Step 1: Rewrite the files page**

Replace `apps/atlas-gui/src/app/(protected)/files/page.tsx` with the new layout. Key changes:
- Add `TreeSidebar` on the left with `loadChildren` that calls `/api/v1/files/folders` + `/api/v1/files/documents`
- Keep `ContentTable` for the main content area (replace `DocumentTable` usage)
- Update `FolderItem` interface to include `isPublic`, `publicPermission`
- Keep all existing handlers (handleDelete, handleBulkDelete, handleBulkMove, handleRename, handleMove, handleCreateFolder, handleToggleFolderPublic, handleRenameFolder, handleDeleteFolder)
- Keep drag-and-drop upload on the content area
- Keep all dialogs/modals (PreviewModal, RenameDialog, MoveDialog, FolderInfoPanel)
- Replace breadcrumb-based navigation with sidebar tree selection
- Show breadcrumb only when sidebar is collapsed
- Remove ViewToggle (grid/list) — table is the only view now

The page should:
1. Import `TreeSidebar`, `TreeItem` from shared components
2. Define a `loadChildren` callback that fetches folders + documents for a parentId, merges them into `TreeItem[]`
3. Pass `selectedFolderId` (from URL `?folderId=`) to the sidebar
4. Content area: folder header with name/stats, search bar, folder rows + document table rows
5. Use the existing `DocumentTable` component for the content (keep it, don't replace with `ContentTable` yet — too much change at once)

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Upload, FolderPlus, Folder as FolderIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadFile } from '@/lib/api';
import { TreeSidebar, type TreeItem } from '@/components/shared/tree-sidebar';
import { VisibilityBadge } from '@/components/shared/visibility-badge';
import { BreadcrumbNav } from '@/components/files/breadcrumb-nav';
import { SearchBar } from '@/components/files/search-bar';
import { DocumentTable } from '@/components/files/document-table';
import type { DocumentItem } from '@/components/files/document-table';
import { EmptyState } from '@/components/files/empty-state';
import { BulkActionsBar } from '@/components/files/bulk-actions-bar';
import { PreviewModal } from '@/components/files/preview-modal';
import { RenameDialog } from '@/components/files/rename-dialog';
import { MoveDialog } from '@/components/files/move-dialog';
import { FolderInfoPanel } from '@/components/files/folder-info-panel';
import { formatSize } from '@/lib/utils';

interface FolderItem {
  id: string;
  name: string;
  isPublic?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
}

interface FolderDetail extends FolderItem {
  breadcrumb: { id: string; name: string }[];
}

interface FolderMeta {
  docCount: number;
  subfolderCount: number;
  totalSize: number;
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
  const [folderMeta, setFolderMeta] = useState<FolderMeta | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderDetail | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [moveDoc, setMoveDoc] = useState<DocumentItem | null>(null);
  const [infoFolderId, setInfoFolderId] = useState<string | null>(null);
  const [treeKey, setTreeKey] = useState(0);

  const [filters, setFilters] = useState({
    search: '',
    mimeType: '',
    dateFrom: '',
    dateTo: '',
    tags: [] as string[],
  });

  const [sort, setSort] = useState({ field: 'createdAt', order: 'desc' as 'asc' | 'desc' });

  // Load children for tree sidebar
  const loadTreeChildren = useCallback(async (parentId: string | null): Promise<TreeItem[]> => {
    const q = parentId ? `?parentId=${parentId}` : '';
    const [foldersRes, docsRes] = await Promise.all([
      api<{ data: FolderItem[] }>(`/api/v1/files/folders${q}`),
      api<ListResponse>(`/api/v1/files/documents?${new URLSearchParams({
        folderId: parentId ?? '',
        limit: '100',
        sortBy: 'name',
        sortOrder: 'asc',
      })}`),
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

  const loadFolders = useCallback(async () => {
    try {
      const q = folderId ? `?parentId=${folderId}` : '';
      const res = await api<{ data: FolderItem[] }>(`/api/v1/files/folders${q}`);
      setFolders(res.data);
    } catch {
      toast.error('Failed to load folders');
    }
  }, [folderId]);

  const loadBreadcrumb = useCallback(async () => {
    if (!folderId) { setBreadcrumb([]); setCurrentFolder(null); setFolderMeta(null); return; }
    try {
      const [folderRes, metaRes] = await Promise.all([
        api<{ data: FolderDetail }>(`/api/v1/files/folders/${folderId}`),
        api<{ data: FolderMeta }>(`/api/v1/files/folders/${folderId}/metadata`),
      ]);
      setBreadcrumb(folderRes.data.breadcrumb);
      setCurrentFolder(folderRes.data);
      setFolderMeta(metaRes.data);
    } catch {
      setBreadcrumb([]);
      setCurrentFolder(null);
      setFolderMeta(null);
    }
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

  useEffect(() => {
    loadFolders();
    loadBreadcrumb();
    loadTags();
  }, [loadFolders, loadBreadcrumb, loadTags]);

  useEffect(() => {
    loadDocs(1);
    setSelectedIds(new Set());
  }, [loadDocs]);

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
      await api(`/api/v1/files/documents/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      toast.success('Renamed');
      loadDocs(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to rename'); }
  };

  const handleMove = async (doc: DocumentItem, targetFolderId: string | null) => {
    try {
      await api(`/api/v1/files/documents/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ folderId: targetFolderId }) });
      toast.success('Moved');
      loadDocs(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to move'); }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      await api('/api/v1/files/folders', { method: 'POST', body: JSON.stringify({ name: trimmed, parentId: folderId }) });
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
      await api(`/api/v1/files/folders/${id}/public`, { method: 'PATCH', body: JSON.stringify({ isPublic }) });
      toast.success(isPublic ? 'Folder is now public' : 'Folder is now private');
      loadFolders();
      setTreeKey((k) => k + 1);
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api(`/api/v1/files/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      loadFolders();
      setTreeKey((k) => k + 1);
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

  // Drag-and-drop
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
    if (uploaded > 0) { toast.success(`${uploaded} file(s) uploaded`); loadDocs(page); loadTags(); setTreeKey((k) => k + 1); }
    if (uploaded < files.length) toast.error(`${files.length - uploaded} file(s) failed`);
  };

  const hasContent = folders.length > 0 || docs.length > 0;
  const hasFilters = filters.search || filters.mimeType || filters.dateFrom || filters.dateTo || filters.tags.length > 0;
  const showPath = !!(hasFilters && !folderId);
  const currentPath = breadcrumb.length > 0 ? '/' + breadcrumb.map((b) => b.name).join('/') : '/';

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
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
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

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {currentFolder ? currentFolder.name : 'All Files'}
            </h1>
            {currentFolder && (
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <VisibilityBadge isPublic={currentFolder.isPublic ?? false} permission={currentFolder.publicPermission} size="md" />
                {folderMeta && (
                  <>
                    <span>{folderMeta.docCount} files</span>
                    <span>{folderMeta.subfolderCount} subfolders</span>
                    <span>{formatSize(folderMeta.totalSize)}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { loadFolders(); loadDocs(page); setTreeKey((k) => k + 1); }} className="rounded-md border p-2 text-muted-foreground hover:text-foreground" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-medium active:bg-muted">
              <FolderPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
            <Link href={`/files/upload${folderId ? `?folderId=${folderId}` : ''}`} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground active:bg-primary/90">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </Link>
          </div>
        </div>

        <SearchBar filters={filters} onChange={setFilters} availableTags={availableTags} />

        {showNewFolder && (
          <div className="flex gap-2 items-center">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="Folder name"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <button onClick={handleCreateFolder} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Create</button>
            <button onClick={() => setShowNewFolder(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          </div>
        )}

        {selectedIds.size > 0 && (
          <BulkActionsBar count={selectedIds.size} onDelete={handleBulkDelete} onMove={handleBulkMove} onClear={() => setSelectedIds(new Set())} currentFolderId={folderId} />
        )}

        {/* Folder rows in content area */}
        {folders.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => navigateToFolder(folder.id)}
              >
                <FolderIcon className="h-4 w-4 text-warning shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{folder.name}</span>
                <VisibilityBadge isPublic={folder.isPublic ?? false} permission={folder.publicPermission} size="sm" />
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setInfoFolderId(folder.id)} className="p-1 text-muted-foreground hover:text-foreground text-xs">Info</button>
                  <button onClick={() => { const name = prompt('Rename folder:', folder.name); if (name) handleRenameFolder(folder.id, name); }} className="p-1 text-muted-foreground hover:text-foreground text-xs">Rename</button>
                  <button onClick={() => handleToggleFolderPublic(folder.id, !(folder.isPublic))} className="p-1 text-muted-foreground hover:text-foreground text-xs">
                    {folder.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                  <button onClick={() => handleDeleteFolder(folder.id)} className="p-1 text-destructive hover:text-destructive/80 text-xs">Delete</button>
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
                <button onClick={() => loadDocs(page - 1)} disabled={page <= 1} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
                <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
                <button onClick={() => loadDocs(page + 1)} disabled={page * 20 >= total} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
              </div>
            )}
          </>
        ) : (
          !hasContent && !hasFilters && <EmptyState preset={folderId ? 'empty-folder' : 'no-documents'} />
        )}

        {!hasContent && hasFilters && <EmptyState preset="no-results" />}

        {previewDoc && <PreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />}
        {renameDoc && <RenameDialog currentName={renameDoc.name} onConfirm={(name) => handleRename(renameDoc, name)} onClose={() => setRenameDoc(null)} />}
        {moveDoc && <MoveDialog documentName={moveDoc.name} currentFolderId={moveDoc.folderId ?? null} onConfirm={(targetId) => handleMove(moveDoc, targetId)} onClose={() => setMoveDoc(null)} />}
        {infoFolderId && <FolderInfoPanel folderId={infoFolderId} onClose={() => setInfoFolderId(null)} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify files page**

Run: `npm run dev:gui`
Navigate to `http://localhost:3000/files`
Expected: Sidebar tree on left, content area on right. Folders and documents load. Drag-drop, bulk actions, dialogs all work.

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-gui/src/app/\(protected\)/files/page.tsx
git commit -m "feat(gui): rewire Files page to sidebar tree + content table layout"
```

---

## Chunk 4: Notes page integration

### Task 9: Rewire Notes page to tree layout

**Files:**
- Modify: `apps/atlas-gui/src/app/(protected)/notes/page.tsx`

Same pattern as Files, but with notes-specific columns (size, attachments, visibility, author, updated) and AI search.

- [ ] **Step 1: Rewrite the notes page**

Replace `apps/atlas-gui/src/app/(protected)/notes/page.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, FolderPlus, Folder as FolderIcon, FileText, RefreshCw, Eye, MoreVertical, Pencil, Trash2, Bot, Globe, Lock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TreeSidebar, type TreeItem } from '@/components/shared/tree-sidebar';
import { VisibilityBadge } from '@/components/shared/visibility-badge';
import { SearchBar } from '@/components/notes/search-bar';
import { formatSize, formatDate } from '@/lib/utils';

interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isPublic?: boolean;
  contentSize?: number;
  ownerName?: string;
  attachments?: { documentId: string; filename: string; mimeType: string; size: number }[];
}

interface FolderItem {
  id: string;
  name: string;
  aiAccessible: boolean;
  visibility?: string;
  publicPermission?: 'view' | 'edit' | 'full';
  noteCount?: number;
  totalSize?: number;
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

type PublicPermission = 'view' | 'edit' | 'full';

export default function NotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId') || null;

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [currentFolder, setCurrentFolder] = useState<FolderDetail | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [treeKey, setTreeKey] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<{ folder: FolderItem; x: number; y: number } | null>(null);
  const [showPermissionPicker, setShowPermissionPicker] = useState<string | null>(null);

  // Load children for tree sidebar
  const loadTreeChildren = useCallback(async (parentId: string | null): Promise<TreeItem[]> => {
    const q = parentId ? `?parentId=${parentId}` : '';
    const [foldersRes, notesRes] = await Promise.all([
      api<{ data: FolderItem[] }>(`/api/v1/notes/folders${q}`),
      api<ListResponse>(`/api/v1/notes?${new URLSearchParams({
        folderId: parentId ?? '',
        limit: '100',
        sortBy: 'title',
        sortOrder: 'asc',
      })}`),
    ]);

    const folderItems: TreeItem[] = foldersRes.data.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'folder' as const,
      itemCount: f.noteCount,
      totalSize: f.totalSize,
      isPublic: f.visibility === 'public',
      publicPermission: f.publicPermission,
    }));

    const noteItems: TreeItem[] = notesRes.data.map((n) => ({
      id: n.id,
      name: n.title,
      type: 'item' as const,
      size: n.contentSize ?? 0,
    }));

    return [...folderItems, ...noteItems];
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const q = folderId ? `?parentId=${folderId}` : '';
      const res = await api<{ data: FolderItem[] }>(`/api/v1/notes/folders${q}`);
      setFolders(res.data);
    } catch { toast.error('Failed to load folders'); }
  }, [folderId]);

  const loadCurrentFolder = useCallback(async () => {
    if (!folderId) { setCurrentFolder(null); return; }
    try {
      const res = await api<{ data: FolderDetail }>(`/api/v1/notes/folders/${folderId}`);
      setCurrentFolder(res.data);
    } catch { setCurrentFolder(null); }
  }, [folderId]);

  const loadNotes = useCallback(async (p: number) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', '20');
      if (folderId) params.set('folderId', folderId);
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');

      const res = await api<ListResponse>(`/api/v1/notes?${params}`);
      setNotes(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch { toast.error('Failed to load notes'); }
  }, [folderId]);

  useEffect(() => {
    loadFolders();
    loadCurrentFolder();
  }, [loadFolders, loadCurrentFolder]);

  useEffect(() => {
    setSearchResults(null);
    loadNotes(1);
  }, [loadNotes]);

  const navigateToFolder = (id: string | null) => {
    const params = new URLSearchParams();
    if (id) params.set('folderId', id);
    router.push(`/notes${params.toString() ? `?${params}` : ''}`);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api('/api/v1/notes/folders', { method: 'POST', body: JSON.stringify({ name: newFolderName.trim(), parentId: folderId }) });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolders();
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to create folder'); }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      loadFolders();
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to rename folder'); }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'DELETE' });
      loadFolders();
      setTreeKey((k) => k + 1);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete folder'); }
  };

  const handleToggleAi = async (id: string, current: boolean) => {
    try {
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ aiAccessible: !current }) });
      loadFolders();
      setTreeKey((k) => k + 1);
      toast.success(`AI access ${current ? 'disabled' : 'enabled'}`);
    } catch { toast.error('Failed to toggle AI access'); }
  };

  const handleTogglePublic = async (id: string, isPublic: boolean, publicPermission?: string) => {
    try {
      const body: Record<string, unknown> = { visibility: isPublic ? 'public' : 'private' };
      if (publicPermission) body.publicPermission = publicPermission;
      await api(`/api/v1/notes/folders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      loadFolders();
      setTreeKey((k) => k + 1);
      toast.success(isPublic ? 'Folder is now public' : 'Folder is now private');
    } catch { toast.error('Failed to update visibility'); }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api(`/api/v1/notes/${id}`, { method: 'DELETE' });
      toast.success('Note deleted');
      loadNotes(page);
      setTreeKey((k) => k + 1);
    } catch { toast.error('Failed to delete'); }
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

  const totalPages = Math.ceil(total / 20);
  const displayNotes = searchResults ? searchResults.map((r) => r.note) : notes;

  const attachmentSummary = (note: NoteItem) => {
    const atts = note.attachments ?? [];
    if (atts.length === 0) return '0';
    const totalSize = atts.reduce((sum, a) => sum + (a.size || 0), 0);
    return `${atts.length} (${formatSize(totalSize)})`;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <TreeSidebar
        key={treeKey}
        storageKey="notes"
        selectedFolderId={folderId}
        onSelectFolder={navigateToFolder}
        onSelectItem={(id) => router.push(`/notes/${id}`)}
        loadChildren={loadTreeChildren}
        title="Notes"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {currentFolder ? currentFolder.name : 'All Notes'}
            </h1>
            {currentFolder && (
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <VisibilityBadge isPublic={currentFolder.visibility === 'public'} permission={currentFolder.publicPermission} size="md" />
                {currentFolder.aiAccessible && (
                  <span className="flex items-center gap-1 text-success"><Bot className="h-3 w-3" /> AI</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { loadFolders(); loadNotes(page); setTreeKey((k) => k + 1); }} className="rounded-md border p-2 text-muted-foreground hover:text-foreground" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent">
              <FolderPlus className="h-4 w-4" /> Folder
            </button>
            <Link href={`/notes/new${folderId ? `?folderId=${folderId}` : ''}`} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New Note
            </Link>
          </div>
        </div>

        <SearchBar onSearch={handleSearch} />

        {showNewFolder && (
          <div className="flex items-center gap-2">
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="Folder name" autoFocus className="rounded-md border bg-background px-3 py-1.5 text-sm" />
            <button onClick={handleCreateFolder} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Create</button>
            <button onClick={() => setShowNewFolder(false)} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
          </div>
        )}

        {searchResults && (
          <p className="text-sm text-muted-foreground">{searchResults.length} semantic result{searchResults.length !== 1 ? 's' : ''}</p>
        )}

        {/* Folder rows */}
        {folders.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => navigateToFolder(folder.id)}
              >
                <FolderIcon className="h-4 w-4 text-warning shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{folder.name}</span>
                {folder.noteCount !== undefined && (
                  <span className="text-xs text-muted-foreground">{folder.noteCount} notes · {formatSize(folder.totalSize ?? 0)}</span>
                )}
                <VisibilityBadge isPublic={folder.visibility === 'public'} permission={folder.publicPermission} size="sm" />
                {folder.aiAccessible && <Bot className="h-3.5 w-3.5 text-success" title="AI accessible" />}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleToggleAi(folder.id, folder.aiAccessible)} className="p-1 text-muted-foreground hover:text-foreground" title={folder.aiAccessible ? 'Disable AI' : 'Enable AI'}>
                    <Bot className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { const name = prompt('Rename folder:', folder.name); if (name) handleRenameFolder(folder.id, name); }} className="p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleTogglePublic(folder.id, folder.visibility !== 'public')} className="p-1 text-muted-foreground hover:text-foreground">
                    {folder.visibility === 'public' ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => handleDeleteFolder(folder.id)} className="p-1 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes table */}
        {displayNotes.length > 0 ? (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Name</th>
                  <th className="p-3 whitespace-nowrap">Size</th>
                  <th className="p-3 whitespace-nowrap">Attachments</th>
                  <th className="p-3 whitespace-nowrap">Visibility</th>
                  <th className="p-3 whitespace-nowrap">Author</th>
                  <th className="p-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => loadNotes(1)}>Updated</th>
                  <th className="p-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {displayNotes.map((note) => (
                  <tr
                    key={note.id}
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/notes/${note.id}`)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate max-w-xs">{note.title}</span>
                        {note.tags.length > 0 && (
                          <div className="hidden sm:flex gap-1 ml-2">
                            {note.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{tag}</span>
                            ))}
                            {note.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{note.tags.length - 2}</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{formatSize(note.contentSize ?? 0)}</td>
                    <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{attachmentSummary(note)}</td>
                    <td className="p-3">
                      <VisibilityBadge isPublic={note.isPublic ?? false} size="sm" />
                    </td>
                    <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{note.ownerName ?? 'me'}</td>
                    <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(note.updatedAt)}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Link href={`/notes/${note.id}`} className="p-1 text-muted-foreground hover:text-foreground" title="View">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button onClick={() => handleDeleteNote(note.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !searchResults && folders.length === 0 && (
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
            <button disabled={page <= 1} onClick={() => loadNotes(page - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => loadNotes(page + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify notes page**

Run: `npm run dev:gui` (if not already running) + `npm run dev:notes`
Navigate to `http://localhost:3000/notes`
Expected: Sidebar tree on left with folders + notes, content table on right with metadata columns. Search, folder CRUD, note navigation all work.

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-gui/src/app/\(protected\)/notes/page.tsx
git commit -m "feat(gui): rewire Notes page to sidebar tree + content table layout"
```

---

## Chunk 5: Cleanup

### Task 10: Remove obsolete components and verify

**Files:**
- Delete: `apps/atlas-gui/src/components/notes/folder-card.tsx`
- Delete: `apps/atlas-gui/src/components/notes/note-card.tsx`
- Delete: `apps/atlas-gui/src/components/notes/view-toggle.tsx`
- Delete: `apps/atlas-gui/src/components/files/folder-card.tsx`

- [ ] **Step 1: Verify no other imports reference these files**

Search for imports of the files to remove:

```bash
grep -r "notes/folder-card" apps/atlas-gui/src/ --include="*.tsx" --include="*.ts"
grep -r "notes/note-card" apps/atlas-gui/src/ --include="*.tsx" --include="*.ts"
grep -r "notes/view-toggle" apps/atlas-gui/src/ --include="*.tsx" --include="*.ts"
grep -r "files/folder-card" apps/atlas-gui/src/ --include="*.tsx" --include="*.ts"
```

Expected: Only the old page files (already replaced) should reference them. If other files import them, update those first.

- [ ] **Step 2: Delete obsolete files**

```bash
rm apps/atlas-gui/src/components/notes/folder-card.tsx
rm apps/atlas-gui/src/components/notes/note-card.tsx
rm apps/atlas-gui/src/components/notes/view-toggle.tsx
rm apps/atlas-gui/src/components/files/folder-card.tsx
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck` from project root.
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(gui): remove obsolete folder-card, note-card, view-toggle components"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Expected: Clean, no errors.

- [ ] **Step 2: Manual smoke test — Files**

Navigate to `/files`:
- Sidebar tree loads with folders and files
- Clicking folder in tree selects it and loads content
- Expanding/collapsing folders works, state persists across reload
- Sidebar collapse/expand via hamburger works
- Folder actions: create, rename, delete, toggle public, folder info
- Document actions: preview, download, rename, move, delete
- Bulk select + bulk delete/move
- Drag-and-drop upload
- Search with filters
- Pagination

- [ ] **Step 3: Manual smoke test — Notes**

Navigate to `/notes`:
- Sidebar tree loads with folders and notes
- Clicking folder in tree selects it and loads content
- Notes table shows: name, size, attachments, visibility, author, updated
- Folder rows show: name, note count, size, visibility, AI badge
- Folder actions: create, rename, delete, toggle AI, toggle public
- Note actions: view, delete
- Full-text and semantic search
- New note creation
- Pagination

- [ ] **Step 4: Polish — add missing features found during smoke test**

During smoke testing, address these known gaps and commit each fix:

1. **Breadcrumb fallback when sidebar collapsed:** Both pages should render `BreadcrumbNav` (Files) or a simple breadcrumb (Notes) above the content table when the sidebar is hidden. Check if sidebar is closed via the same localStorage key, and conditionally render breadcrumb.

2. **Notes bulk actions:** Add checkboxes to the notes table, `BulkActionsBar` import from `@/components/files/bulk-actions-bar`, and `handleBulkDelete` handler that calls `DELETE /api/v1/notes/:id` for each selected note. The Notes API has no bulk delete endpoint, so delete sequentially.

3. **Notes context menu:** Import `ContextMenu` from `@/components/files/context-menu` and adapt it for notes (remove download/rename/move actions that don't apply, keep preview/details/delete). Add `onContextMenu` handler to note table rows.

4. **Notes folder metadata in header:** Call `GET /api/v1/notes/folders/:id/metadata` (added in Task 2) and display note count, subfolder count, and total size in the folder header alongside the visibility badge.

5. **Files folder rename:** Replace `prompt()` calls with the existing `RenameDialog` component for folder renaming (same as document rename).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix(gui): polish tree view — breadcrumb fallback, bulk actions, context menu"
```
