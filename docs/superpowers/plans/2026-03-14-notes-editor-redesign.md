# Notes Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade notes editor to WYSIWYG+markdown dual-mode with CodeMirror code blocks, inline DMS images, version history, and fix scheduler code highlighting.

**Architecture:** Replace lowlight code blocks with CodeMirror in TipTap. Add markdown edit mode via CodeMirror. Backend: new NoteRevision model for version history. Shared CodeMirror components used by notes editor, markdown mode, and scheduler.

**Tech Stack:** CodeMirror 6, TipTap extensions, Mongoose, Express

**Spec:** `docs/superpowers/specs/2026-03-14-notes-editor-redesign.md`

---

## Chunk 1: CodeMirror foundation + Scheduler fix

### Task 1: Install CodeMirror dependencies

**Files:**
- Modify: `apps/atlas-gui/package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/atlas-gui && npm install codemirror @codemirror/view @codemirror/state @codemirror/commands @codemirror/language @codemirror/theme-one-dark @codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-css @codemirror/lang-html @codemirror/lang-json @codemirror/lang-markdown @codemirror/lang-sql @codemirror/lang-xml @codemirror/lang-yaml @codemirror/lang-rust @codemirror/lang-go
```

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/package.json package-lock.json
git commit -m "chore(gui): add CodeMirror 6 dependencies"
```

---

### Task 2: Create shared CodeMirror viewer component

**Files:**
- Create: `apps/atlas-gui/src/components/shared/codemirror-viewer.tsx`

- [ ] **Step 1: Create read-only CodeMirror wrapper**

This component renders code with syntax highlighting in read-only mode. Used by scheduler job detail and notes view mode.

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { Copy, Check } from 'lucide-react';

const languageLoaders: Record<string, () => Promise<any>> = {
  javascript: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true })),
  python: () => import('@codemirror/lang-python').then((m) => m.python()),
  css: () => import('@codemirror/lang-css').then((m) => m.css()),
  html: () => import('@codemirror/lang-html').then((m) => m.html()),
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  markdown: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
  sql: () => import('@codemirror/lang-sql').then((m) => m.sql()),
  xml: () => import('@codemirror/lang-xml').then((m) => m.xml()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
  rust: () => import('@codemirror/lang-rust').then((m) => m.rust()),
  go: () => import('@codemirror/lang-go').then((m) => m.go()),
  bash: () => import('@codemirror/lang-javascript').then((m) => m.javascript()), // fallback
  shell: () => import('@codemirror/lang-javascript').then((m) => m.javascript()), // fallback
};

interface CodeMirrorViewerProps {
  code: string;
  language?: string;
  maxHeight?: string;
}

export function CodeMirrorViewer({ code, language = 'javascript', maxHeight = '400px' }: CodeMirrorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const setup = async () => {
      const extensions = [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        lineNumbers(),
        oneDark,
        EditorView.theme({ '&': { maxHeight }, '.cm-scroller': { overflow: 'auto' } }),
      ];

      const loader = languageLoaders[language] || languageLoaders.javascript;
      try {
        const lang = await loader();
        extensions.push(lang);
      } catch { /* continue without language */ }

      if (viewRef.current) viewRef.current.destroy();

      viewRef.current = new EditorView({
        state: EditorState.create({ doc: code, extensions }),
        parent: containerRef.current!,
      });
    };

    setup();
    return () => { viewRef.current?.destroy(); viewRef.current = null; };
  }, [code, language, maxHeight]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50 text-xs text-muted-foreground">
        <span>{language}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-foreground transition-colors">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/components/shared/codemirror-viewer.tsx
git commit -m "feat(gui): add CodeMirror read-only viewer component"
```

---

### Task 3: Fix scheduler job detail to use CodeMirror

**Files:**
- Modify: `apps/atlas-gui/src/app/(protected)/scheduler/jobs/[id]/page.tsx`

- [ ] **Step 1: Replace CodeBlock with CodeMirrorViewer**

Read the file first. Find the import of `CodeBlock` (around line 11) and the usage (around lines 219-229).

Replace:
```typescript
import { CodeBlock } from '@/components/shared/code-block';
```
With:
```typescript
import { CodeMirrorViewer } from '@/components/shared/codemirror-viewer';
```

Replace every `<CodeBlock code={...} language={...} />` with `<CodeMirrorViewer code={...} language={...} />`.

The language mapping: `executionType === 'shell'` → `language="bash"`, `executionType === 'javascript'` → `language="javascript"`. For other types showing JSON config, use `language="json"`.

- [ ] **Step 2: Verify**

Run: `npm run dev:gui`
Navigate to a scheduler job detail with javascript code. The code should now have syntax highlighting with CodeMirror.

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-gui/src/app/\(protected\)/scheduler/jobs/\[id\]/page.tsx
git commit -m "feat(gui): use CodeMirror for scheduler job code display"
```

---

## Chunk 2: Notes editor upgrade — CodeMirror code blocks + markdown mode

### Task 4: Create CodeMirror editor component (editable)

**Files:**
- Create: `apps/atlas-gui/src/components/shared/codemirror-editor.tsx`

- [ ] **Step 1: Create editable CodeMirror wrapper**

Same as viewer but editable, with onChange callback. Used for markdown edit mode and could be used for code editing in scheduler.

```typescript
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';

const languageLoaders: Record<string, () => Promise<any>> = {
  javascript: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true })),
  python: () => import('@codemirror/lang-python').then((m) => m.python()),
  css: () => import('@codemirror/lang-css').then((m) => m.css()),
  html: () => import('@codemirror/lang-html').then((m) => m.html()),
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  markdown: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
  sql: () => import('@codemirror/lang-sql').then((m) => m.sql()),
  xml: () => import('@codemirror/lang-xml').then((m) => m.xml()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
  rust: () => import('@codemirror/lang-rust').then((m) => m.rust()),
  go: () => import('@codemirror/lang-go').then((m) => m.go()),
  bash: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
  shell: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
};

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  minHeight?: string;
}

export function CodeMirrorEditor({ value, onChange, language = 'markdown', minHeight = '300px' }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setup = useCallback(async () => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      keymap.of([...defaultKeymap, indentWithTab]),
      oneDark,
      EditorView.theme({
        '&': { minHeight },
        '.cm-scroller': { overflow: 'auto' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];

    const loader = languageLoaders[language] || languageLoaders.markdown;
    try {
      const lang = await loader();
      extensions.push(lang);
    } catch { /* continue without language */ }

    if (viewRef.current) viewRef.current.destroy();

    viewRef.current = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: containerRef.current,
    });
  }, [language, minHeight]); // value intentionally excluded — set via dispatch

  useEffect(() => {
    setup();
    return () => { viewRef.current?.destroy(); viewRef.current = null; };
  }, [setup]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="rounded-lg border overflow-hidden" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/components/shared/codemirror-editor.tsx
git commit -m "feat(gui): add CodeMirror editable editor component"
```

---

### Task 5: Upgrade TipTap editor toolbar + add markdown toggle

**Files:**
- Modify: `apps/atlas-gui/src/components/notes/editor-toolbar.tsx`

- [ ] **Step 1: Extend toolbar with new buttons and markdown toggle**

Read the current file first. The current toolbar has 14 buttons. Add: image, horizontal rule, blockquote, and a markdown toggle button on the far right.

Add prop `onToggleMarkdown` and `isMarkdown` to the toolbar:

```typescript
interface EditorToolbarProps {
  editor: Editor | null;
  isMarkdown?: boolean;
  onToggleMarkdown?: () => void;
  onInsertImage?: () => void;
}
```

Add these buttons to the existing array:
- After code block: `{ icon: ImageIcon, action: () => onInsertImage?.(), label: 'Image' }`
- `{ icon: Minus, action: () => editor?.chain().focus().setHorizontalRule().run(), label: 'Divider' }`
- `{ icon: Quote, action: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote'), label: 'Quote' }`

Add the markdown toggle as a separate element after the button group, pushed to the right:

```tsx
{onToggleMarkdown && (
  <button
    onClick={onToggleMarkdown}
    className={cn('ml-auto rounded px-2 py-1 text-xs', isMarkdown ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
  >
    {isMarkdown ? 'WYSIWYG' : 'Markdown'}
  </button>
)}
```

Import: `import { Image as ImageIcon, Minus, Quote } from 'lucide-react'`

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/components/notes/editor-toolbar.tsx
git commit -m "feat(gui): extend notes toolbar with image, divider, quote, markdown toggle"
```

---

### Task 6: Add DMS attachment image node to TipTap

**Files:**
- Create: `apps/atlas-gui/src/components/notes/attachment-image-node.tsx`
- Modify: `apps/atlas-gui/src/components/notes/tiptap-editor.tsx`

- [ ] **Step 1: Create TipTap custom node for DMS attachment images**

This renders inline DMS images with a "DMS Attachment" badge and "Open in Files" link.

Create `apps/atlas-gui/src/components/notes/attachment-image-node.tsx`:

This is a TipTap `Node.create` extension that intercepts images with `src` starting with `attachment:`. It renders a React component showing the image preview, badge, filename, size, and link.

Read TipTap's `@tiptap/extension-image` source for reference on how image nodes work. The custom node should:
- Extend the built-in Image node
- Override the render to check if `src` starts with `attachment:`
- If so, render the DMS attachment preview component
- If not, render a normal image
- The component fetches the preview URL from `/api/v1/files/documents/{docId}/preview`
- Shows "Open in Files" link that navigates to `/files/{docId}`

- [ ] **Step 2: Register the extension in TipTap editor**

In `apps/atlas-gui/src/components/notes/tiptap-editor.tsx`, replace the `Image` extension import with the custom `AttachmentImageNode`. Remove the plain `Image.configure(...)` and add the custom node instead.

- [ ] **Step 3: Commit**

```bash
git add apps/atlas-gui/src/components/notes/attachment-image-node.tsx apps/atlas-gui/src/components/notes/tiptap-editor.tsx
git commit -m "feat(gui): add DMS attachment image node to TipTap editor"
```

---

### Task 7: Wire up dual-mode editor in note detail page

**Files:**
- Modify: `apps/atlas-gui/src/app/(protected)/notes/[id]/page.tsx`

- [ ] **Step 1: Add markdown mode state and toggle**

Read the current file. Add state for markdown mode:

```typescript
const [isMarkdown, setIsMarkdown] = useState(false);
const [markdownContent, setMarkdownContent] = useState('');
```

Add toggle function:
```typescript
const toggleMarkdown = () => {
  if (isMarkdown) {
    // Switching from markdown to WYSIWYG
    const newHtml = markdownToHtml(markdownContent);
    setHtml(newHtml);
    setIsMarkdown(false);
  } else {
    // Switching from WYSIWYG to markdown
    const md = htmlToMarkdown(html);
    setMarkdownContent(md);
    setIsMarkdown(true);
  }
};
```

- [ ] **Step 2: Render CodeMirrorEditor in markdown mode**

In edit mode, when `isMarkdown` is true, replace the TipTap editor with:

```tsx
<CodeMirrorEditor
  value={markdownContent}
  onChange={setMarkdownContent}
  language="markdown"
  minHeight="400px"
/>
```

When `isMarkdown` is false, show the TipTap editor as before.

Hide the TipTap toolbar when in markdown mode.

- [ ] **Step 3: Update save handler for markdown mode**

In `handleSave`, check `isMarkdown`:
```typescript
const md = isMarkdown ? markdownContent : htmlToMarkdown(html);
```

- [ ] **Step 4: Pass markdown toggle to toolbar**

```tsx
<EditorToolbar
  editor={editor}
  isMarkdown={isMarkdown}
  onToggleMarkdown={toggleMarkdown}
  onInsertImage={() => setShowFilePicker(true)}
/>
```

- [ ] **Step 5: Add "Open in Files" link to attachment panel**

In `apps/atlas-gui/src/components/notes/attachment-panel.tsx`, add a link/button next to each attachment that navigates to `/files/${att.documentId}`. Import `Link` from next/link or use `window.open`.

- [ ] **Step 6: Commit**

```bash
git add apps/atlas-gui/src/app/\(protected\)/notes/\[id\]/page.tsx apps/atlas-gui/src/components/notes/attachment-panel.tsx
git commit -m "feat(gui): add dual-mode WYSIWYG/markdown editor with attachment links"
```

---

## Chunk 3: Version history backend

### Task 8: Create NoteRevision model

**Files:**
- Create: `apps/atlas-notes/src/models/NoteRevision.ts`

- [ ] **Step 1: Create the model**

```typescript
import { Schema, model, Types } from 'mongoose';

const noteRevisionSchema = new Schema({
  noteId: { type: Types.ObjectId, ref: 'Note', required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  tags: [String],
  isPublic: { type: Boolean, default: false },
  contentSize: { type: Number, default: 0 },
  editorId: { type: String, required: true },
  editorName: { type: String, default: 'Unknown' },
  summary: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

noteRevisionSchema.index({ noteId: 1, createdAt: -1 });

noteRevisionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; },
});

export const NoteRevision = model('NoteRevision', noteRevisionSchema);
```

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-notes/src/models/NoteRevision.ts
git commit -m "feat(notes): add NoteRevision model for version history"
```

---

### Task 9: Create revision DAO, service, controller, routes

**Files:**
- Create: `apps/atlas-notes/src/daos/revisionDao.ts`
- Create: `apps/atlas-notes/src/services/revisionService.ts`
- Create: `apps/atlas-notes/src/controllers/revisionController.ts`
- Create: `apps/atlas-notes/src/routes/revision.ts`
- Modify: `apps/atlas-notes/src/routes/note.ts`

- [ ] **Step 1: Create revisionDao**

```typescript
import { NoteRevision } from '../models/NoteRevision.js';

export const create = (data: {
  noteId: string; title: string; content: string; tags: string[];
  isPublic: boolean; contentSize: number; editorId: string; editorName: string; summary: string;
}) => NoteRevision.create(data);

export const listByNote = (noteId: string, page = 1, limit = 50) =>
  NoteRevision.find({ noteId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

export const findById = (id: string) => NoteRevision.findById(id);

export const countByNote = (noteId: string) => NoteRevision.countDocuments({ noteId });
```

- [ ] **Step 2: Create revisionService**

```typescript
import { ApiError } from '@atlas/core';
import * as revisionDao from '../daos/revisionDao.js';
import * as noteDao from '../daos/noteDao.js';

export const createRevision = async (
  noteId: string, editorId: string, editorName: string, summary: string,
) => {
  const note = await noteDao.findById(noteId);
  if (!note) throw new ApiError(404, 'Note not found');

  return revisionDao.create({
    noteId,
    title: note.title,
    content: note.content || '',
    tags: note.tags || [],
    isPublic: note.isPublic ?? false,
    contentSize: (note as any).contentSize ?? 0,
    editorId,
    editorName,
    summary,
  });
};

export const listRevisions = async (noteId: string, ownerId: string, isAdmin = false) => {
  const note = await noteDao.findById(noteId, ownerId, isAdmin);
  if (!note) throw new ApiError(404, 'Note not found');
  const revisions = await revisionDao.listByNote(noteId);
  const total = await revisionDao.countByNote(noteId);
  return { data: revisions, total };
};

export const getRevision = async (noteId: string, revId: string, ownerId: string, isAdmin = false) => {
  const note = await noteDao.findById(noteId, ownerId, isAdmin);
  if (!note) throw new ApiError(404, 'Note not found');
  const revision = await revisionDao.findById(revId);
  if (!revision || revision.noteId.toString() !== noteId) throw new ApiError(404, 'Revision not found');
  return revision;
};

export const restore = async (noteId: string, revId: string, ownerId: string, editorId: string, editorName: string, isAdmin = false) => {
  const note = await noteDao.findById(noteId, ownerId, isAdmin);
  if (!note) throw new ApiError(404, 'Note not found');
  const revision = await revisionDao.findById(revId);
  if (!revision || revision.noteId.toString() !== noteId) throw new ApiError(404, 'Revision not found');

  // Snapshot current state before restoring
  await revisionDao.create({
    noteId,
    title: note.title,
    content: note.content || '',
    tags: note.tags || [],
    isPublic: note.isPublic ?? false,
    contentSize: (note as any).contentSize ?? 0,
    editorId,
    editorName,
    summary: `Before restore from revision`,
  });

  // Restore
  const contentSize = Buffer.byteLength(revision.content, 'utf8');
  const updated = await noteDao.updateById(noteId, {
    title: revision.title,
    content: revision.content,
    tags: revision.tags,
    isPublic: revision.isPublic,
    contentSize,
  });

  // Snapshot restored state
  await revisionDao.create({
    noteId,
    title: revision.title,
    content: revision.content,
    tags: revision.tags,
    isPublic: revision.isPublic,
    contentSize,
    editorId,
    editorName,
    summary: `Restored from earlier version`,
  });

  return updated;
};

// Generate summary by comparing fields
export const generateSummary = (
  before: { title: string; content: string; tags: string[]; isPublic: boolean },
  after: { title?: string; content?: string; tags?: string[]; isPublic?: boolean },
): string => {
  const changes: string[] = [];
  if (after.title !== undefined && after.title !== before.title) changes.push('title');
  if (after.content !== undefined && after.content !== before.content) changes.push('content');
  if (after.tags !== undefined && JSON.stringify(after.tags) !== JSON.stringify(before.tags)) changes.push('tags');
  if (after.isPublic !== undefined && after.isPublic !== before.isPublic) changes.push('visibility');
  if (changes.length === 0) return 'No changes';
  return `Updated ${changes.join(', ')}`;
};
```

- [ ] **Step 3: Create revisionController**

```typescript
import type { RequestHandler } from 'express';
import * as revisionService from '../services/revisionService.js';

const resolveOwner = (req: any) => {
  const roles = req.auth?.realm_access?.roles || [];
  const isAdmin = roles.includes('admin');
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && !isAdmin) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return { ownerId: queryUserId || req.auth.sub, isAdmin };
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const result = await revisionService.listRevisions(req.params.id as string, ownerId, isAdmin);
    res.json(result);
  } catch (err) { next(err); }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const revision = await revisionService.getRevision(req.params.id as string, req.params.revId as string, ownerId, isAdmin);
    res.json({ data: revision });
  } catch (err) { next(err); }
};

export const restore: RequestHandler = async (req, res, next) => {
  try {
    const { ownerId, isAdmin } = resolveOwner(req);
    const editorId = req.auth.sub;
    const editorName = req.auth?.name || req.auth?.preferred_username || 'Unknown';
    const note = await revisionService.restore(req.params.id as string, req.params.revId as string, ownerId, editorId, editorName, isAdmin);
    res.json({ data: note });
  } catch (err) { next(err); }
};
```

- [ ] **Step 4: Create revision routes and mount them**

Create `apps/atlas-notes/src/routes/revision.ts`:

```typescript
import { Router } from 'express';
import { objectIdSchema } from '@atlas/core';
import { validate } from '@atlas/server-common';
import * as revisionController from '../controllers/revisionController.js';
import { z } from 'zod';

const router = Router({ mergeParams: true });
const idSchema = z.object({ id: objectIdSchema, revId: objectIdSchema });

router.get('/', revisionController.list);
router.get('/:revId', validate(idSchema, 'params'), revisionController.getById);
router.post('/:revId/restore', validate(idSchema, 'params'), revisionController.restore);

export default router;
```

In `apps/atlas-notes/src/routes/note.ts`, mount revision routes:

After the attachment routes, add:
```typescript
import revisionRoutes from './revision.js';
router.use('/:id/revisions', auth, revisionRoutes);
```

- [ ] **Step 5: Create revision on note update**

In `apps/atlas-notes/src/services/noteService.ts`, in the `update` function, before updating the note, create a revision snapshot:

```typescript
import * as revisionService from './revisionService.js';

// Inside update(), after finding the existing note:
const summary = revisionService.generateSummary(
  { title: existing.title, content: existing.content || '', tags: existing.tags || [], isPublic: existing.isPublic ?? false },
  data,
);
if (summary !== 'No changes') {
  // Note: editorId and editorName need to be passed through from the controller
  // Add these as optional params to the update function
}
```

This requires adding `editorId` and `editorName` params to the `update` function and passing them from the controller. Update `noteService.update` signature and `noteController.update` to pass JWT info.

- [ ] **Step 6: Commit**

```bash
git add apps/atlas-notes/src/
git commit -m "feat(notes): add version history backend with revision API and auto-snapshot on save"
```

---

## Chunk 4: History drawer frontend

### Task 10: Create history drawer component

**Files:**
- Create: `apps/atlas-gui/src/components/notes/history-drawer.tsx`

- [ ] **Step 1: Create the component**

Right-side panel showing note revision history. Props:
```typescript
interface HistoryDrawerProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void; // called after successful restore to reload note
}
```

The component:
- Fetches revisions from `GET /api/v1/notes/{noteId}/revisions`
- Groups by date (Today, Yesterday, Earlier)
- Shows: version label, editor name, timestamp, summary
- Current version highlighted
- "Restore" button on each older version
- Restore: confirm dialog, POST `/api/v1/notes/{noteId}/revisions/{revId}/restore`, calls onRestore

Styling: 300px wide, border-left, fixed position or flex child of the page layout.

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/components/notes/history-drawer.tsx
git commit -m "feat(gui): add note history drawer component"
```

---

### Task 11: Wire history drawer into note detail page

**Files:**
- Modify: `apps/atlas-gui/src/app/(protected)/notes/[id]/page.tsx`

- [ ] **Step 1: Add history state and render drawer**

Add state: `const [showHistory, setShowHistory] = useState(false);`

Add History button in the top bar (next to Save):
```tsx
<button onClick={() => setShowHistory(!showHistory)} className="btn">
  History
</button>
```

Wrap the page in a flex container. When `showHistory` is true, render `<HistoryDrawer>` as a sibling of the editor area.

On restore: call `loadNote()` to refresh the content.

- [ ] **Step 2: Commit**

```bash
git add apps/atlas-gui/src/app/\(protected\)/notes/\[id\]/page.tsx
git commit -m "feat(gui): wire history drawer into note detail page"
```

---

## Chunk 5: Final verification

### Task 12: Verify and polish

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck -w @atlas/notes
npm run typecheck -w @atlas/gui
```

Fix any errors.

- [ ] **Step 2: Manual smoke test**

Test all features:
- Notes editor: WYSIWYG mode works, code blocks have CodeMirror
- Markdown toggle: switches between modes, content preserved
- Inline DMS images: show with badge and "Open in Files" link
- Attachment panel: "Open in Files" link works
- History: button opens drawer, versions listed, restore works
- Scheduler: job detail shows code with syntax highlighting

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix(gui): address issues from notes editor smoke testing"
```
