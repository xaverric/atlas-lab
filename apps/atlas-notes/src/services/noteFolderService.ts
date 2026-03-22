import { ApiError } from '@atlas/core';
import * as noteFolderDao from '../daos/noteFolderDao.js';
import * as noteDao from '../daos/noteDao.js';
import { Note } from '../models/Note.js';

const MAX_FOLDER_DEPTH = 20;

export const create = async (name: string, ownerId: string, parentId?: string | null, isAdmin = false) => {
  if (parentId) {
    const parent = await noteFolderDao.findById(parentId, ownerId, isAdmin);
    if (!parent) throw new ApiError(404, 'Parent folder not found');
    if (parent.visibility === 'public') {
      return noteFolderDao.create({
        name, parentId, ownerId,
        visibility: 'public',
        publicPermission: (parent as any).publicPermission || 'view',
      });
    }
  }
  return noteFolderDao.create({ name, parentId: parentId || null, ownerId });
};

export const listByParent = (ownerId: string, parentId: string | null, isAdmin = false) =>
  noteFolderDao.listByParent(ownerId, parentId, isAdmin);

export const getById = async (id: string, ownerId: string, isAdmin = false) => {
  const folder = await noteFolderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const breadcrumb = [];
  let current = folder;
  breadcrumb.unshift({ id: current.id, name: current.name });

  let depth = 0;
  while (current.parentId && depth < MAX_FOLDER_DEPTH) {
    depth++;
    const parent = await noteFolderDao.findById(current.parentId.toString());
    if (!parent) break;
    breadcrumb.unshift({ id: parent.id, name: parent.name });
    current = parent;
  }

  return { ...folder.toJSON(), breadcrumb };
};

interface UpdateInput {
  name?: string;
  parentId?: string | null;
  visibility?: 'private' | 'public';
  aiAccessible?: boolean;
  publicPermission?: 'view' | 'edit' | 'full';
}

export const update = async (id: string, ownerId: string, data: UpdateInput, isAdmin = false) => {
  const folder = await noteFolderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  if (data.parentId !== undefined && data.parentId === id) {
    throw new ApiError(400, 'Cannot move folder into itself');
  }

  // Root folders can be made public too — no restriction

  const updated = await noteFolderDao.updateById(id, data);
  if (!updated) throw new ApiError(404, 'Folder not found');
  return updated;
};

export const remove = async (id: string, ownerId: string, isAdmin = false) => {
  const folder = await noteFolderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const childFolders = await noteFolderDao.countChildren(id);
  if (childFolders > 0) throw new ApiError(400, 'Folder is not empty (contains subfolders)');

  const childNotes = await Note.countDocuments({ folderId: id });
  if (childNotes > 0) throw new ApiError(400, 'Folder is not empty (contains notes)');

  await noteFolderDao.deleteById(id);
};

export const getAiAccessibleFolderIds = async (ownerId: string) => {
  const folders = await noteFolderDao.findAiAccessible(ownerId);
  return folders.map((f) => f.id as string);
};

export const isFolderPublic = async (folderId: string): Promise<boolean> => {
  let current = await noteFolderDao.findById(folderId);
  while (current) {
    if (current.visibility === 'public') return true;
    if (!current.parentId) return false;
    current = await noteFolderDao.findById(current.parentId.toString());
  }
  return false;
};

export const resolvePublicPermission = async (folderId: string): Promise<string> => {
  let current = await noteFolderDao.findById(folderId);
  while (current) {
    if (current.visibility === 'public') return current.publicPermission || 'view';
    if (!current.parentId) return 'view';
    current = await noteFolderDao.findById(current.parentId.toString());
  }
  return 'view';
};

export const getByIdPublic = async (id: string) => {
  const folder = await noteFolderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const isPublic = await isFolderPublic(id);
  if (!isPublic) throw new ApiError(404, 'Folder not found');

  const breadcrumb = [];
  let current2 = folder;
  breadcrumb.unshift({ id: current2.id, name: current2.name });

  let depth2 = 0;
  while (current2.parentId && depth2 < MAX_FOLDER_DEPTH) {
    depth2++;
    const parent = await noteFolderDao.findById(current2.parentId.toString());
    if (!parent) break;
    breadcrumb.unshift({ id: parent.id, name: parent.name });
    current2 = parent;
  }

  return { ...folder.toJSON(), breadcrumb };
};

export const getMetadata = async (id: string, ownerId: string, isAdmin = false) => {
  const folder = await noteFolderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const [noteCount, subfolderCount, totalSize] = await Promise.all([
    noteDao.countByFolder(ownerId, id),
    noteFolderDao.countChildren(id),
    noteDao.totalSizeByFolder(ownerId, id),
  ]);

  return { id: folder.id, name: (folder as any).name, noteCount, subfolderCount, totalSize };
};

export const listWithCounts = async (ownerId: string, parentId: string | null, isAdmin = false) => {
  const folders = await noteFolderDao.listByParent(ownerId, parentId, isAdmin);
  const enriched = await Promise.all(
    folders.map(async (f: any) => {
      const [noteCount, totalSize] = await Promise.all([
        noteDao.countByFolder(isAdmin ? f.ownerId : ownerId, f.id),
        noteDao.totalSizeByFolder(isAdmin ? f.ownerId : ownerId, f.id),
      ]);
      return { ...f.toJSON(), noteCount, totalSize };
    }),
  );
  return enriched;
};

export const listByParentPublic = async (parentId: string) => {
  const { NoteFolder } = await import('../models/NoteFolder.js');
  return NoteFolder.find({ parentId }).sort({ name: 1 });
};
