# 03 — DMS Enhancements

## Current State

- Full CRUD for documents and folders
- MinIO (S3) storage with two clients: internal (uploads) and public (presigned URLs)
- Share tokens with presigned download/preview URLs
- Models: `Document` (filename, mimeType, size, folderId, createdBy, s3Key), `Folder` (name, parentId, createdBy), `ShareToken` (documentId, token, expiresAt, maxDownloads)
- GUI: folder browser, document table, upload, preview modal, context menu, rename, move, bulk actions

## Goals

### 1. Public Folder Access (Unauthenticated)

**Business case:** Share specific folders publicly — e.g., documentation, skills files, public downloads. Anyone with the URL can browse and download without logging in.

**Requirements:**
- Per-folder `isPublic` boolean (default false)
- Public = folder and all contents accessible without JWT
- Root folder can never be public
- Public folder URL: `/public/dms/folders/:id`
- Public access shows only the folder contents — no app shell, no navigation to other parts
- Subdirectories inherit public status from parent

**Model changes:**

`apps/atlas-dms/src/models/Folder.ts`:
```
isPublic: { type: Boolean, default: false }
```

**New public routes:**

`apps/atlas-dms/src/routes/public.ts`:
```
GET /public/dms/folders/:id            — list public folder (no auth)
GET /public/dms/folders/:id/tree       — get folder subtree (no auth)
GET /public/dms/documents/:id/download — download from public folder (no auth)
GET /public/dms/documents/:id/preview  — preview from public folder (no auth)
```

**Service logic:**

`apps/atlas-dms/src/services/folderService.ts`:
- `setPublic(folderId, isPublic)` — validate not root, update folder
- `isPublicFolder(folderId)` — check self or walk up ancestors
- Enforce: setting root to public → ApiError 400

`apps/atlas-dms/src/services/documentService.ts`:
- On public access: verify document's folder (or ancestor) is public before serving

**GUI:**

`apps/atlas-gui/src/app/public/dms/[folderId]/page.tsx`:
- Clean, standalone page without app shell
- Shows folder name, contents (subfolders + files)
- Download/preview buttons
- Breadcrumb within public scope only
- No links to authenticated areas

Folder context menu addition:
- "Make Public" / "Make Private" toggle (only for folder owner/admin)
- Copy public link button (when public)

### 2. Folder Metadata Display

**Requirements:**
- In any folder view, show folder metadata panel/sidebar:
  - Folder name, ID
  - Created date, created by (user name)
  - Last modified date
  - Number of items (files + subfolders)
  - Direct link to folder (copyable)
  - Public status
  - Total size (sum of all documents in folder)

**Model additions (optional):**

Could compute on the fly or add aggregation endpoint.

**API:**

`apps/atlas-dms/src/routes/folder.ts`:
```
GET /api/v1/dms/folders/:id/metadata   — returns folder stats
```

**Service:**

`apps/atlas-dms/src/services/folderService.ts`:
```
async getMetadata(folderId) {
  const folder = await folderDao.findById(folderId);
  const docCount = await documentDao.countByFolder(folderId);
  const subfolderCount = await folderDao.countByParent(folderId);
  const totalSize = await documentDao.sumSizeByFolder(folderId);
  return { ...folder, docCount, subfolderCount, totalSize };
}
```

**GUI:**

`apps/atlas-gui/src/components/dms/folder-metadata.tsx`:
- Collapsible metadata panel (right sidebar or expandable section)
- Shows all metadata fields
- Copy link button
- Toggle visibility from here

### 3. Enhanced Sharing

**Current:** ShareToken model exists with `expiresAt` and `maxDownloads`.

**Enhancements:**
- One-time download links (maxDownloads = 1, already supported — verify UI exposes it)
- Time-limited links (already have expiresAt — verify UI has date picker)
- Password-protected share links
- Share entire folders (not just individual documents)

**Model changes:**

`apps/atlas-dms/src/models/ShareToken.ts`:
```
// Add fields
password: String,              // optional bcrypt hash
folderId: mongoose.Types.ObjectId,  // optional — share whole folder
type: { type: String, enum: ['document', 'folder'], default: 'document' }
```

**API:**
```
POST /api/v1/dms/shares              — create share (document or folder)
GET  /api/v1/dms/shares/:token       — access shared resource (verify password if set)
POST /api/v1/dms/shares/:token/verify — verify password for protected share
```

**GUI enhancements:**

Share dialog (`apps/atlas-gui/src/components/dms/`):
- Add password field (optional)
- Add "Share folder" option in folder context menu
- Show existing shares for a document/folder
- Revoke share button
- Copy share link button

Public share page (`apps/atlas-gui/src/app/public/share/[token]/page.tsx`):
- If password protected: show password input first
- If folder share: show folder browser (read-only)
- If document share: show preview + download button
- Track download count, show expiry info

### 4. Subdirectory-Scoped Public Access

**Business case:** Expose specific paths like `/docs/skills/` publicly for sharing curated content (e.g., MCP skills, documentation).

This is largely covered by the public folder feature above. The key addition:

**Friendly URL routing:**
- Map folder paths to clean URLs: `/public/dms/path/skills/mcp-tools`
- Resolve folder by path segments instead of just ID

**API:**
```
GET /public/dms/path/:path*   — resolve folder by path, return contents
```

**Service:**
```
async resolveByPath(pathSegments: string[], userId?: string) {
  let current = rootFolder;
  for (const segment of pathSegments) {
    current = await folderDao.findByNameAndParent(segment, current._id);
    if (!current || !isPublic(current)) throw ApiError.notFound();
  }
  return current;
}
```

## Implementation Order

1. **Folder metadata display** — simplest, no model changes needed
2. **Public folder access** — model change + new routes + public GUI page
3. **Enhanced sharing** — extend existing ShareToken
4. **Path-based public URLs** — build on top of public folders

## Dependencies

- Public folders should be implemented after 01-authorization (user isolation)
- Enhanced sharing is independent, can be done anytime
- Path-based URLs depend on public folder feature
