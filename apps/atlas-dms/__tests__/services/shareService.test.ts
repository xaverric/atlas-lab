import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/shareTokenDao.js', () => ({
  findByToken: vi.fn(), findById: vi.fn(), deleteById: vi.fn(), create: vi.fn(), incrementDownloadCount: vi.fn(),
}));
vi.mock('../../src/daos/documentDao.js', () => ({ findById: vi.fn(), listByFolder: vi.fn() }));
vi.mock('../../src/daos/folderDao.js', () => ({ findById: vi.fn(), listByParent: vi.fn() }));
vi.mock('../../src/services/storageService.js', () => ({ getPresignedDownloadUrl: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));
vi.mock('node:crypto', () => ({ default: { randomBytes: vi.fn() } }));

import { create, resolve, verifyPassword, revoke } from '../../src/services/shareService.js';
import * as shareTokenDao from '../../src/daos/shareTokenDao.js';
import * as documentDao from '../../src/daos/documentDao.js';
import * as folderDao from '../../src/daos/folderDao.js';
import * as storageService from '../../src/services/storageService.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

describe('shareService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('create', () => {
    it('creates a document share with token and hashed password', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-1' } as any);
      vi.mocked(crypto.randomBytes).mockReturnValue({ toString: () => 'random-token' } as any);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-pw' as any);
      vi.mocked(shareTokenDao.create).mockResolvedValue({ id: 'share-1' } as any);

      const result = await create({
        documentId: 'doc-1', ownerId: 'user-1', expiresInHours: 24, maxDownloads: 5, password: 'secret',
      });

      expect(documentDao.findById).toHaveBeenCalledWith('doc-1');
      expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
      expect(shareTokenDao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'doc-1',
          folderId: null,
          type: 'document',
          token: 'random-token',
          createdBy: 'user-1',
          maxDownloads: 5,
          password: 'hashed-pw',
        }),
      );
      expect(result).toEqual({ id: 'share-1' });
    });

    it('creates a document share without password', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-1' } as any);
      vi.mocked(crypto.randomBytes).mockReturnValue({ toString: () => 'token-123' } as any);
      vi.mocked(shareTokenDao.create).mockResolvedValue({ id: 'share-2' } as any);

      await create({ documentId: 'doc-1', ownerId: 'user-1', expiresInHours: 1, maxDownloads: 0 });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(shareTokenDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: null }),
      );
    });

    it('creates a folder share', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue({ ownerId: 'user-1' } as any);
      vi.mocked(crypto.randomBytes).mockReturnValue({ toString: () => 'folder-token' } as any);
      vi.mocked(shareTokenDao.create).mockResolvedValue({ id: 'share-3' } as any);

      await create({
        folderId: 'folder-1', type: 'folder', ownerId: 'user-1', expiresInHours: 48, maxDownloads: 10,
      });

      expect(folderDao.findById).toHaveBeenCalledWith('folder-1');
      expect(shareTokenDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: 'folder-1', documentId: null, type: 'folder' }),
      );
    });

    it('throws 400 when documentId missing for document type', async () => {
      await expect(create({
        ownerId: 'user-1', expiresInHours: 1, maxDownloads: 0,
      })).rejects.toThrow('documentId is required');
    });

    it('throws 400 when folderId missing for folder type', async () => {
      await expect(create({
        type: 'folder', ownerId: 'user-1', expiresInHours: 1, maxDownloads: 0,
      })).rejects.toThrow('folderId is required');
    });

    it('throws 404 when document not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(create({
        documentId: 'bad', ownerId: 'user-1', expiresInHours: 1, maxDownloads: 0,
      })).rejects.toThrow('Document not found');
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(create({
        folderId: 'bad', type: 'folder', ownerId: 'user-1', expiresInHours: 1, maxDownloads: 0,
      })).rejects.toThrow('Folder not found');
    });

    it('throws 403 when document owner does not match', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-2' } as any);
      await expect(create({
        documentId: 'doc-1', ownerId: 'user-1', expiresInHours: 1, maxDownloads: 0,
      })).rejects.toThrow('Access denied');
    });

    it('throws 403 when folder owner does not match', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue({ ownerId: 'user-2' } as any);
      await expect(create({
        folderId: 'f1', type: 'folder', ownerId: 'user-1', expiresInHours: 1, maxDownloads: 0,
      })).rejects.toThrow('Access denied');
    });
  });

  describe('resolve', () => {
    const validShare = {
      id: 's1',
      type: 'document',
      documentId: { toString: () => 'doc-1' },
      expiresAt: new Date(Date.now() + 100000),
      maxDownloads: 0,
      downloadCount: 0,
      password: null,
    };

    it('resolves document share and returns download url', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(validShare as any);
      vi.mocked(shareTokenDao.incrementDownloadCount).mockResolvedValue(null as any);
      vi.mocked(documentDao.findById).mockResolvedValue({ storageKey: 'k1', originalName: 'f.pdf' } as any);
      vi.mocked(storageService.getPresignedDownloadUrl).mockResolvedValue('https://s3/url');

      const result = await resolve('token-1');
      expect(result.type).toBe('document');
      expect((result as any).url).toBe('https://s3/url');
      expect(shareTokenDao.incrementDownloadCount).toHaveBeenCalledWith('s1');
    });

    it('resolves folder share with subfolders and documents', async () => {
      const folderShare = {
        id: 's2', type: 'folder',
        folderId: { toString: () => 'f1' },
        expiresAt: new Date(Date.now() + 100000),
        maxDownloads: 0, downloadCount: 0, password: null,
      };
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(folderShare as any);
      vi.mocked(shareTokenDao.incrementDownloadCount).mockResolvedValue(null as any);
      vi.mocked(folderDao.findById).mockResolvedValue({ id: 'f1', ownerId: 'u1' } as any);
      vi.mocked(folderDao.listByParent).mockResolvedValue([] as any);
      vi.mocked(documentDao.listByFolder).mockResolvedValue([{ id: 'd1' }] as any);

      const result = await resolve('token-2');
      expect(result.type).toBe('folder');
      expect((result as any).documents).toEqual([{ id: 'd1' }]);
    });

    it('throws 404 when share not found', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(null as any);
      await expect(resolve('bad-token')).rejects.toThrow('Share link not found');
    });

    it('throws 410 when share expired', async () => {
      const expired = { ...validShare, expiresAt: new Date(Date.now() - 100000) };
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(expired as any);
      await expect(resolve('expired')).rejects.toThrow('Share link has expired');
    });

    it('throws 410 when download limit reached', async () => {
      const maxed = { ...validShare, maxDownloads: 5, downloadCount: 5 };
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(maxed as any);
      await expect(resolve('maxed')).rejects.toThrow('Download limit reached');
    });

    it('throws 401 when share requires password', async () => {
      const locked = { ...validShare, password: 'hashed' };
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(locked as any);
      await expect(resolve('locked')).rejects.toThrow('Password required');
    });

    it('throws 404 when referenced document no longer exists', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(validShare as any);
      vi.mocked(shareTokenDao.incrementDownloadCount).mockResolvedValue(null as any);
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(resolve('orphan')).rejects.toThrow('Document no longer exists');
    });
  });

  describe('verifyPassword', () => {
    const lockedShare = {
      id: 's1', type: 'document',
      documentId: { toString: () => 'doc-1' },
      expiresAt: new Date(Date.now() + 100000),
      maxDownloads: 0, downloadCount: 0,
      password: 'hashed-pw',
    };

    it('resolves share when password is correct', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(lockedShare as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
      vi.mocked(shareTokenDao.incrementDownloadCount).mockResolvedValue(null as any);
      vi.mocked(documentDao.findById).mockResolvedValue({ storageKey: 'k', originalName: 'f.txt' } as any);
      vi.mocked(storageService.getPresignedDownloadUrl).mockResolvedValue('https://url');

      const result = await verifyPassword('token', 'secret');
      expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed-pw');
      expect(result.type).toBe('document');
    });

    it('throws 403 when password is wrong', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(lockedShare as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as any);
      await expect(verifyPassword('token', 'wrong')).rejects.toThrow('Invalid password');
    });

    it('resolves without password check when share has no password', async () => {
      const noPassword = { ...lockedShare, password: null };
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(noPassword as any);
      vi.mocked(shareTokenDao.incrementDownloadCount).mockResolvedValue(null as any);
      vi.mocked(documentDao.findById).mockResolvedValue({ storageKey: 'k', originalName: 'f.txt' } as any);
      vi.mocked(storageService.getPresignedDownloadUrl).mockResolvedValue('https://url');

      const result = await verifyPassword('token', 'anything');
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result.type).toBe('document');
    });

    it('throws 404 when share not found', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(null as any);
      await expect(verifyPassword('bad', 'pw')).rejects.toThrow('Share link not found');
    });

    it('throws 410 when expired', async () => {
      const expired = { ...lockedShare, expiresAt: new Date(Date.now() - 100000) };
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue(expired as any);
      await expect(verifyPassword('expired', 'pw')).rejects.toThrow('Share link has expired');
    });
  });

  describe('revoke', () => {
    it('throws 404 when not found', async () => {
      vi.mocked(shareTokenDao.findByToken).mockRejectedValue(new Error());
      vi.mocked(shareTokenDao.findById).mockResolvedValue(null as any);
      await expect(revoke('unknown', 'user-1')).rejects.toThrow('Share token not found');
    });

    it('throws 403 when non-owner revokes document share', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue({ id: 's1', type: 'document', documentId: 'doc-1' } as any);
      vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-2' } as any);
      await expect(revoke('s1', 'user-1')).rejects.toThrow('Access denied');
    });

    it('throws 403 when non-owner revokes folder share', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue({
        id: 's1', type: 'folder', folderId: 'f1',
      } as any);
      vi.mocked(folderDao.findById).mockResolvedValue({ ownerId: 'user-2' } as any);
      await expect(revoke('s1', 'user-1')).rejects.toThrow('Access denied');
    });

    it('deletes after ownership verified (by token)', async () => {
      vi.mocked(shareTokenDao.findByToken).mockResolvedValue({ id: 's1', type: 'document', documentId: 'doc-1' } as any);
      vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-1' } as any);
      vi.mocked(shareTokenDao.deleteById).mockResolvedValue(null as any);
      await revoke('s1', 'user-1');
      expect(shareTokenDao.deleteById).toHaveBeenCalledWith('s1');
    });

    it('falls back to findById when findByToken fails', async () => {
      vi.mocked(shareTokenDao.findByToken).mockRejectedValue(new Error('not found'));
      vi.mocked(shareTokenDao.findById).mockResolvedValue({ id: 's1', type: 'document', documentId: 'doc-1' } as any);
      vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-1' } as any);
      vi.mocked(shareTokenDao.deleteById).mockResolvedValue(null as any);

      await revoke('s1', 'user-1');
      expect(shareTokenDao.findById).toHaveBeenCalledWith('s1');
      expect(shareTokenDao.deleteById).toHaveBeenCalledWith('s1');
    });
  });
});
