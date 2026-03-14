# 02 — Notes Enhancements

## Current State

- `atlas-notes` service with full CRUD for notes and folders
- Notes stored as markdown in MongoDB, TipTap editor works with HTML (convert via turndown/showdown)
- Vector search via Qdrant + Ollama (nomic-embed-text, 768 dims)
- AI search endpoint with API key auth (`X-Api-Key`)
- GUI: note editor, folder tree, search
- Models: `Note` (title, content, folderId, userId, tags, metadata), `NoteFolder` (name, parentId, userId)

## Goals

### 1. Improved Editor UX — View/Edit Mode Split

**Current problem:** Notes open in edit mode immediately. User wants view-first experience.

**Requirements:**
- Default view: rendered markdown/HTML (read-only)
- "Edit" button to enter edit mode (TipTap editor)
- "Save" and "Cancel" buttons in edit mode
- Keyboard shortcut: `Ctrl+E` to toggle edit mode
- Unsaved changes warning on navigation

**Files to modify:**

`apps/atlas-gui/src/app/(protected)/notes/` — note detail page:
- Add `isEditing` state, default `false`
- View mode: render HTML content (already converted from markdown)
- Edit mode: mount TipTap editor
- Toolbar with Edit/Save/Cancel buttons

`apps/atlas-gui/src/components/notes/` — editor components:
- Extract view component (`note-viewer.tsx`) — renders HTML with proper styling
- Keep editor component (`note-editor.tsx`) — TipTap with toolbar
- Add `note-detail-header.tsx` — title, metadata, edit/save/cancel buttons

**View mode styling:**
- Proper markdown rendering: headings, code blocks, tables, lists, links
- Image display (once attachments are implemented)
- Metadata bar: created date, last modified, tags, folder path

### 2. Public/Private Folder Visibility

**Requirements:**
- Each `NoteFolder` has a `visibility` field: `'private'` (default) or `'public'`
- Visibility is inherited: if a folder is public, all child folders and notes are public
- Root folder must always be private (enforced at API level)
- Public notes are accessible without authentication via special route
- Public notes are still scoped to the owner — other logged-in users don't see them in their own tree (see 01-authorization)

**Model changes:**

`apps/atlas-notes/src/models/NoteFolder.ts`:
```
// Add to schema
visibility: {
  type: String,
  enum: ['private', 'public'],
  default: 'private'
}
```

**Service logic:**

`apps/atlas-notes/src/services/noteFolderService.ts`:
- On `update` — if setting root folder to public → throw ApiError 400
- On `update` — if setting folder to public, all descendants inherit (or resolve at query time)
- Add `isPublic(folderId)` method — walk up parent chain, return true if any ancestor (or self) is public

`apps/atlas-notes/src/services/noteService.ts`:
- On `get` — if note's folder (or ancestor) is public, allow unauthenticated access
- Add resolution logic: check folder visibility chain

**New public routes:**

`apps/atlas-notes/src/routes/public.ts`:
```
GET /public/notes/:id          — get public note (no auth)
GET /public/folders/:id        — list public folder contents (no auth)
GET /public/folders/:id/tree   — get public folder tree (no auth)
```

**Middleware:** Create `optionalAuth` middleware — tries to verify JWT but doesn't fail if missing. If authenticated, return full data; if not, only return public content.

**GUI:**
- Folder context menu: "Make Public" / "Make Private" toggle
- Visual indicator on public folders (icon badge or color)
- Public note view: shareable URL, clean read-only page without app shell
- New route: `apps/atlas-gui/src/app/public/notes/[id]/page.tsx` — renders note without auth requirement, minimal layout

### 3. File/Image Attachments via DMS

**Requirements:**
- Notes can reference files and images stored in DMS
- Upload from note editor → file goes to DMS → reference stored in note
- Images render inline in view mode
- Files show as download links
- Each note has a dedicated DMS folder (auto-created)

**Architecture:**

Notes service doesn't store files — it references DMS documents by ID. The GUI handles the upload flow.

**Flow:**
1. User inserts image/file in editor
2. GUI uploads to DMS via `POST /api/v1/dms/documents` (with folder = note's attachment folder)
3. DMS returns document ID and presigned URL
4. GUI inserts reference into note content:
   - Images: `![alt](presigned-url)` or custom TipTap node
   - Files: `[filename](presigned-url)` with download attribute

**Model changes:**

`apps/atlas-notes/src/models/Note.ts`:
```
// Add to schema
attachments: [{
  documentId: { type: String, required: true },  // DMS document ID
  filename: String,
  mimeType: String,
  size: Number
}],
dmsFolderId: String  // dedicated DMS folder for this note's attachments
```

**Service changes:**

`apps/atlas-notes/src/services/noteService.ts`:
- On `create` — optionally create a DMS folder for attachments (lazy, on first upload)
- On `delete` — optionally clean up DMS folder and its contents
- Add `addAttachment(noteId, documentId, metadata)` and `removeAttachment(noteId, documentId)`

**API additions:**

`apps/atlas-notes/src/routes/note.ts`:
```
POST   /api/v1/notes/:id/attachments     — add attachment reference
DELETE /api/v1/notes/:id/attachments/:docId — remove attachment reference
GET    /api/v1/notes/:id/attachments      — list attachments
```

**GUI — TipTap extensions:**

`apps/atlas-gui/src/components/notes/`:
- Add image upload button to editor toolbar
- Add file attachment button
- Custom TipTap node for DMS-backed images (stores documentId, resolves to presigned URL)
- Drag & drop support for images
- Paste image from clipboard → upload to DMS → insert

**Cross-service communication:**
- Notes GUI → DMS API (upload file, get presigned URL)
- Notes API stores only the reference (documentId)
- On note view, GUI fetches presigned URLs from DMS for rendering

### 4. AI Agent Knowledge Base Access

**Current:** AI search via `X-Api-Key` on `GET /api/v1/notes/ai/search` — searches all notes.

**Requirements:**
- Ability to restrict AI agent access to specific folders only
- AI agent can read notes in those folders as its knowledge base
- Configuration: which folders are AI-accessible (not just public/private)

**Implementation:**

`apps/atlas-notes/src/models/NoteFolder.ts`:
```
// Add to schema
aiAccessible: { type: Boolean, default: false }
```

`apps/atlas-notes/src/services/searchService.ts`:
- When search comes via `X-Api-Key` (AI), filter results to only notes in `aiAccessible` folders
- Qdrant metadata filtering: store `folderId` and `aiAccessible` flag in Qdrant payload
- On vector upsert, include folder metadata so filtering happens at Qdrant level (efficient)

**API:**
```
PUT /api/v1/notes/folders/:id  — update folder, include aiAccessible flag
```

**GUI:**
- Folder settings: "Allow AI access" checkbox
- Visual indicator for AI-accessible folders

## Implementation Order

1. **View/Edit mode split** — UI only, no backend changes
2. **Public/private visibility** — model change + new routes + public GUI page
3. **Attachments via DMS** — cross-service, needs DMS API ready
4. **AI folder access** — Qdrant metadata update + search filtering

## Dependencies

- Attachments depend on DMS being stable and accessible from notes GUI
- Public notes depend on 01-authorization (user isolation) being in place first
- AI access depends on Qdrant payload schema — need to re-embed notes with folder metadata
