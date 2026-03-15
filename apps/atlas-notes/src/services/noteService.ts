import { ApiError } from '@atlas/core';
import * as noteDao from '../daos/noteDao.js';
import * as embeddingService from './embeddingService.js';
import * as vectorService from './vectorService.js';
import * as noteFolderService from './noteFolderService.js';
import * as revisionService from './revisionService.js';

interface CreateInput {
  title: string;
  content?: string;
  folderId?: string | null;
  ownerId: string;
  tags?: string[];
  isPublic?: boolean;
}

interface ListInput {
  ownerId: string;
  isAdmin?: boolean;
  folderId?: string | null;
  tags?: string[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

interface UpdateInput {
  title?: string;
  content?: string;
  tags?: string[];
  folderId?: string | null;
  isPublic?: boolean;
  dmsFolderId?: string;
}

const resolveAiAccessible = async (folderId: string | null): Promise<boolean> => {
  if (!folderId) return false;
  const { NoteFolder } = await import('../models/NoteFolder.js');
  const folder = await NoteFolder.findById(folderId);
  return folder?.aiAccessible ?? false;
};

const embedAndUpsert = (noteId: string, title: string, content: string, tags: string[], ownerId: string, folderId: string | null, isPublic: boolean) => {
  const text = embeddingService.prepareText(title, content, tags);

  Promise.all([
    embeddingService.generateEmbedding(text),
    resolveAiAccessible(folderId),
  ])
    .then(([vector, aiAccessible]) => {
      console.log(`Embedding generated for note ${noteId} (${vector.length} dims), upserting to Qdrant...`);
      return vectorService.upsertNote(noteId, vector, { ownerId, folderId, isPublic, aiAccessible, title });
    })
    .then(() => console.log(`Note ${noteId} upserted to Qdrant`))
    .catch((err) => console.error('Embedding/upsert failed for note', noteId, err.message || err));
};

export const create = async (input: CreateInput) => {
  const contentSize = Buffer.byteLength(input.content || '', 'utf8');
  const note = await noteDao.create({ ...input, contentSize });
  embedAndUpsert(note.id, note.title, note.content || '', note.tags || [], note.ownerId, note.folderId?.toString() || null, note.isPublic ?? false);
  return note;
};

export const list = async (opts: ListInput & { ownerName?: string }) => {
  const result = await noteDao.list(opts);
  const ownerName = opts.ownerName || 'Unknown';
  return {
    ...result,
    data: result.data.map((n: any) => ({ ...n.toJSON(), ownerName })),
  };
};

export const getById = async (id: string, ownerId: string, isAdmin = false) => {
  const note = await noteDao.findById(id, ownerId, isAdmin);
  if (!note) throw new ApiError(404, 'Note not found');
  return note;
};

export const update = async (
  id: string,
  ownerId: string,
  data: UpdateInput,
  isAdmin = false,
  editorId?: string,
  editorName?: string,
) => {
  const existing = await getById(id, ownerId, isAdmin);
  const summary = revisionService.generateSummary(
    { title: existing.title, content: existing.content || '', tags: existing.tags || [], isPublic: existing.isPublic ?? false },
    data,
  );
  if (summary && editorId) {
    await revisionService.createRevision(id, editorId, editorName || 'Unknown', summary);
  }
  const updateData = data.content !== undefined
    ? { ...data, contentSize: Buffer.byteLength(data.content, 'utf8') }
    : data;
  const updated = await noteDao.updateById(id, updateData);
  if (!updated) throw new ApiError(404, 'Note not found');

  const contentChanged = data.title !== undefined || data.content !== undefined || data.tags !== undefined;
  if (contentChanged) {
    embedAndUpsert(
      updated.id,
      updated.title,
      updated.content || '',
      updated.tags || [],
      updated.ownerId,
      updated.folderId?.toString() || null,
      updated.isPublic ?? existing.isPublic ?? false,
    );
  } else if (data.folderId !== undefined || data.isPublic !== undefined) {
    embedAndUpsert(
      updated.id,
      updated.title,
      updated.content || '',
      updated.tags || [],
      updated.ownerId,
      updated.folderId?.toString() || null,
      updated.isPublic ?? false,
    );
  }

  return updated;
};

export const remove = async (id: string, ownerId: string, isAdmin = false) => {
  await getById(id, ownerId, isAdmin);
  await noteDao.deleteById(id);
  vectorService.deleteNote(id).catch((err) => console.error('Qdrant delete failed for note', id, err));
};

export const getTags = (ownerId: string, isAdmin = false) => noteDao.distinctTags(ownerId, isAdmin);

export const getByIdPublic = async (id: string) => {
  const note = await noteDao.findById(id);
  if (!note) throw new ApiError(404, 'Note not found');

  // Note is public if: (a) isPublic flag is true on the note itself, or (b) it's in a public folder
  if (note.isPublic) {
    return { ...note.toJSON(), publicPermission: (note as any).publicPermission || 'view' };
  }
  if (note.folderId) {
    const folderPublic = await noteFolderService.isFolderPublic(note.folderId.toString());
    if (folderPublic) {
      const perm = await noteFolderService.resolvePublicPermission(note.folderId.toString());
      return { ...note.toJSON(), publicPermission: perm };
    }
  }
  throw new ApiError(404, 'Note not found');
};

export const updatePublic = async (id: string, data: { title?: string; content?: string; tags?: string[] }) => {
  const note = await noteDao.findById(id);
  if (!note) throw new ApiError(404, 'Note not found');

  // Check public access
  let canEdit = false;
  if (note.isPublic) {
    canEdit = (note as any).publicPermission === 'edit';
  }
  if (!canEdit && note.folderId) {
    const folderPublic = await noteFolderService.isFolderPublic(note.folderId.toString());
    if (folderPublic) {
      const perm = await noteFolderService.resolvePublicPermission(note.folderId.toString());
      canEdit = perm === 'edit' || perm === 'full';
    }
  }
  if (!canEdit) throw new ApiError(403, 'Note is not publicly editable');

  const updateData: Record<string, unknown> = { ...data };
  if (data.content !== undefined) {
    updateData.contentSize = Buffer.byteLength(data.content, 'utf8');
  }
  const updated = await noteDao.updateById(id, updateData);
  if (!updated) throw new ApiError(404, 'Note not found');

  const contentChanged = data.title !== undefined || data.content !== undefined || data.tags !== undefined;
  if (contentChanged) {
    embedAndUpsert(
      updated.id,
      updated.title,
      updated.content || '',
      updated.tags || [],
      updated.ownerId,
      updated.folderId?.toString() || null,
      updated.isPublic ?? false,
    );
  }

  return updated;
};

interface AttachmentInput {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export const addAttachment = async (noteId: string, ownerId: string, attachment: AttachmentInput) => {
  const note = await getById(noteId, ownerId);
  const existing = (note.attachments || []).find((a: any) => a.documentId === attachment.documentId);
  if (existing) throw new ApiError(409, 'Attachment already exists');
  return noteDao.addAttachment(noteId, attachment);
};

export const removeAttachment = async (noteId: string, ownerId: string, documentId: string) => {
  await getById(noteId, ownerId);
  return noteDao.removeAttachment(noteId, documentId);
};

export const listAttachments = async (noteId: string, ownerId: string) => {
  const note = await getById(noteId, ownerId);
  return note.attachments || [];
};
