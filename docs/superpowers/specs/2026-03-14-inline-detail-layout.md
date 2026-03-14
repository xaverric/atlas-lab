# Inline Detail & Folder-Oriented Navigation

Fix notes/files layout to show details inline within the tree view layout, make navigation folder-oriented, and fix editor bugs.

## Changes

### 1. Notes: Inline Detail

**Current:** Clicking a note navigates to `/notes/[id]` — a completely separate page without tree sidebar or breadcrumbs.

**Target:** Clicking a note loads the detail/editor in the content area of `/notes` page. Tree sidebar stays, breadcrumbs stay, URL becomes `/notes?folderId=X&noteId=Y`.

Implementation:
- Add `noteId` search param to notes page
- When `noteId` is set, render the note detail view (view/edit mode, history drawer, attachments) in the content area instead of the notes table
- The existing `/notes/[id]/page.tsx` logic moves into a new `NoteDetail` component that can be embedded
- Tree sidebar highlights the active note
- Back button / clicking a folder in tree returns to the table view (clears `noteId` param)
- Keep `/notes/[id]` route working for direct links — redirect to `/notes?noteId=id` (or render with a wrapper)

### 2. Files: Inline Detail

**Current:** Files already has `DetailModal` that opens as an overlay. But tree sidebar `onSelectItem` opens it too.

**Target:** Consistent with notes — clicking a file in tree or table loads the detail in the content area. URL becomes `/files?folderId=X&docId=Y`.

Implementation:
- Add `docId` search param to files page
- When `docId` is set, render the file detail view in the content area (preview, metadata, share, download, edit tags)
- The existing `DetailModal` content can be refactored into an inline `FileDetail` component
- Keep `/files/[id]` route for direct links — redirect to `/files?docId=id`

### 3. Folder-Oriented Navigation

**Current:** Root view shows "All Notes" / "All Files" which displays all root-level items. Confusing.

**Target:** Root behaves like a regular folder. No "All" label.

Changes:
- TreeSidebar: remove "All Notes" / "All Files" clickable row
- When no folder selected: show root folder content (items with `folderId: null`)
- Header shows "Root" or app section name instead of "All Notes"
- No conceptual difference between root and subfolders

### 4. Tree vs Breadcrumbs Toggle

**Current:** Both tree sidebar and breadcrumbs shown simultaneously — duplicated info.

**Target:** Show one or the other:
- Sidebar open → no breadcrumbs
- Sidebar collapsed → breadcrumbs visible
- The sidebar open/closed state is already tracked in localStorage

Changes in both pages:
- Read sidebar open state from localStorage (same key TreeSidebar uses: `${storageKey}-sidebar-open`)
- Conditionally render breadcrumbs: only when sidebar is closed
- TreeSidebar already handles its own toggle, just need to sync the state

### 5. Editor Fixes

**CodeMirror dark theme in markdown mode:** CodeMirror uses `oneDark` theme unconditionally. When the app is in light mode, this looks wrong.

Fix: Create a light theme or use the `EditorView.theme` to match the app's current theme. Check if `document.documentElement.classList.contains('dark')` and conditionally apply oneDark.

**TipTap content not syncing:** When switching from markdown back to WYSIWYG, the TipTap editor doesn't update its internal state because `useEditor` only sets content on mount.

Fix: Add `useEffect` in tiptap-editor.tsx that calls `editor.commands.setContent(content)` when the `content` prop changes (guarded to avoid loops).

### 6. Tree Sidebar: Highlight Active Item

Currently tree highlights only the selected folder. Need to also highlight the active note/file when viewing detail.

Add `selectedItemId` prop to TreeSidebar. In `renderChildren`, mark item nodes with `isSelected: item.id === selectedItemId`.

## File Changes

### New components:
```
apps/atlas-gui/src/components/notes/note-detail.tsx    — extracted from [id]/page.tsx, embeddable
apps/atlas-gui/src/components/files/file-detail.tsx    — extracted from detail-modal.tsx, embeddable
```

### Modified:
```
apps/atlas-gui/src/app/(protected)/notes/page.tsx      — add noteId param, render NoteDetail inline
apps/atlas-gui/src/app/(protected)/files/page.tsx      — add docId param, render FileDetail inline
apps/atlas-gui/src/components/shared/tree-sidebar.tsx   — remove "All" row, add selectedItemId prop
apps/atlas-gui/src/components/shared/codemirror-editor.tsx — fix theme for light mode
apps/atlas-gui/src/components/notes/tiptap-editor.tsx  — fix content sync on prop change
```

### Redirects:
```
apps/atlas-gui/src/app/(protected)/notes/[id]/page.tsx — redirect to /notes?noteId=id
apps/atlas-gui/src/app/(protected)/files/[id]/page.tsx — redirect to /files?docId=id
```
