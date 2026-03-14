# Notes Editor Redesign + Scheduler Code Highlighting

Upgrade the notes editor to a full WYSIWYG experience with markdown backend, inline DMS attachments, version history, and CodeMirror for code. Fix scheduler job code display.

## Scope

Three independent workstreams in one spec:
1. **Notes editor** — WYSIWYG with markdown, inline images, CodeMirror code blocks, markdown edit mode
2. **Note version history** — snapshot on every save, restore to any version
3. **Scheduler code highlighting** — CodeMirror in job detail config display
4. **Attachment → Files link** — "Open in Files" from note attachments

## 1. Notes Editor

### Current State

TipTap editor with basic toolbar (bold, italic, headings, lists, code, links). Content stored as markdown in MongoDB. On load: markdown → HTML (showdown). On save: HTML → markdown (turndown). Attachments are a separate list below content. No inline images from DMS.

### Target State

**WYSIWYG mode (default):**
- TipTap editor with extended toolbar: bold, italic, strikethrough, inline code, H1/H2/H3, bullet list, ordered list, task list, link, image, code block, horizontal rule, blockquote
- Code blocks rendered via CodeMirror extension inside TipTap (language selector per block)
- DMS images displayed inline with "DMS Attachment" badge and "Open in Files" link
- External images via URL supported normally
- Toolbar button "Image" opens a picker: choose from DMS attachments or paste external URL

**Markdown mode (toggle):**
- "View Markdown" button in toolbar toggles to raw markdown editing
- Markdown mode uses CodeMirror with markdown syntax highlighting
- Edits in markdown mode update the WYSIWYG when switching back
- Both modes operate on the same underlying markdown content

**Data flow:**
- Storage format: markdown (unchanged)
- WYSIWYG mode: TipTap works with HTML, converted from markdown on load
- Markdown mode: CodeMirror edits raw markdown directly
- On save from WYSIWYG: HTML → markdown (turndown) → save
- On save from markdown mode: save directly
- Switching WYSIWYG → markdown: HTML → markdown conversion
- Switching markdown → WYSIWYG: markdown → HTML conversion

### Inline DMS Attachments

In markdown, DMS attachments are represented as:
```markdown
![alt text](attachment:DOCUMENT_ID)
```

In WYSIWYG mode, TipTap renders these as a custom node:
- Shows image preview (fetched from DMS presigned URL)
- Below image: "DMS Attachment" badge, filename, size, "Open in Files →" link
- "Open in Files" opens the file detail modal from the files section

Non-DMS images use standard markdown: `![alt](https://example.com/image.png)`

### CodeMirror Integration

**npm package:** `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-javascript`, `@codemirror/lang-python`, etc.

**In TipTap:** Use the `CodeBlockLowlight` extension or a custom node that wraps CodeMirror. Each code block has a language selector dropdown. Supported languages: javascript, typescript, python, bash/shell, json, html, css, sql, go, rust, yaml, xml, markdown.

**Theme:** Dark theme matching the app's dark mode. Use `@codemirror/theme-one-dark` or similar.

**In markdown mode:** Full-page CodeMirror instance with markdown language support.

### Toolbar

```
[B] [I] [S] [</>] | [H1] [H2] [H3] | [• List] [1. List] [☐ Task] | [🔗 Link] [📷 Image] [{ } Code] [— Divider] [> Quote] |  ... [View Markdown]
```

- "View Markdown" toggles between WYSIWYG and markdown edit mode
- When in markdown mode, toolbar is hidden (CodeMirror has its own controls)

## 2. Note Version History

### Backend Changes (atlas-notes)

**New model: `NoteRevision`**

```
- noteId: ObjectId (ref Note, required, indexed)
- title: String
- content: String (full markdown snapshot)
- tags: String[]
- isPublic: Boolean
- contentSize: Number
- editorId: String (Keycloak user ID)
- editorName: String (display name from JWT)
- summary: String (auto-generated: "Updated content", "Changed title", etc.)
- createdAt: Date (timestamp of the save)
```

Index: `{ noteId: 1, createdAt: -1 }` for efficient listing by note, newest first.

**New endpoints:**

- `GET /api/v1/notes/:id/revisions` — list revisions for a note (paginated, newest first)
- `GET /api/v1/notes/:id/revisions/:revId` — get a specific revision's full content
- `POST /api/v1/notes/:id/revisions/:revId/restore` — restore note to this revision (creates a new revision as "Restored from version X")

**Save flow change:**

In `noteService.update`, before updating the note, create a `NoteRevision` snapshot of the current state. This means every save creates a revision of the *previous* state, so you can always go back.

Fields to snapshot: title, content, tags, isPublic, contentSize.
Editor info: from the JWT (editorId = sub, editorName = name).
Summary: auto-detect what changed — "Updated content", "Changed title", "Updated tags", "Changed visibility", or combine.

### Frontend: History Drawer

Right-side panel (300px), toggled by "History" button in the top bar.

**List view:**
- Grouped by date (Today, Yesterday, Earlier)
- Each entry: version label, editor name, relative timestamp, change summary
- Current version highlighted with blue left border
- Older versions have "Restore" button

**Restore flow:**
1. User clicks "Restore" on a version
2. Confirmation dialog: "Restore to version N? Current changes will be saved as a new version."
3. POST `/notes/:id/revisions/:revId/restore`
4. Page reloads with restored content
5. New revision created: "Restored from version N"

## 3. Scheduler Code Highlighting

### Problem

The job detail page at `/scheduler/jobs/[id]` displays job configuration. For `javascript` and `shell` execution types, `config.code` contains source code that is currently shown in a basic `CodeBlock` component (plain `<pre>` with copy button, no syntax highlighting).

### Fix

Replace `CodeBlock` usage in the scheduler job detail page with a read-only CodeMirror instance:

- Create `apps/atlas-gui/src/components/shared/codemirror-viewer.tsx` — a read-only CodeMirror wrapper component
- Props: `code: string`, `language: string`, `maxHeight?: string`
- Uses the same CodeMirror setup as the notes editor (same theme, same language packs)
- Read-only mode, no editing
- Line numbers, syntax highlighting, copy button

Replace the `CodeBlock` import in `apps/atlas-gui/src/app/(protected)/scheduler/jobs/[id]/page.tsx` with `CodeMirrorViewer`.

## 4. Attachment → Files Link

### Problem

Note attachments list has no way to navigate to the file in the Files section.

### Fix

Each attachment row gets an "Open in Files" link that opens the file detail modal (from the files section). Since the notes page doesn't have the files detail modal wired up, use `window.open('/files/${documentId}', '_blank')` or `router.push('/files/${documentId}')` to navigate to the file detail page.

In the inline DMS image node (WYSIWYG), the "Open in Files →" link does the same.

## File Structure

### New files:
```
apps/atlas-gui/src/components/shared/codemirror-viewer.tsx    — read-only CodeMirror wrapper
apps/atlas-gui/src/components/shared/codemirror-editor.tsx    — editable CodeMirror wrapper
apps/atlas-gui/src/components/notes/markdown-editor.tsx       — full-page CodeMirror markdown editor
apps/atlas-gui/src/components/notes/attachment-image-node.tsx — TipTap custom node for DMS images
apps/atlas-gui/src/components/notes/history-drawer.tsx        — version history panel
apps/atlas-notes/src/models/NoteRevision.ts                   — Mongoose model
apps/atlas-notes/src/daos/revisionDao.ts                      — DAO
apps/atlas-notes/src/services/revisionService.ts              — Service
apps/atlas-notes/src/controllers/revisionController.ts        — Controller
apps/atlas-notes/src/routes/revision.ts                       — Routes
```

### Modified files:
```
apps/atlas-gui/src/components/notes/tiptap-editor.tsx         — add CodeMirror code blocks, image node
apps/atlas-gui/src/components/notes/editor-toolbar.tsx         — extended toolbar with markdown toggle
apps/atlas-gui/src/app/(protected)/notes/[id]/page.tsx        — wire up history drawer, markdown mode, attachment links
apps/atlas-gui/src/app/(protected)/scheduler/jobs/[id]/page.tsx — replace CodeBlock with CodeMirrorViewer
apps/atlas-notes/src/services/noteService.ts                  — create revision on update
apps/atlas-notes/src/routes/index.ts                          — mount revision routes
apps/atlas-gui/package.json                                    — add codemirror dependencies
```

### npm packages to add:
```
@codemirror/view @codemirror/state @codemirror/commands
@codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-css
@codemirror/lang-html @codemirror/lang-json @codemirror/lang-markdown
@codemirror/lang-sql @codemirror/lang-xml @codemirror/lang-yaml
@codemirror/lang-rust @codemirror/lang-go
@codemirror/language @codemirror/theme-one-dark
codemirror
```

## Edge Cases

- Empty revisions: first save creates no revision (nothing to snapshot). Second save onwards creates revisions.
- Restore creates a new revision, so history is never lost.
- Markdown mode with unsaved changes: warn before switching modes if there are unsaved edits.
- Large notes: CodeMirror handles large documents well. TipTap may need lazy rendering for very long notes.
- Concurrent edits: no real-time collaboration. Last save wins. History allows recovery.
- Code block language: persisted in markdown as ````javascript`. CodeMirror reads the language tag.
