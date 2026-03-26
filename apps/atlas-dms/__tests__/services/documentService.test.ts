import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/documentDao.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  list: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  deleteManyByIds: vi.fn(),
  updateManyFolder: vi.fn(),
  findManyByIds: vi.fn(),
  distinctTags: vi.fn(),
  listByFolder: vi.fn(),
}));
vi.mock('../../src/services/storageService.js', () => ({
  upload: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  getPresignedInlineUrl: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../src/services/folderService.js', () => ({
  isPublicFolder: vi.fn(),
  getPublicFolder: vi.fn(),
}));
vi.mock('../../src/services/publishNotification.js', () => ({
  publishNotification: vi.fn(),
}));

import {
  upload, list, getById, getDownloadUrl, getPreviewUrl,
  update, remove, bulkDelete, bulkMove, getTags,
  getPublicDownloadUrl, getPublicPreviewUrl, updatePublic, uploadPublic, removePublic,
} from '../../src/services/documentService.js';
import * as documentDao from '../../src/daos/documentDao.js';
import * as storageService from '../../src/services/storageService.js';
import * as folderService from '../../src/services/folderService.js';
import { publishNotification } from '../../src/services/publishNotification.js';

const mockFile = {
  originalname: 'test.pdf',
  mimetype: 'application/pdf',
  size: 2048,
  buffer: Buffer.from('test'),
} as Express.Multer.File;

const mockDoc = {
  id: 'doc-1',
  name: 'Test Doc',
  originalName: 'test.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  storageKey: 'key-123',
  tags: ['important'],
  ownerId: 'user-1',
  folderId: 'folder-1',
};

describe('documentService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('upload', () => {
    it('uploads file to storage and creates document record', async () => {
      vi.mocked(storageService.upload).mockResolvedValue('key-123');
      vi.mocked(documentDao.create).mockResolvedValue(mockDoc as any);

      const result = await upload({ file: mockFile, name: 'Test Doc', tags: ['important'], ownerId: 'user-1', folderId: 'folder-1' });

      expect(storageService.upload).toHaveBeenCalledWith(mockFile);
      expect(documentDao.create).toHaveBeenCalledWith({
        name: 'Test Doc',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        storageKey: 'key-123',
        tags: ['important'],
        ownerId: 'user-1',
        folderId: 'folder-1',
      });
      expect(result).toEqual(mockDoc);
    });

    it('sets folderId to null when not provided', async () => {
      vi.mocked(storageService.upload).mockResolvedValue('key-123');
      vi.mocked(documentDao.create).mockResolvedValue(mockDoc as any);

      await upload({ file: mockFile, name: 'Test', tags: [], ownerId: 'user-1' });

      expect(documentDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: null }),
      );
    });

    it('sets folderId to null when explicitly passed as null', async () => {
      vi.mocked(storageService.upload).mockResolvedValue('key-123');
      vi.mocked(documentDao.create).mockResolvedValue(mockDoc as any);

      await upload({ file: mockFile, name: 'Test', tags: [], ownerId: 'user-1', folderId: null });

      expect(documentDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: null }),
      );
    });

    it('sets folderId to null when explicitly passed as undefined', async () => {
      vi.mocked(storageService.upload).mockResolvedValue('key-123');
      vi.mocked(documentDao.create).mockResolvedValue(mockDoc as any);

      await upload({ file: mockFile, name: 'Test', tags: [], ownerId: 'user-1', folderId: undefined });

      expect(documentDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: null }),
      );
    });

    it('calls publishNotification with correct args on upload', async () => {
      vi.mocked(storageService.upload).mockResolvedValue('key-123');
      vi.mocked(documentDao.create).mockResolvedValue(mockDoc as any);

      await upload({ file: mockFile, name: 'Test Doc', tags: [], ownerId: 'user-1', folderId: 'folder-1' });

      expect(publishNotification).toHaveBeenCalledWith(
        'user-1',
        'File Uploaded',
        expect.stringContaining('Test Doc'),
        'dms.document.uploaded',
      );
    });
  });

  describe('list', () => {
    it('delegates to documentDao.list', async () => {
      const opts = { ownerId: 'user-1', page: 1, limit: 10 };
      const expected = { data: [mockDoc], total: 1, page: 1, limit: 10 };
      vi.mocked(documentDao.list).mockResolvedValue(expected as any);

      const result = await list(opts);
      expect(documentDao.list).toHaveBeenCalledWith(opts);
      expect(result).toEqual(expected);
    });
  });

  describe('getById', () => {
    it('returns document when found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      const result = await getById('doc-1', 'user-1');
      expect(documentDao.findById).toHaveBeenCalledWith('doc-1', 'user-1', false);
      expect(result).toEqual(mockDoc);
    });

    it('throws 404 when not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(getById('doc-1', 'user-1')).rejects.toThrow('Document not found');
    });

    it('passes isAdmin flag to dao', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      await getById('doc-1', 'user-1', true);
      expect(documentDao.findById).toHaveBeenCalledWith('doc-1', 'user-1', true);
    });
  });

  describe('getDownloadUrl', () => {
    it('returns presigned download url', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(storageService.getPresignedDownloadUrl).mockResolvedValue('https://s3/download');

      const result = await getDownloadUrl('doc-1', 'user-1');
      expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith('key-123', 'test.pdf');
      expect(result).toBe('https://s3/download');
    });

    it('throws 404 when document not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(getDownloadUrl('doc-1', 'user-1')).rejects.toThrow('Document not found');
    });
  });

  describe('getPreviewUrl', () => {
    it('returns presigned inline url', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(storageService.getPresignedInlineUrl).mockResolvedValue('https://s3/preview');

      const result = await getPreviewUrl('doc-1', 'user-1');
      expect(storageService.getPresignedInlineUrl).toHaveBeenCalledWith('key-123', 'test.pdf');
      expect(result).toBe('https://s3/preview');
    });
  });

  describe('update', () => {
    it('updates document fields', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(documentDao.updateById).mockResolvedValue({ ...mockDoc, name: 'Updated' } as any);

      const result = await update('doc-1', 'user-1', { name: 'Updated' });
      expect(documentDao.updateById).toHaveBeenCalledWith('doc-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws 404 when document not found for ownership check', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(update('doc-1', 'user-1', { name: 'X' })).rejects.toThrow('Document not found');
    });

    it('throws 404 when updateById returns null', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(documentDao.updateById).mockResolvedValue(null as any);
      await expect(update('doc-1', 'user-1', { name: 'X' })).rejects.toThrow('Document not found');
    });

    it('only includes defined fields in update', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(documentDao.updateById).mockResolvedValue(mockDoc as any);

      await update('doc-1', 'user-1', { tags: ['new'] });
      expect(documentDao.updateById).toHaveBeenCalledWith('doc-1', { tags: ['new'] });
    });

    it('sends only name when tags is undefined', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(documentDao.updateById).mockResolvedValue({ ...mockDoc, name: 'Only Name' } as any);

      await update('doc-1', 'user-1', { name: 'Only Name' });
      expect(documentDao.updateById).toHaveBeenCalledWith('doc-1', { name: 'Only Name' });
    });

    it('sends only tags when name is undefined', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(documentDao.updateById).mockResolvedValue(mockDoc as any);

      await update('doc-1', 'user-1', { tags: ['alpha', 'beta'] });
      expect(documentDao.updateById).toHaveBeenCalledWith('doc-1', { tags: ['alpha', 'beta'] });
    });
  });

  describe('remove', () => {
    it('removes from storage and database', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(storageService.remove).mockResolvedValue(undefined);
      vi.mocked(documentDao.deleteById).mockResolvedValue(null as any);

      await remove('doc-1', 'user-1');
      expect(storageService.remove).toHaveBeenCalledWith('key-123');
      expect(documentDao.deleteById).toHaveBeenCalledWith('doc-1');
    });

    it('throws 404 when document not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(remove('doc-1', 'user-1')).rejects.toThrow('Document not found');
    });

    it('calls publishNotification with dms.document.deleted event', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(storageService.remove).mockResolvedValue(undefined);
      vi.mocked(documentDao.deleteById).mockResolvedValue(null as any);

      await remove('doc-1', 'user-1');

      expect(publishNotification).toHaveBeenCalledWith(
        'user-1',
        'File Deleted',
        expect.stringContaining('Test Doc'),
        'dms.document.deleted',
      );
    });
  });

  describe('bulkDelete', () => {
    it('deletes storage and db entries for matching docs', async () => {
      const docs = [
        { id: 'd1', storageKey: 'k1' },
        { id: 'd2', storageKey: 'k2' },
      ];
      vi.mocked(documentDao.findManyByIds).mockResolvedValue(docs as any);
      vi.mocked(storageService.remove).mockResolvedValue(undefined);
      vi.mocked(documentDao.deleteManyByIds).mockResolvedValue({ deletedCount: 2 } as any);

      const result = await bulkDelete(['d1', 'd2'], 'user-1');
      expect(storageService.remove).toHaveBeenCalledTimes(2);
      expect(documentDao.deleteManyByIds).toHaveBeenCalledWith(['d1', 'd2'], 'user-1');
      expect(result).toEqual({ deleted: 2 });
    });

    it('returns deleted:0 when no docs match', async () => {
      vi.mocked(documentDao.findManyByIds).mockResolvedValue([]);
      const result = await bulkDelete(['d1'], 'user-1');
      expect(result).toEqual({ deleted: 0 });
    });

    it('does not call storageService.remove or deleteManyByIds when 0 docs match', async () => {
      vi.mocked(documentDao.findManyByIds).mockResolvedValue([]);
      await bulkDelete(['d1'], 'user-1');
      expect(storageService.remove).not.toHaveBeenCalled();
      expect(documentDao.deleteManyByIds).not.toHaveBeenCalled();
    });
  });

  describe('bulkMove', () => {
    it('moves documents to target folder', async () => {
      vi.mocked(documentDao.updateManyFolder).mockResolvedValue({ modifiedCount: 3 } as any);
      const result = await bulkMove(['d1', 'd2', 'd3'], 'user-1', 'folder-2');
      expect(documentDao.updateManyFolder).toHaveBeenCalledWith(['d1', 'd2', 'd3'], 'user-1', 'folder-2');
      expect(result).toEqual({ moved: 3 });
    });

    it('moves documents to root (null folder)', async () => {
      vi.mocked(documentDao.updateManyFolder).mockResolvedValue({ modifiedCount: 1 } as any);
      const result = await bulkMove(['d1'], 'user-1', null);
      expect(documentDao.updateManyFolder).toHaveBeenCalledWith(['d1'], 'user-1', null);
      expect(result).toEqual({ moved: 1 });
    });
  });

  describe('getTags', () => {
    it('returns distinct tags for owner', async () => {
      vi.mocked(documentDao.distinctTags).mockResolvedValue(['pdf', 'report']);
      const result = await getTags('user-1');
      expect(documentDao.distinctTags).toHaveBeenCalledWith('user-1', false);
      expect(result).toEqual(['pdf', 'report']);
    });

    it('passes isAdmin flag', async () => {
      vi.mocked(documentDao.distinctTags).mockResolvedValue(['all-tags']);
      await getTags('user-1', true);
      expect(documentDao.distinctTags).toHaveBeenCalledWith('user-1', true);
    });
  });

  describe('getPublicDownloadUrl', () => {
    it('returns download url for document in public folder', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(true);
      vi.mocked(storageService.getPresignedDownloadUrl).mockResolvedValue('https://s3/pub-dl');

      const result = await getPublicDownloadUrl('doc-1');
      expect(result).toBe('https://s3/pub-dl');
    });

    it('throws 404 when document not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(getPublicDownloadUrl('doc-1')).rejects.toThrow('Document not found');
    });

    it('throws 403 when document is not in a public folder', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(false);
      await expect(getPublicDownloadUrl('doc-1')).rejects.toThrow('Document is not in a public folder');
    });

    it('throws 403 when document has no folderId', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue({ ...mockDoc, folderId: null } as any);
      await expect(getPublicDownloadUrl('doc-1')).rejects.toThrow('Document is not in a public folder');
    });
  });

  describe('getPublicPreviewUrl', () => {
    it('returns inline url for document in public folder', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(true);
      vi.mocked(storageService.getPresignedInlineUrl).mockResolvedValue('https://s3/pub-preview');

      const result = await getPublicPreviewUrl('doc-1');
      expect(result).toBe('https://s3/pub-preview');
    });

    it('throws 404 when document not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(getPublicPreviewUrl('doc-1')).rejects.toThrow('Document not found');
    });

    it('throws 403 when document has no folderId', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue({ ...mockDoc, folderId: null } as any);
      await expect(getPublicPreviewUrl('doc-1')).rejects.toThrow('Document is not in a public folder');
    });

    it('throws 403 when folder is not public', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(false);
      await expect(getPublicPreviewUrl('doc-1')).rejects.toThrow('Document is not in a public folder');
    });
  });

  describe('updatePublic', () => {
    it('updates document in public folder', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(true);
      vi.mocked(documentDao.updateById).mockResolvedValue({ ...mockDoc, name: 'New' } as any);

      const result = await updatePublic('doc-1', { name: 'New' });
      expect(documentDao.updateById).toHaveBeenCalledWith('doc-1', { name: 'New' });
      expect(result.name).toBe('New');
    });

    it('throws 404 when document not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(updatePublic('doc-1', { name: 'X' })).rejects.toThrow('Document not found');
    });

    it('throws 403 when folder is not public', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(false);
      await expect(updatePublic('doc-1', { name: 'X' })).rejects.toThrow('Document is not in a public folder');
    });

    it('throws 404 when updateById returns null', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(true);
      vi.mocked(documentDao.updateById).mockResolvedValue(null as any);
      await expect(updatePublic('doc-1', { name: 'X' })).rejects.toThrow('Document not found');
    });
  });

  describe('uploadPublic', () => {
    it('uploads to a public folder using folder owner', async () => {
      vi.mocked(folderService.getPublicFolder).mockResolvedValue({ ownerId: 'owner-1' } as any);
      vi.mocked(storageService.upload).mockResolvedValue('key-pub');
      vi.mocked(documentDao.create).mockResolvedValue(mockDoc as any);

      await uploadPublic({ file: mockFile, name: 'Public Doc', tags: [], folderId: 'folder-pub' });

      expect(folderService.getPublicFolder).toHaveBeenCalledWith('folder-pub');
      expect(documentDao.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 'owner-1', folderId: 'folder-pub' }),
      );
    });
  });

  describe('removePublic', () => {
    it('removes document from public folder', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(true);
      vi.mocked(storageService.remove).mockResolvedValue(undefined);
      vi.mocked(documentDao.deleteById).mockResolvedValue(null as any);

      await removePublic('doc-1');
      expect(storageService.remove).toHaveBeenCalledWith('key-123');
      expect(documentDao.deleteById).toHaveBeenCalledWith('doc-1');
    });

    it('throws 404 when document not found', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(null as any);
      await expect(removePublic('doc-1')).rejects.toThrow('Document not found');
    });

    it('throws 403 when folder is not public', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(folderService.isPublicFolder).mockResolvedValue(false);
      await expect(removePublic('doc-1')).rejects.toThrow('Document is not in a public folder');
    });

    it('throws 403 when document has no folderId', async () => {
      vi.mocked(documentDao.findById).mockResolvedValue({ ...mockDoc, folderId: null } as any);
      await expect(removePublic('doc-1')).rejects.toThrow('Document is not in a public folder');
    });
  });
});
