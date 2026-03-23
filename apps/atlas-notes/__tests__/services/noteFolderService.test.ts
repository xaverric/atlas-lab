import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/noteFolderDao.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  listByParent: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  countChildren: vi.fn(),
  findAiAccessible: vi.fn(),
}));

vi.mock('../../src/daos/noteDao.js', () => ({
  countByFolder: vi.fn(),
  totalSizeByFolder: vi.fn(),
}));

vi.mock('../../src/models/Note.js', () => ({
  Note: { countDocuments: vi.fn() },
}));

vi.mock('../../src/models/NoteFolder.js', () => ({
  NoteFolder: { find: vi.fn() },
}));

import * as noteFolderService from '../../src/services/noteFolderService.js';
import * as noteFolderDao from '../../src/daos/noteFolderDao.js';
import * as noteDao from '../../src/daos/noteDao.js';
import { Note } from '../../src/models/Note.js';

describe('noteFolderService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const makeFolder = (overrides = {}) => ({
    id: 'f1',
    name: 'Folder',
    parentId: null,
    ownerId: 'user-1',
    visibility: 'private',
    publicPermission: 'view',
    toJSON: function () { return { id: this.id, name: this.name, parentId: this.parentId, ownerId: this.ownerId }; },
    ...overrides,
  });

  describe('create', () => {
    it('creates root folder', async () => {
      vi.mocked(noteFolderDao.create).mockResolvedValue(makeFolder() as any);

      await noteFolderService.create('Folder', 'user-1');

      expect(noteFolderDao.create).toHaveBeenCalledWith({ name: 'Folder', parentId: null, ownerId: 'user-1' });
    });

    it('creates subfolder under existing parent', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder({ visibility: 'private' }) as any);
      vi.mocked(noteFolderDao.create).mockResolvedValue(makeFolder({ parentId: 'f1' }) as any);

      await noteFolderService.create('Sub', 'user-1', 'f1');

      expect(noteFolderDao.create).toHaveBeenCalledWith({ name: 'Sub', parentId: 'f1', ownerId: 'user-1' });
    });

    it('throws 404 when parent not found', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(null as any);

      await expect(noteFolderService.create('Sub', 'user-1', 'bad-id')).rejects.toThrow('Parent folder not found');
    });

    it('inherits public visibility from parent', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(
        makeFolder({ visibility: 'public', publicPermission: 'edit' }) as any,
      );
      vi.mocked(noteFolderDao.create).mockResolvedValue(makeFolder() as any);

      await noteFolderService.create('Sub', 'user-1', 'f1');

      expect(noteFolderDao.create).toHaveBeenCalledWith({
        name: 'Sub',
        parentId: 'f1',
        ownerId: 'user-1',
        visibility: 'public',
        publicPermission: 'edit',
      });
    });
  });

  describe('listByParent', () => {
    it('delegates to dao', async () => {
      vi.mocked(noteFolderDao.listByParent).mockResolvedValue([]);
      await noteFolderService.listByParent('user-1', null);
      expect(noteFolderDao.listByParent).toHaveBeenCalledWith('user-1', null, false);
    });
  });

  describe('getById', () => {
    it('returns folder with breadcrumb', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder() as any);

      const result = await noteFolderService.getById('f1', 'user-1');

      expect(result.breadcrumb).toEqual([{ id: 'f1', name: 'Folder' }]);
    });

    it('builds breadcrumb with parent chain', async () => {
      const child = makeFolder({ id: 'f2', name: 'Child', parentId: 'f1' });
      const parent = makeFolder({ id: 'f1', name: 'Parent', parentId: null });

      vi.mocked(noteFolderDao.findById)
        .mockResolvedValueOnce(child as any)
        .mockResolvedValueOnce(parent as any);

      const result = await noteFolderService.getById('f2', 'user-1');

      expect(result.breadcrumb).toEqual([
        { id: 'f1', name: 'Parent' },
        { id: 'f2', name: 'Child' },
      ]);
    });

    it('throws 404 when not found', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(null as any);
      await expect(noteFolderService.getById('f1', 'user-1')).rejects.toThrow('Folder not found');
    });
  });

  describe('update', () => {
    it('updates folder', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder() as any);
      vi.mocked(noteFolderDao.updateById).mockResolvedValue(makeFolder({ name: 'New' }) as any);

      const result = await noteFolderService.update('f1', 'user-1', { name: 'New' });

      expect(noteFolderDao.updateById).toHaveBeenCalledWith('f1', { name: 'New' });
      expect(result.name).toBe('New');
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(null as any);
      await expect(noteFolderService.update('f1', 'u1', { name: 'X' })).rejects.toThrow('Folder not found');
    });

    it('throws 400 when moving folder into itself', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder() as any);
      await expect(noteFolderService.update('f1', 'u1', { parentId: 'f1' })).rejects.toThrow('Cannot move folder into itself');
    });

    it('throws 404 when update returns null', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder() as any);
      vi.mocked(noteFolderDao.updateById).mockResolvedValue(null as any);
      await expect(noteFolderService.update('f1', 'u1', { name: 'X' })).rejects.toThrow('Folder not found');
    });
  });

  describe('remove', () => {
    it('deletes empty folder', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder() as any);
      vi.mocked(noteFolderDao.countChildren).mockResolvedValue(0 as any);
      vi.mocked(Note.countDocuments).mockResolvedValue(0 as any);
      vi.mocked(noteFolderDao.deleteById).mockResolvedValue(null as any);

      await noteFolderService.remove('f1', 'user-1');

      expect(noteFolderDao.deleteById).toHaveBeenCalledWith('f1');
    });

    it('throws when folder has subfolders', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder() as any);
      vi.mocked(noteFolderDao.countChildren).mockResolvedValue(2 as any);

      await expect(noteFolderService.remove('f1', 'u1')).rejects.toThrow('contains subfolders');
    });

    it('throws when folder has notes', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder() as any);
      vi.mocked(noteFolderDao.countChildren).mockResolvedValue(0 as any);
      vi.mocked(Note.countDocuments).mockResolvedValue(3 as any);

      await expect(noteFolderService.remove('f1', 'u1')).rejects.toThrow('contains notes');
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(null as any);
      await expect(noteFolderService.remove('f1', 'u1')).rejects.toThrow('Folder not found');
    });
  });

  describe('isFolderPublic', () => {
    it('returns true when folder is public', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder({ visibility: 'public' }) as any);
      expect(await noteFolderService.isFolderPublic('f1')).toBe(true);
    });

    it('returns false when folder is private with no parent', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder({ visibility: 'private' }) as any);
      expect(await noteFolderService.isFolderPublic('f1')).toBe(false);
    });

    it('walks up to find public ancestor', async () => {
      const child = makeFolder({ id: 'f2', visibility: 'private', parentId: 'f1' });
      const parent = makeFolder({ id: 'f1', visibility: 'public' });

      vi.mocked(noteFolderDao.findById)
        .mockResolvedValueOnce(child as any)
        .mockResolvedValueOnce(parent as any);

      expect(await noteFolderService.isFolderPublic('f2')).toBe(true);
    });

    it('returns false when folder not found', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(null as any);
      expect(await noteFolderService.isFolderPublic('f1')).toBe(false);
    });
  });

  describe('resolvePublicPermission', () => {
    it('returns permission from public folder', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(
        makeFolder({ visibility: 'public', publicPermission: 'edit' }) as any,
      );
      expect(await noteFolderService.resolvePublicPermission('f1')).toBe('edit');
    });

    it('defaults to view when no publicPermission set', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(
        makeFolder({ visibility: 'public', publicPermission: undefined }) as any,
      );
      expect(await noteFolderService.resolvePublicPermission('f1')).toBe('view');
    });
  });

  describe('getAiAccessibleFolderIds', () => {
    it('returns IDs of AI-accessible folders', async () => {
      vi.mocked(noteFolderDao.findAiAccessible).mockResolvedValue([
        { id: 'f1' }, { id: 'f2' },
      ] as any);

      const result = await noteFolderService.getAiAccessibleFolderIds('user-1');
      expect(result).toEqual(['f1', 'f2']);
    });
  });

  describe('getMetadata', () => {
    it('returns folder metadata with counts', async () => {
      vi.mocked(noteFolderDao.findById).mockResolvedValue(makeFolder({ name: 'Docs' }) as any);
      vi.mocked(noteDao.countByFolder).mockResolvedValue(5 as any);
      vi.mocked(noteFolderDao.countChildren).mockResolvedValue(2 as any);
      vi.mocked(noteDao.totalSizeByFolder).mockResolvedValue(1024 as any);

      const result = await noteFolderService.getMetadata('f1', 'user-1');

      expect(result).toEqual({ id: 'f1', name: 'Docs', noteCount: 5, subfolderCount: 2, totalSize: 1024 });
    });
  });

  describe('listWithCounts', () => {
    it('enriches folders with noteCount and totalSize', async () => {
      const folders = [makeFolder({ id: 'f1', name: 'A' }), makeFolder({ id: 'f2', name: 'B' })];
      vi.mocked(noteFolderDao.listByParent).mockResolvedValue(folders as any);
      vi.mocked(noteDao.countByFolder).mockResolvedValue(3 as any);
      vi.mocked(noteDao.totalSizeByFolder).mockResolvedValue(512 as any);

      const result = await noteFolderService.listWithCounts('user-1', null);

      expect(result).toHaveLength(2);
      expect(result[0].noteCount).toBe(3);
      expect(result[0].totalSize).toBe(512);
    });
  });
});
