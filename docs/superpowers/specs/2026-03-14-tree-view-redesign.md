# Tree View Redesign: Notes & Files

Unified sidebar tree + content table layout for both Notes and File Storage sections. Replaces the current flat folder-cards + item-list with a hierarchical explorer pattern.

## Current State

Both sections use the same pattern:
- Folder cards displayed as a grid at the top
- Items (notes/files) listed below as cards or table rows
- Breadcrumb navigation for folder hierarchy
- No way to see full hierarchy at once
- Missing metadata: size, attachment info, visibility, author

**Pain points:**
- Root view shows all items regardless of folder — no clear hierarchy
- Must click into each folder to see contents
- Public/private status hidden behind context menus
- No size, attachment count, or author information visible

## Design

### Layout: Sidebar Tree + Content Table

Two-panel layout with a persistent sidebar tree on the left and a content table on the right.

**Sidebar (left panel, ~240px):**
- Full tree showing both folders and individual items (notes/files)
- Each folder row shows: expand/collapse arrow, folder icon, name, item count, total size
- Each item row shows: type icon, name, size
- Visibility indicators on folders:
  - Blue left border + globe badge with permission level (`view`, `edit`, `full`) for public
  - Gray left border + lock badge for private
- Clicking a folder in the tree selects it and loads its contents in the content table
- Clicking an item navigates to its detail page
- Selected folder row highlighted
- "Explorer" header with hamburger toggle button
- Collapsible: hamburger button toggles sidebar visibility, hidden by default on mobile (< md breakpoint)

**Content table (right panel):**
- Header: folder name, visibility badge, summary stats (item count, subfolder count, total size)
- Action buttons: + Folder, + New Note (notes) / Upload (files)
- Search bar (notes section includes AI search toggle)
- Checkbox column for bulk selection
- Table with sortable columns and the following structure:

Notes columns:
| Checkbox | Name | Size | Attachments | Visibility | Author | Updated | Actions |
|----------|------|------|-------------|------------|--------|---------|---------|

- Size = markdown content byte size (computed server-side via aggregation)
- Attachments = count (total attachment size), e.g. "2 (1.1 MB)"
- Visibility = globe/lock icon, public items show permission level
- Author = owner display name, "me" for current user

Files columns:
| Checkbox | Name | Type | Size | Tags | Visibility | Uploaded | Actions |
|----------|------|------|------|------|------------|----------|---------|

- Type = mime type short label (pdf, png, docx)
- Tags = tag badges
- Visibility = same pattern as notes

**Actions column:**
- Inline icons on hover: preview (eye), download (arrow) — shown for applicable items
- Three-dot menu with: rename, move, delete, toggle public, copy link, folder info
- Notes-specific: toggle AI accessible (on folders)
- Right-click context menu with same actions

**Bulk actions bar:** appears above table when items are selected — bulk delete, bulk move, clear selection. Reuses existing `BulkActionsBar` from Files.

**Folder rows in content table:**
- Folder icon + name + child count badge, e.g. "API Docs (3)"
- Single-click navigates into that folder (updates sidebar selection + content)
- Visibility column shows inherited or own permission

**Item rows in content table:**
- Single-click navigates to detail page (same as current behavior)

### Existing Features Preserved

**Drag-and-drop upload (Files only):**
- Drop zone covers the content table area
- Dropping on a folder row in the tree sidebar uploads into that folder
- Same overlay indicator as current ("Drop files to upload")

**Modals and dialogs — kept as-is:**
- `PreviewModal` — triggered from inline preview icon or context menu
- `RenameDialog` — triggered from context menu
- `MoveDialog` — triggered from context menu or bulk actions
- `FolderInfoPanel` — triggered from context menu "Folder Info" action, displayed as slide-over panel

**Grid/list view toggle:** removed. The tree + table layout replaces both views with a single unified pattern. The table is the primary view; the sidebar tree provides the visual hierarchy that the grid view previously attempted.

**Notes AI accessible toggle:** preserved in folder context menu and three-dot menu.

### Shared Components

Both sections use the same underlying components with different column configurations:

- `TreeSidebar` — renders the folder/item tree, handles expand/collapse state, emits selection events
- `TreeNode` — single tree row (folder or item) with indentation, icons, metadata
- `ContentTable` — generic sortable table with column config, inline actions, context menu, checkbox selection
- `VisibilityBadge` — normalizes visibility across Notes (`visibility: 'private' | 'public'`) and DMS (`isPublic: boolean`) into a single component with globe/lock icon + permission text

### Sidebar Behavior

- **Desktop (>= md):** sidebar visible by default, toggleable via hamburger
- **Mobile (< md):** sidebar hidden by default, opens as a slide-over panel from the left
- Sidebar open/closed state persisted in localStorage (`notes-sidebar-open`, `files-sidebar-open`)
- Tree expand/collapse state per folder persisted in localStorage (`notes-tree-state`, `files-tree-state`)
- When sidebar is collapsed on desktop: content table takes full width, breadcrumb navigation shown above table for folder context

### URL Routing

Folder selection is URL-based via `?folderId=` search param (same as current). This preserves:
- Deep linking to specific folders
- Browser back/forward navigation
- Shareable URLs

Clicking a folder in the sidebar or content table updates the URL. Tree expand/collapse state is local-only (not in URL).

### Data Requirements

**Visibility model normalization:**

Notes uses `visibility: 'private' | 'public'` + `publicPermission` on folders, and `isPublic` on individual notes.
DMS uses `isPublic: boolean` + `publicPermission` on folders (no per-document visibility).

The `VisibilityBadge` component accepts a normalized prop: `{ isPublic: boolean, permission?: 'view' | 'edit' | 'full' }`. Each page maps its backend model to this shape.

**Notes API (`atlas-notes`) changes:**
- Add `GET /folders/:id/metadata` endpoint returning `{ noteCount, subfolderCount, totalSize }` — used by content table header for summary stats
- Add `noteCount` and `totalSize` inline to `GET /folders` list response via `$lookup` aggregation pipeline — used by sidebar tree for count/size badges (avoids N+1 per-folder metadata calls)
- Owner name resolution: call atlas-core `GET /users/:id` for display names. Forward the user's JWT from the original request (notes service already has it via `req.auth`). Cache resolved names in-memory (Map with 5min TTL). Return `ownerName` alongside `ownerId` in note list response. Requires adding `CORE_URL` config (`process.env.CORE_URL || 'http://localhost:4000'`) to `apps/atlas-notes/src/config/index.ts`.
- Add `contentSize` field to Note model schema, computed on save via `Buffer.byteLength(content, 'utf8')`. This avoids expensive aggregation over content fields. Returned in list response.

**Files API (`atlas-dms`) changes:**
- No backend changes needed. `isPublic` and `publicPermission` are already on the Folder schema and returned in list responses. Only the frontend `FolderItem` TypeScript interface needs updating to include these fields.
- Folder metadata endpoint (`GET /folders/:id/metadata`) already exists and returns `docCount`, `subfolderCount`, `totalSize`.

**Tree loading strategy:**
- Load root-level folders + items on mount
- Lazy-load children when a folder is expanded (fetch subfolders + items for that parentId)
- Cache expanded folder data to avoid re-fetching on collapse/expand
- Folder metadata (counts, sizes) loaded inline with folder list response
- Loading state: skeleton rows while children load
- Error state: "Failed to load" text with retry button on the failed tree node

### File Structure

New shared components:
```
src/components/shared/
  tree-sidebar.tsx        — sidebar container with header, toggle, scroll
  tree-node.tsx           — single tree row (folder or item variant)
  content-table.tsx       — generic sortable table with column definitions
  visibility-badge.tsx    — public/private indicator with permission level
```

Updated pages:
```
src/app/(protected)/notes/page.tsx   — replace flat layout with tree + table
src/app/(protected)/files/page.tsx   — replace flat layout with tree + table
```

Components to remove (replaced by shared ones):
```
src/components/notes/folder-card.tsx
src/components/notes/note-card.tsx
src/components/notes/view-toggle.tsx
src/components/files/folder-card.tsx
```

Components to keep and adapt:
```
src/components/files/document-table.tsx  — refactor column logic into shared content-table, keep file-specific rendering
src/components/files/context-menu.tsx    — reuse for both sections, extend with notes-specific actions
src/components/files/bulk-actions-bar.tsx — reuse as-is for both sections
src/components/files/preview-modal.tsx   — keep, triggered from content table
src/components/files/rename-dialog.tsx   — keep, triggered from context menu
src/components/files/move-dialog.tsx     — keep, triggered from context menu
src/components/files/folder-info-panel.tsx — keep, triggered from context menu
src/components/notes/search-bar.tsx      — keep, embed in content area
src/components/files/search-bar.tsx      — keep, embed in content area
```

### Backend Changes

**atlas-notes:**
- Add `GET /folders/:id/metadata` → `{ noteCount, subfolderCount, totalSize }` via MongoDB aggregation
- Add `noteCount` and `totalSize` fields to `GET /folders` list response (aggregate pipeline)
- Add `ownerName` to `GET /notes` list response (resolve via atlas-core user lookup with in-memory cache)
- Add `contentSize` field to note list response (computed server-side)

**atlas-dms:**
- No backend changes. Update frontend `FolderItem` interface only.

### Edge Cases

- Empty folders: show empty state in content table, folder still visible in tree with count 0
- Deep nesting (>5 levels): tree indentation caps at max-indent (5 levels = 80px), tooltip shows full path
- Large trees (100+ folders): lazy loading prevents loading entire tree at once
- Root-level items (no folder): shown at bottom of tree under "Unfiled" separator. Clicking the separator clears `?folderId=` and shows all root-level items in content table. Header shows "All Notes" / "All Files"
- Sidebar collapsed: content table takes full width, breadcrumb shown above table for navigation context
- Public permission inheritance: child folders inherit parent's public status, shown as "inherited" badge variant (dimmer color). Backend already resolves inheritance via parent walk.
- Stale data: no real-time sync. User can manually refresh via a refresh button in the content table header. Tree re-fetches children on next expand after collapse.
- Browser back/forward: works via URL-based `?folderId=` routing
- Search scoping: search applies to currently selected folder (matches current behavior). Clear folder selection to search globally.
