import { ApiError } from '@atlas/core';
import * as documentDao from '../daos/documentDao.js';
import * as storageService from './storageService.js';
import * as folderService from './folderService.js';
import { publishNotification } from './publishNotification.js';

interface UploadInput {
  file: Express.Multer.File;
  name: string;
  tags: string[];
  ownerId: string;
  folderId?: string | null;
}

interface ListInput {
  ownerId: string;
  isAdmin?: boolean;
  folderId?: string | null;
  tags?: string[];
  search?: string;
  mimeType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export const upload = async ({ file, name, tags, ownerId, folderId }: UploadInput) => {
  const storageKey = await storageService.upload(file);

  const doc = await documentDao.create({
    name,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storageKey,
    tags,
    ownerId,
    folderId: folderId || null,
  });

  publishNotification(
    ownerId,
    'File Uploaded',
    `"${name}" (${(file.size / 1024).toFixed(1)} KB) has been uploaded.`,
    'dms.document.uploaded',
  );

  return doc;
};

export const list = (opts: ListInput) => documentDao.list(opts);

export const getById = async (id: string, ownerId: string, isAdmin = false) => {
  const doc = await documentDao.findById(id, ownerId, isAdmin);
  if (!doc) throw new ApiError(404, 'Document not found');
  return doc;
};

export const getDownloadUrl = async (id: string, ownerId: string, isAdmin = false) => {
  const doc = await getById(id, ownerId, isAdmin);
  return storageService.getPresignedDownloadUrl(doc.storageKey, doc.originalName);
};

export const getPreviewUrl = async (id: string, ownerId: string, isAdmin = false) => {
  const doc = await getById(id, ownerId, isAdmin);
  return storageService.getPresignedInlineUrl(doc.storageKey, doc.originalName);
};

export const update = async (id: string, ownerId: string, data: { name?: string; tags?: string[]; folderId?: string | null }, isAdmin = false) => {
  const doc = await getById(id, ownerId, isAdmin);
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.folderId !== undefined) updates.folderId = data.folderId;
  const updated = await documentDao.updateById(doc.id, updates as Parameters<typeof documentDao.updateById>[1]);
  if (!updated) throw new ApiError(404, 'Document not found');
  return updated;
};

export const remove = async (id: string, ownerId: string, isAdmin = false) => {
  const doc = await getById(id, ownerId, isAdmin);
  await storageService.remove(doc.storageKey);
  await documentDao.deleteById(id);

  publishNotification(
    ownerId,
    'File Deleted',
    `"${doc.name}" has been deleted.`,
    'dms.document.deleted',
  );
};

export const bulkDelete = async (ids: string[], ownerId: string) => {
  const docs = await documentDao.findManyByIds(ids, ownerId);
  if (docs.length === 0) return { deleted: 0 };
  await Promise.all(docs.map((d) => storageService.remove(d.storageKey)));
  const result = await documentDao.deleteManyByIds(
    docs.map((d) => d.id),
    ownerId,
  );
  return { deleted: result.deletedCount };
};

export const bulkMove = async (ids: string[], ownerId: string, folderId: string | null) => {
  const result = await documentDao.updateManyFolder(ids, ownerId, folderId);
  return { moved: result.modifiedCount };
};

export const getTags = (ownerId: string, isAdmin = false) => documentDao.distinctTags(ownerId, isAdmin);

const verifyDocPublic = async (doc: any) => {
  if (!doc.folderId) throw new ApiError(403, 'Document is not in a public folder');
  const isPublic = await folderService.isPublicFolder(doc.folderId.toString());
  if (!isPublic) throw new ApiError(403, 'Document is not in a public folder');
};

export const getPublicDownloadUrl = async (id: string) => {
  const doc = await documentDao.findById(id);
  if (!doc) throw new ApiError(404, 'Document not found');
  await verifyDocPublic(doc);
  return storageService.getPresignedDownloadUrl(doc.storageKey, doc.originalName);
};

export const getPublicPreviewUrl = async (id: string) => {
  const doc = await documentDao.findById(id);
  if (!doc) throw new ApiError(404, 'Document not found');
  await verifyDocPublic(doc);
  return storageService.getPresignedInlineUrl(doc.storageKey, doc.originalName);
};

export const updatePublic = async (id: string, data: { name?: string; tags?: string[] }) => {
  const doc = await documentDao.findById(id);
  if (!doc) throw new ApiError(404, 'Document not found');
  await verifyDocPublic(doc);
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.tags !== undefined) updates.tags = data.tags;
  const updated = await documentDao.updateById(doc.id, updates as Parameters<typeof documentDao.updateById>[1]);
  if (!updated) throw new ApiError(404, 'Document not found');
  return updated;
};

export const uploadPublic = async ({ file, name, tags, folderId }: { file: Express.Multer.File; name: string; tags: string[]; folderId: string }) => {
  const folder = await folderService.getPublicFolder(folderId);
  const storageKey = await storageService.upload(file);
  return documentDao.create({
    name,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storageKey,
    tags,
    ownerId: folder.ownerId,
    folderId,
  });
};

export const removePublic = async (id: string) => {
  const doc = await documentDao.findById(id);
  if (!doc) throw new ApiError(404, 'Document not found');
  await verifyDocPublic(doc);
  await storageService.remove(doc.storageKey);
  await documentDao.deleteById(id);
};
