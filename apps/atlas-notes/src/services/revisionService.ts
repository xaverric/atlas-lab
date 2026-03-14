import { ApiError } from '@atlas/core';
import * as revisionDao from '../daos/revisionDao.js';
import * as noteDao from '../daos/noteDao.js';

export const generateSummary = (
  before: { title: string; content: string; tags: string[]; isPublic: boolean },
  after: { title?: string; content?: string; tags?: string[]; isPublic?: boolean },
): string => {
  const changed: string[] = [];
  if (after.title !== undefined && after.title !== before.title) changed.push('title');
  if (after.content !== undefined && after.content !== before.content) changed.push('content');
  if (after.tags !== undefined && JSON.stringify(after.tags) !== JSON.stringify(before.tags)) changed.push('tags');
  if (after.isPublic !== undefined && after.isPublic !== before.isPublic) changed.push('visibility');
  if (changed.length === 0) return '';
  return `Updated ${changed.join(', ')}`;
};

export const createRevision = async (
  noteId: string,
  editorId: string,
  editorName: string,
  summary: string,
) => {
  const note = await noteDao.findById(noteId);
  if (!note) throw new ApiError(404, 'Note not found');
  return revisionDao.create({
    noteId,
    title: note.title,
    content: note.content || '',
    tags: note.tags || [],
    isPublic: note.isPublic ?? false,
    contentSize: note.contentSize ?? Buffer.byteLength(note.content || '', 'utf8'),
    editorId,
    editorName,
    summary,
  });
};

export const listRevisions = async (
  noteId: string,
  ownerId: string,
  isAdmin: boolean,
  page: number,
  limit: number,
) => {
  const note = await noteDao.findById(noteId, ownerId, isAdmin);
  if (!note) throw new ApiError(404, 'Note not found');
  return revisionDao.listByNote(noteId, page, limit);
};

export const getRevision = async (
  noteId: string,
  revId: string,
  ownerId: string,
  isAdmin: boolean,
) => {
  const note = await noteDao.findById(noteId, ownerId, isAdmin);
  if (!note) throw new ApiError(404, 'Note not found');
  const revision = await revisionDao.findById(revId);
  if (!revision || revision.noteId.toString() !== noteId) throw new ApiError(404, 'Revision not found');
  return revision;
};

export const restore = async (
  noteId: string,
  revId: string,
  ownerId: string,
  editorId: string,
  editorName: string,
  isAdmin: boolean,
) => {
  const note = await noteDao.findById(noteId, ownerId, isAdmin);
  if (!note) throw new ApiError(404, 'Note not found');
  const revision = await revisionDao.findById(revId);
  if (!revision || revision.noteId.toString() !== noteId) throw new ApiError(404, 'Revision not found');

  await createRevision(noteId, editorId, editorName, 'Pre-restore snapshot');

  const contentSize = Buffer.byteLength(revision.content || '', 'utf8');
  const updated = await noteDao.updateById(noteId, {
    title: revision.title,
    content: revision.content || '',
    tags: revision.tags || [],
    isPublic: revision.isPublic,
    contentSize,
  });
  if (!updated) throw new ApiError(404, 'Note not found');

  await revisionDao.create({
    noteId,
    title: revision.title,
    content: revision.content || '',
    tags: revision.tags || [],
    isPublic: revision.isPublic,
    contentSize,
    editorId,
    editorName,
    summary: `Restored to revision from ${(revision as any).createdAt?.toISOString?.() ?? revId}`,
  });

  return updated;
};
