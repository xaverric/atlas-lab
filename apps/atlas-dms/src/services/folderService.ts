import { ApiError } from '@atlas/core';
import * as folderDao from '../daos/folderDao.js';
import { Document } from '../models/Document.js';

export const create = async (name: string, ownerId: string, parentId?: string | null) => {
  if (parentId) {
    const parent = await folderDao.findById(parentId);
    if (!parent) throw new ApiError(404, 'Parent folder not found');
    if (parent.ownerId !== ownerId) throw new ApiError(403, 'Access denied');
  }
  return folderDao.create({ name, parentId: parentId || null, ownerId });
};

export const listByParent = (ownerId: string, parentId: string | null) =>
  folderDao.listByParent(ownerId, parentId);

export const getById = async (id: string, ownerId: string) => {
  const folder = await folderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');
  if (folder.ownerId !== ownerId) throw new ApiError(403, 'Access denied');

  const breadcrumb = [];
  let current = folder;
  breadcrumb.unshift({ id: current.id, name: current.name });

  while (current.parentId) {
    const parent = await folderDao.findById(current.parentId.toString());
    if (!parent) break;
    breadcrumb.unshift({ id: parent.id, name: parent.name });
    current = parent;
  }

  return { ...folder.toJSON(), breadcrumb };
};

export const update = async (id: string, ownerId: string, data: { name?: string; parentId?: string | null }) => {
  const folder = await folderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');
  if (folder.ownerId !== ownerId) throw new ApiError(403, 'Access denied');

  if (data.parentId !== undefined && data.parentId === id) {
    throw new ApiError(400, 'Cannot move folder into itself');
  }

  const updated = await folderDao.updateById(id, data);
  if (!updated) throw new ApiError(404, 'Folder not found');
  return updated;
};

export const remove = async (id: string, ownerId: string) => {
  const folder = await folderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');
  if (folder.ownerId !== ownerId) throw new ApiError(403, 'Access denied');

  const childFolders = await folderDao.countChildren(id);
  if (childFolders > 0) throw new ApiError(400, 'Folder is not empty (contains subfolders)');

  const childDocs = await Document.countDocuments({ folderId: id });
  if (childDocs > 0) throw new ApiError(400, 'Folder is not empty (contains documents)');

  await folderDao.deleteById(id);
};
