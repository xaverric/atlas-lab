import { ApiError } from '@atlas/core';
import * as documentDao from '../daos/documentDao.js';
import * as storageService from './storageService.js';

interface UploadInput {
  file: Express.Multer.File;
  name: string;
  tags: string[];
  ownerId: string;
  folderId?: string | null;
}

interface ListInput {
  ownerId: string;
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

  return documentDao.create({
    name,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storageKey,
    tags,
    ownerId,
    folderId: folderId || null,
  });
};

export const list = (opts: ListInput) => documentDao.list(opts);

export const getById = async (id: string, ownerId: string) => {
  const doc = await documentDao.findById(id);
  if (!doc) throw new ApiError(404, 'Document not found');
  if (doc.ownerId !== ownerId) throw new ApiError(403, 'Access denied');
  return doc;
};

export const getDownloadUrl = async (id: string, ownerId: string) => {
  const doc = await getById(id, ownerId);
  return storageService.getPresignedDownloadUrl(doc.storageKey, doc.originalName);
};

export const getPreviewUrl = async (id: string, ownerId: string) => {
  const doc = await getById(id, ownerId);
  return storageService.getPresignedInlineUrl(doc.storageKey, doc.originalName);
};

export const update = async (id: string, ownerId: string, data: { name?: string; tags?: string[]; folderId?: string | null }) => {
  const doc = await getById(id, ownerId);
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.folderId !== undefined) updates.folderId = data.folderId;
  const updated = await documentDao.updateById(doc.id, updates as Parameters<typeof documentDao.updateById>[1]);
  if (!updated) throw new ApiError(404, 'Document not found');
  return updated;
};

export const remove = async (id: string, ownerId: string) => {
  const doc = await getById(id, ownerId);
  await storageService.remove(doc.storageKey);
  await documentDao.deleteById(id);
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

export const getTags = (ownerId: string) => documentDao.distinctTags(ownerId);
