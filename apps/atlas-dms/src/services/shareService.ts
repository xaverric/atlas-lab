import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ApiError } from '@atlas/core';
import * as shareTokenDao from '../daos/shareTokenDao.js';
import * as documentDao from '../daos/documentDao.js';
import * as folderDao from '../daos/folderDao.js';
import * as storageService from './storageService.js';

interface CreateShareInput {
  documentId?: string;
  folderId?: string;
  type?: 'document' | 'folder';
  ownerId: string;
  expiresInHours: number;
  maxDownloads: number;
  password?: string;
}

export const create = async ({ documentId, folderId, type = 'document', ownerId, expiresInHours, maxDownloads, password }: CreateShareInput) => {
  if (type === 'document') {
    if (!documentId) throw new ApiError(400, 'documentId is required for document shares');
    const doc = await documentDao.findById(documentId);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (doc.ownerId !== ownerId) throw new ApiError(403, 'Access denied');
  } else {
    if (!folderId) throw new ApiError(400, 'folderId is required for folder shares');
    const folder = await folderDao.findById(folderId);
    if (!folder) throw new ApiError(404, 'Folder not found');
    if (folder.ownerId !== ownerId) throw new ApiError(403, 'Access denied');
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

  return shareTokenDao.create({
    documentId: type === 'document' ? documentId : null,
    folderId: type === 'folder' ? folderId : null,
    type,
    token,
    createdBy: ownerId,
    expiresAt,
    maxDownloads,
    password: hashedPassword,
  });
};

const validateShare = async (share: any) => {
  if (share.expiresAt < new Date()) {
    throw new ApiError(410, 'Share link has expired');
  }
  if (share.maxDownloads > 0 && share.downloadCount >= share.maxDownloads) {
    throw new ApiError(410, 'Download limit reached');
  }
};

export const resolve = async (token: string) => {
  const share = await shareTokenDao.findByToken(token);
  if (!share) throw new ApiError(404, 'Share link not found');
  await validateShare(share);

  if (share.password) {
    throw new ApiError(401, 'Password required');
  }

  return resolveShareContent(share);
};

export const verifyPassword = async (token: string, password: string) => {
  const share = await shareTokenDao.findByToken(token);
  if (!share) throw new ApiError(404, 'Share link not found');
  await validateShare(share);

  if (!share.password) return resolveShareContent(share);

  const valid = await bcrypt.compare(password, share.password);
  if (!valid) throw new ApiError(403, 'Invalid password');

  return resolveShareContent(share);
};

const resolveShareContent = async (share: any) => {
  await shareTokenDao.incrementDownloadCount(share.id);

  if (share.type === 'folder') {
    const folder = await folderDao.findById(share.folderId.toString());
    if (!folder) throw new ApiError(404, 'Folder no longer exists');
    const subfolders = await folderDao.listByParent(folder.ownerId, folder.id);
    const documents = await documentDao.listByFolder(folder.id);
    return { type: 'folder', folder, subfolders, documents };
  }

  const doc = await documentDao.findById(share.documentId.toString());
  if (!doc) throw new ApiError(404, 'Document no longer exists');
  const url = await storageService.getPresignedDownloadUrl(doc.storageKey, doc.originalName);
  return { type: 'document', url, document: doc };
};

export const revoke = async (id: string, ownerId: string) => {
  const share = await shareTokenDao.findByToken(id).catch(() => null);
  const shareById = share || await shareTokenDao.deleteById(id);
  if (!shareById) throw new ApiError(404, 'Share token not found');

  if ((shareById as any).type === 'folder' && (shareById as any).folderId) {
    const folder = await folderDao.findById((shareById as any).folderId.toString());
    if (folder && folder.ownerId !== ownerId) throw new ApiError(403, 'Access denied');
  } else if ((shareById as any).documentId) {
    const doc = await documentDao.findById((shareById as any).documentId.toString());
    if (doc && doc.ownerId !== ownerId) throw new ApiError(403, 'Access denied');
  }

  await shareTokenDao.deleteById((shareById as any).id || id);
};
