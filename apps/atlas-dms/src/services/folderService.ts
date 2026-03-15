import { ApiError } from '@atlas/core';
import * as folderDao from '../daos/folderDao.js';
import * as documentDao from '../daos/documentDao.js';
import { Document } from '../models/Document.js';

export const create = async (name: string, ownerId: string, parentId?: string | null, isAdmin = false) => {
  if (parentId) {
    const parent = await folderDao.findById(parentId, ownerId, isAdmin);
    if (!parent) throw new ApiError(404, 'Parent folder not found');
    if (parent.isPublic) {
      return folderDao.create({
        name, parentId, ownerId,
        isPublic: true,
        publicPermission: (parent as any).publicPermission || 'view',
      });
    }
  }
  return folderDao.create({ name, parentId: parentId || null, ownerId });
};

export const listByParent = (ownerId: string, parentId: string | null, isAdmin = false) =>
  folderDao.listByParent(ownerId, parentId, isAdmin);

export const getById = async (id: string, ownerId: string, isAdmin = false) => {
  const folder = await folderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

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

export const update = async (id: string, ownerId: string, data: { name?: string; parentId?: string | null }, isAdmin = false) => {
  const folder = await folderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  if (data.parentId !== undefined && data.parentId === id) {
    throw new ApiError(400, 'Cannot move folder into itself');
  }

  const updated = await folderDao.updateById(id, data);
  if (!updated) throw new ApiError(404, 'Folder not found');
  return updated;
};

export const remove = async (id: string, ownerId: string, isAdmin = false) => {
  const folder = await folderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const childFolders = await folderDao.countChildren(id);
  if (childFolders > 0) throw new ApiError(400, 'Folder is not empty (contains subfolders)');

  const childDocs = await Document.countDocuments({ folderId: id });
  if (childDocs > 0) throw new ApiError(400, 'Folder is not empty (contains documents)');

  await folderDao.deleteById(id);
};

export const setPublic = async (folderId: string, isPublic: boolean, ownerId: string, isAdmin = false, publicPermission?: string) => {
  const folder = await folderDao.findById(folderId, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');
  // Any folder can be made public, including root-level folders
  return folderDao.updateIsPublic(folderId, isPublic, publicPermission);
};

export const isPublicFolder = async (folderId: string): Promise<boolean> => {
  let current = await folderDao.findById(folderId);
  while (current) {
    if (current.isPublic) return true;
    if (!current.parentId) return false;
    current = await folderDao.findById(current.parentId.toString());
  }
  return false;
};

export type PublicPermission = 'view' | 'edit' | 'full';

export const resolvePublicPermission = async (folderId: string): Promise<PublicPermission | null> => {
  let current = await folderDao.findById(folderId);
  while (current) {
    if (current.isPublic) return (current as any).publicPermission || 'view';
    if (!current.parentId) return null;
    current = await folderDao.findById(current.parentId.toString());
  }
  return null;
};

export const getPublicFolderOwner = async (folderId: string): Promise<string> => {
  const folder = await folderDao.findById(folderId);
  if (!folder) throw new ApiError(404, 'Folder not found');
  return folder.ownerId;
};

export const createPublic = async (name: string, parentId: string) => {
  const parent = await folderDao.findById(parentId);
  if (!parent) throw new ApiError(404, 'Parent folder not found');
  return folderDao.create({
    name, parentId, ownerId: parent.ownerId,
    isPublic: parent.isPublic || false,
    publicPermission: parent.isPublic ? ((parent as any).publicPermission || 'view') : undefined,
  });
};

export const updatePublic = async (id: string, data: { name?: string }) => {
  const folder = await folderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');
  const updated = await folderDao.updateById(id, data);
  if (!updated) throw new ApiError(404, 'Folder not found');
  return updated;
};

export const removePublic = async (id: string) => {
  const folder = await folderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const childFolders = await folderDao.countChildren(id);
  if (childFolders > 0) throw new ApiError(400, 'Folder is not empty (contains subfolders)');

  const childDocs = await Document.countDocuments({ folderId: id });
  if (childDocs > 0) throw new ApiError(400, 'Folder is not empty (contains documents)');

  await folderDao.deleteById(id);
};

export const getPublicFolder = async (id: string) => {
  const folder = await folderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const isPublic = await isPublicFolder(id);
  if (!isPublic) throw new ApiError(403, 'Folder is not public');

  const breadcrumb = [];
  let current = folder;
  breadcrumb.unshift({ id: current.id, name: current.name });

  while (current.parentId) {
    const parent = await folderDao.findById(current.parentId.toString());
    if (!parent) break;
    breadcrumb.unshift({ id: parent.id, name: parent.name });
    if (parent.isPublic) break;
    current = parent;
  }

  return { ...folder.toJSON(), breadcrumb };
};

export const getPublicFolderTree = async (id: string): Promise<any[]> => {
  const folder = await folderDao.findById(id);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const isPublic = await isPublicFolder(id);
  if (!isPublic) throw new ApiError(403, 'Folder is not public');

  return buildSubtree(folder.ownerId, id);
};

const buildSubtree = async (ownerId: string, parentId: string): Promise<any[]> => {
  const children = await folderDao.listByParent(ownerId, parentId);
  const tree = [];
  for (const child of children) {
    const subtree = await buildSubtree(ownerId, child.id);
    tree.push({ ...child.toJSON(), children: subtree });
  }
  return tree;
};

export const getMetadata = async (id: string, ownerId: string, isAdmin = false) => {
  const folder = await folderDao.findById(id, ownerId, isAdmin);
  if (!folder) throw new ApiError(404, 'Folder not found');

  const [docCount, subfolderCount, totalSize] = await Promise.all([
    documentDao.countByFolder(id),
    folderDao.countByParent(id),
    documentDao.sumSizeByFolder(id),
  ]);

  return {
    ...folder.toJSON(),
    docCount,
    subfolderCount,
    totalSize,
  };
};

export const resolveByPath = async (pathSegments: string[]) => {
  let current = await folderDao.findByNameAndParent(pathSegments[0], null);
  if (!current) throw new ApiError(404, 'Folder not found');

  for (let i = 1; i < pathSegments.length; i++) {
    current = await folderDao.findByNameAndParent(pathSegments[i], current.id);
    if (!current) throw new ApiError(404, 'Folder not found');
  }

  const isPublic = await isPublicFolder(current.id);
  if (!isPublic) throw new ApiError(403, 'Folder is not public');

  return current;
};
