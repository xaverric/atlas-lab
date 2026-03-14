import crypto from 'node:crypto';
import { ApiError } from '@atlas/core';
import * as shareTokenDao from '../daos/shareTokenDao.js';
import * as documentDao from '../daos/documentDao.js';
import * as storageService from './storageService.js';

interface CreateShareInput {
  documentId: string;
  ownerId: string;
  expiresInHours: number;
  maxDownloads: number;
}

export const create = async ({ documentId, ownerId, expiresInHours, maxDownloads }: CreateShareInput) => {
  const doc = await documentDao.findById(documentId);
  if (!doc) throw new ApiError(404, 'Document not found');
  if (doc.ownerId !== ownerId) throw new ApiError(403, 'Access denied');

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  return shareTokenDao.create({
    documentId,
    token,
    createdBy: ownerId,
    expiresAt,
    maxDownloads,
  });
};

export const resolve = async (token: string) => {
  const share = await shareTokenDao.findByToken(token);
  if (!share) throw new ApiError(404, 'Share link not found');

  if (share.expiresAt < new Date()) {
    throw new ApiError(410, 'Share link has expired');
  }

  if (share.maxDownloads > 0 && share.downloadCount >= share.maxDownloads) {
    throw new ApiError(410, 'Download limit reached');
  }

  const doc = await documentDao.findById(share.documentId.toString());
  if (!doc) throw new ApiError(404, 'Document no longer exists');

  await shareTokenDao.incrementDownloadCount(share.id);

  const url = await storageService.getPresignedDownloadUrl(doc.storageKey, doc.originalName);
  return { url, document: doc };
};

export const revoke = async (id: string, ownerId: string) => {
  const share = await shareTokenDao.findByToken(id).catch(() => null);
  const shareById = share || await shareTokenDao.deleteById(id);
  if (!shareById) throw new ApiError(404, 'Share token not found');

  const doc = await documentDao.findById((shareById as any).documentId?.toString());
  if (doc && doc.ownerId !== ownerId) throw new ApiError(403, 'Access denied');

  await shareTokenDao.deleteById((shareById as any).id || id);
};
