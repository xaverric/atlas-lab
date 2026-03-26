import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/folderDao.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  listByParent: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  countChildren: vi.fn(),
  countByParent: vi.fn(),
  findByNameAndParent: vi.fn(),
  updateIsPublic: vi.fn(),
}));
vi.mock('../../src/daos/documentDao.js', () => ({
  countByFolder: vi.fn(),
  sumSizeByFolder: vi.fn(),
}));
vi.mock('../../src/models/Document.js', () => ({
  Document: { countDocuments: vi.fn() },
}));
vi.mock('../../src/services/publishNotification.js', () => ({
  publishNotification: vi.fn(),
}));

import {
  create, listByParent, getById, update, remove,
  setPublic, isPublicFolder, resolvePublicPermission,
  getPublicFolderOwner, createPublic, updatePublic, removePublic,
  getPublicFolder, getPublicFolderTree, getMetadata, resolveByPath,
} from '../../src/services/folderService.js';
import * as folderDao from '../../src/daos/folderDao.js';
import * as documentDao from '../../src/daos/documentDao.js';
import { Document } from '../../src/models/Document.js';
import { publishNotification } from '../../src/services/publishNotification.js';

const mockFolder = {
  id: 'f1',
  name: 'Docs',
  parentId: null,
  ownerId: 'user-1',
  isPublic: false,
  toJSON: () => ({ id: 'f1', name: 'Docs', parentId: null, ownerId: 'user-1', isPublic: false }),
};

const mockPublicFolder = {
  id: 'f2',
  name: 'Public',
  parentId: null,
  ownerId: 'user-1',
  isPublic: true,
  publicPermission: 'edit',
  toJSON: () => ({ id: 'f2', name: 'Public', parentId: null, ownerId: 'user-1', isPublic: true }),
};

describe('folderService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('create', () => {
    it('creates a root folder', async () => {
      vi.mocked(folderDao.create).mockResolvedValue(mockFolder as any);
      const result = await create('Docs', 'user-1');
      expect(folderDao.create).toHaveBeenCalledWith({ name: 'Docs', parentId: null, ownerId: 'user-1' });
      expect(result).toEqual(mockFolder);
    });

    it('creates a child folder under existing parent', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.create).mockResolvedValue({ ...mockFolder, parentId: 'f1' } as any);

      await create('Sub', 'user-1', 'f1');
      expect(folderDao.findById).toHaveBeenCalledWith('f1', 'user-1', false);
      expect(folderDao.create).toHaveBeenCalledWith({ name: 'Sub', parentId: 'f1', ownerId: 'user-1' });
    });

    it('throws 404 when parent not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(create('Sub', 'user-1', 'bad-id')).rejects.toThrow('Parent folder not found');
    });

    it('inherits public flag from public parent', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockPublicFolder as any);
      vi.mocked(folderDao.create).mockResolvedValue(mockPublicFolder as any);

      await create('Child', 'user-1', 'f2');
      expect(folderDao.create).toHaveBeenCalledWith({
        name: 'Child',
        parentId: 'f2',
        ownerId: 'user-1',
        isPublic: true,
        publicPermission: 'edit',
      });
    });

    it('defaults publicPermission to view when public parent has none', async () => {
      const publicNoPermission = { id: 'fp', name: 'Pub', parentId: null, ownerId: 'user-1', isPublic: true };
      vi.mocked(folderDao.findById).mockResolvedValue(publicNoPermission as any);
      vi.mocked(folderDao.create).mockResolvedValue({} as any);

      await create('Child', 'user-1', 'fp');
      expect(folderDao.create).toHaveBeenCalledWith({
        name: 'Child',
        parentId: 'fp',
        ownerId: 'user-1',
        isPublic: true,
        publicPermission: 'view',
      });
    });

    it('non-public parent creates regular folder without isPublic', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.create).mockResolvedValue(mockFolder as any);

      await create('Child', 'user-1', 'f1');
      expect(folderDao.create).toHaveBeenCalledWith({
        name: 'Child',
        parentId: 'f1',
        ownerId: 'user-1',
      });
    });

    it('fires notification with dms.folder.created event', async () => {
      vi.mocked(folderDao.create).mockResolvedValue(mockFolder as any);

      await create('Docs', 'user-1');
      expect(publishNotification).toHaveBeenCalledWith(
        'user-1',
        'Folder Created',
        'Folder "Docs" has been created.',
        'dms.folder.created',
      );
    });
  });

  describe('listByParent', () => {
    it('delegates to folderDao', async () => {
      vi.mocked(folderDao.listByParent).mockResolvedValue([mockFolder] as any);
      const result = await listByParent('user-1', null);
      expect(folderDao.listByParent).toHaveBeenCalledWith('user-1', null, false);
      expect(result).toEqual([mockFolder]);
    });
  });

  describe('getById', () => {
    it('returns folder with breadcrumb for root folder', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      const result = await getById('f1', 'user-1');
      expect(result.breadcrumb).toEqual([{ id: 'f1', name: 'Docs' }]);
    });

    it('builds breadcrumb for nested folder', async () => {
      const child = {
        id: 'f-child', name: 'Child', parentId: 'f1', ownerId: 'user-1',
        toJSON: () => ({ id: 'f-child', name: 'Child', parentId: 'f1', ownerId: 'user-1' }),
      };
      vi.mocked(folderDao.findById)
        .mockResolvedValueOnce(child as any)
        .mockResolvedValueOnce(mockFolder as any);

      const result = await getById('f-child', 'user-1');
      expect(result.breadcrumb).toEqual([
        { id: 'f1', name: 'Docs' },
        { id: 'f-child', name: 'Child' },
      ]);
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(getById('bad', 'user-1')).rejects.toThrow('Folder not found');
    });
  });

  describe('update', () => {
    it('updates folder name', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.updateById).mockResolvedValue({ ...mockFolder, name: 'Renamed' } as any);

      const result = await update('f1', 'user-1', { name: 'Renamed' });
      expect(folderDao.updateById).toHaveBeenCalledWith('f1', { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(update('bad', 'user-1', { name: 'X' })).rejects.toThrow('Folder not found');
    });

    it('throws 400 when moving folder into itself', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      await expect(update('f1', 'user-1', { parentId: 'f1' })).rejects.toThrow('Cannot move folder into itself');
    });

    it('throws 404 when updateById returns null', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.updateById).mockResolvedValue(null as any);
      await expect(update('f1', 'user-1', { name: 'X' })).rejects.toThrow('Folder not found');
    });
  });

  describe('remove', () => {
    it('deletes empty folder', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.countChildren).mockResolvedValue(0);
      vi.mocked(Document.countDocuments).mockResolvedValue(0);
      vi.mocked(folderDao.deleteById).mockResolvedValue(null as any);

      await remove('f1', 'user-1');
      expect(folderDao.deleteById).toHaveBeenCalledWith('f1');
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(remove('bad', 'user-1')).rejects.toThrow('Folder not found');
    });

    it('throws 400 when folder has subfolders', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.countChildren).mockResolvedValue(2);
      await expect(remove('f1', 'user-1')).rejects.toThrow('contains subfolders');
    });

    it('throws 400 when folder has documents', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.countChildren).mockResolvedValue(0);
      vi.mocked(Document.countDocuments).mockResolvedValue(5);
      await expect(remove('f1', 'user-1')).rejects.toThrow('contains documents');
    });
  });

  describe('setPublic', () => {
    it('sets folder to public', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.updateIsPublic).mockResolvedValue(mockPublicFolder as any);

      const result = await setPublic('f1', true, 'user-1', false, 'edit');
      expect(folderDao.updateIsPublic).toHaveBeenCalledWith('f1', true, 'edit');
      expect(result).toEqual(mockPublicFolder);
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(setPublic('bad', true, 'user-1')).rejects.toThrow('Folder not found');
    });
  });

  describe('isPublicFolder', () => {
    it('returns true for directly public folder', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockPublicFolder as any);
      expect(await isPublicFolder('f2')).toBe(true);
    });

    it('returns true when ancestor is public', async () => {
      const child = { id: 'fc', isPublic: false, parentId: 'f2' };
      vi.mocked(folderDao.findById)
        .mockResolvedValueOnce(child as any)
        .mockResolvedValueOnce(mockPublicFolder as any);
      expect(await isPublicFolder('fc')).toBe(true);
    });

    it('returns false when no ancestor is public', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      expect(await isPublicFolder('f1')).toBe(false);
    });

    it('returns false when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      expect(await isPublicFolder('bad')).toBe(false);
    });
  });

  describe('resolvePublicPermission', () => {
    it('returns permission from public ancestor', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockPublicFolder as any);
      expect(await resolvePublicPermission('f2')).toBe('edit');
    });

    it('defaults to view when no publicPermission set', async () => {
      const pubNoPermission = { id: 'fp', isPublic: true };
      vi.mocked(folderDao.findById).mockResolvedValue(pubNoPermission as any);
      expect(await resolvePublicPermission('fp')).toBe('view');
    });

    it('returns null for non-public folder', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      expect(await resolvePublicPermission('f1')).toBeNull();
    });
  });

  describe('getPublicFolderOwner', () => {
    it('returns ownerId', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      expect(await getPublicFolderOwner('f1')).toBe('user-1');
    });

    it('throws 404 when not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(getPublicFolderOwner('bad')).rejects.toThrow('Folder not found');
    });
  });

  describe('createPublic', () => {
    it('creates child with parent public settings', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockPublicFolder as any);
      vi.mocked(folderDao.create).mockResolvedValue({} as any);

      await createPublic('New', 'f2');
      expect(folderDao.create).toHaveBeenCalledWith({
        name: 'New',
        parentId: 'f2',
        ownerId: 'user-1',
        isPublic: true,
        publicPermission: 'edit',
      });
    });

    it('throws 404 when parent not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(createPublic('X', 'bad')).rejects.toThrow('Parent folder not found');
    });
  });

  describe('updatePublic', () => {
    it('updates folder name', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.updateById).mockResolvedValue({ ...mockFolder, name: 'New' } as any);

      const result = await updatePublic('f1', { name: 'New' });
      expect(result.name).toBe('New');
    });

    it('throws 404 when not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(updatePublic('bad', { name: 'X' })).rejects.toThrow('Folder not found');
    });

    it('throws 404 when updateById returns null', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.updateById).mockResolvedValue(null as any);
      await expect(updatePublic('f1', { name: 'X' })).rejects.toThrow('Folder not found');
    });
  });

  describe('removePublic', () => {
    it('deletes empty public folder', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.countChildren).mockResolvedValue(0);
      vi.mocked(Document.countDocuments).mockResolvedValue(0);
      vi.mocked(folderDao.deleteById).mockResolvedValue(null as any);

      await removePublic('f1');
      expect(folderDao.deleteById).toHaveBeenCalledWith('f1');
    });

    it('throws 404 when not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(removePublic('bad')).rejects.toThrow('Folder not found');
    });

    it('throws 400 when has subfolders', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.countChildren).mockResolvedValue(1);
      await expect(removePublic('f1')).rejects.toThrow('contains subfolders');
    });

    it('throws 400 when has documents', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.countChildren).mockResolvedValue(0);
      vi.mocked(Document.countDocuments).mockResolvedValue(3);
      await expect(removePublic('f1')).rejects.toThrow('contains documents');
    });
  });

  describe('getPublicFolder', () => {
    it('returns folder with breadcrumb when public', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockPublicFolder as any);

      const result = await getPublicFolder('f2');
      expect(result.breadcrumb).toEqual([{ id: 'f2', name: 'Public' }]);
    });

    it('throws 404 when not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(getPublicFolder('bad')).rejects.toThrow('Folder not found');
    });

    it('throws 403 when not public', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      await expect(getPublicFolder('f1')).rejects.toThrow('Folder is not public');
    });
  });

  describe('getPublicFolderTree', () => {
    it('returns tree of subfolders', async () => {
      const child = { id: 'fc', name: 'Child', toJSON: () => ({ id: 'fc', name: 'Child' }) };
      vi.mocked(folderDao.findById).mockResolvedValue(mockPublicFolder as any);
      vi.mocked(folderDao.listByParent)
        .mockResolvedValueOnce([child] as any)
        .mockResolvedValueOnce([] as any);

      const tree = await getPublicFolderTree('f2');
      expect(tree).toEqual([{ id: 'fc', name: 'Child', children: [] }]);
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(getPublicFolderTree('bad')).rejects.toThrow('Folder not found');
    });

    it('throws 403 when not public', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      await expect(getPublicFolderTree('f1')).rejects.toThrow('Folder is not public');
    });
  });

  describe('getMetadata', () => {
    it('returns folder with counts and total size', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(documentDao.countByFolder).mockResolvedValue(5);
      vi.mocked(folderDao.countByParent).mockResolvedValue(2);
      vi.mocked(documentDao.sumSizeByFolder).mockResolvedValue(102400);

      const result = await getMetadata('f1', 'user-1');
      expect(result.docCount).toBe(5);
      expect(result.subfolderCount).toBe(2);
      expect(result.totalSize).toBe(102400);
    });

    it('throws 404 when folder not found', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      await expect(getMetadata('bad', 'user-1')).rejects.toThrow('Folder not found');
    });
  });

  describe('resolveByPath', () => {
    it('resolves single-segment path', async () => {
      const folder = { id: 'f1', isPublic: true };
      vi.mocked(folderDao.findByNameAndParent).mockResolvedValue(folder as any);
      vi.mocked(folderDao.findById).mockResolvedValue(folder as any);

      const result = await resolveByPath(['Docs']);
      expect(folderDao.findByNameAndParent).toHaveBeenCalledWith('Docs', null);
      expect(result).toEqual(folder);
    });

    it('resolves multi-segment path', async () => {
      const root = { id: 'r1' };
      const child = { id: 'c1', isPublic: true };
      vi.mocked(folderDao.findByNameAndParent)
        .mockResolvedValueOnce(root as any)
        .mockResolvedValueOnce(child as any);
      vi.mocked(folderDao.findById).mockResolvedValue(child as any);

      const result = await resolveByPath(['Root', 'Child']);
      expect(folderDao.findByNameAndParent).toHaveBeenCalledWith('Root', null);
      expect(folderDao.findByNameAndParent).toHaveBeenCalledWith('Child', 'r1');
      expect(result).toEqual(child);
    });

    it('throws 404 when segment not found', async () => {
      vi.mocked(folderDao.findByNameAndParent).mockResolvedValue(null as any);
      await expect(resolveByPath(['Missing'])).rejects.toThrow('Folder not found');
    });

    it('throws 403 when resolved folder is not public', async () => {
      const folder = { id: 'f1', isPublic: false, parentId: null };
      vi.mocked(folderDao.findByNameAndParent).mockResolvedValue(folder as any);
      vi.mocked(folderDao.findById).mockResolvedValue(folder as any);
      await expect(resolveByPath(['Private'])).rejects.toThrow('Folder is not public');
    });

    it('throws 404 when middle segment not found', async () => {
      const root = { id: 'r1' };
      vi.mocked(folderDao.findByNameAndParent)
        .mockResolvedValueOnce(root as any)
        .mockResolvedValueOnce(null as any);

      await expect(resolveByPath(['Root', 'Missing', 'Deep'])).rejects.toThrow('Folder not found');
    });
  });

  describe('isPublicFolder - additional cases', () => {
    it('traverses parent chain to find public ancestor', async () => {
      const grandchild = { id: 'gc', isPublic: false, parentId: 'fc' };
      const child = { id: 'fc', isPublic: false, parentId: 'f2' };
      vi.mocked(folderDao.findById)
        .mockResolvedValueOnce(grandchild as any)
        .mockResolvedValueOnce(child as any)
        .mockResolvedValueOnce(mockPublicFolder as any);
      expect(await isPublicFolder('gc')).toBe(true);
    });
  });

  describe('resolvePublicPermission - additional cases', () => {
    it('traverses parent chain to find permission', async () => {
      const child = { id: 'fc', isPublic: false, parentId: 'f2' };
      vi.mocked(folderDao.findById)
        .mockResolvedValueOnce(child as any)
        .mockResolvedValueOnce(mockPublicFolder as any);
      expect(await resolvePublicPermission('fc')).toBe('edit');
    });

    it('returns null when findById returns null', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(null as any);
      expect(await resolvePublicPermission('nonexistent')).toBeNull();
    });
  });

  describe('createPublic - additional cases', () => {
    it('non-public parent creates child with isPublic false', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.create).mockResolvedValue({} as any);

      await createPublic('New', 'f1');
      expect(folderDao.create).toHaveBeenCalledWith({
        name: 'New',
        parentId: 'f1',
        ownerId: 'user-1',
        isPublic: false,
        publicPermission: undefined,
      });
    });

    it('public parent with no publicPermission defaults to view', async () => {
      const publicNoPermission = {
        id: 'fp', name: 'Pub', parentId: null, ownerId: 'user-1', isPublic: true,
      };
      vi.mocked(folderDao.findById).mockResolvedValue(publicNoPermission as any);
      vi.mocked(folderDao.create).mockResolvedValue({} as any);

      await createPublic('Child', 'fp');
      expect(folderDao.create).toHaveBeenCalledWith({
        name: 'Child',
        parentId: 'fp',
        ownerId: 'user-1',
        isPublic: true,
        publicPermission: 'view',
      });
    });
  });

  describe('getPublicFolder - additional cases', () => {
    it('breadcrumb stops at public parent', async () => {
      const child = {
        id: 'fc', name: 'Child', parentId: 'f2', ownerId: 'user-1', isPublic: false,
        toJSON: () => ({ id: 'fc', name: 'Child', parentId: 'f2', ownerId: 'user-1', isPublic: false }),
      };
      // First call: getPublicFolder finds the folder
      // Second call: isPublicFolder checks the folder itself (not public)
      // Third call: isPublicFolder checks the parent (public) => true
      // Fourth call: breadcrumb traversal finds parent
      vi.mocked(folderDao.findById)
        .mockResolvedValueOnce(child as any)       // getPublicFolder: find folder
        .mockResolvedValueOnce(child as any)        // isPublicFolder: check child
        .mockResolvedValueOnce(mockPublicFolder as any) // isPublicFolder: check parent => true
        .mockResolvedValueOnce(mockPublicFolder as any); // breadcrumb: find parent

      const result = await getPublicFolder('fc');
      expect(result.breadcrumb).toEqual([
        { id: 'f2', name: 'Public' },
        { id: 'fc', name: 'Child' },
      ]);
    });
  });

  describe('getMetadata - additional cases', () => {
    it('returns zero counts for empty folder', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(documentDao.countByFolder).mockResolvedValue(0);
      vi.mocked(folderDao.countByParent).mockResolvedValue(0);
      vi.mocked(documentDao.sumSizeByFolder).mockResolvedValue(0);

      const result = await getMetadata('f1', 'user-1');
      expect(result).toEqual({
        id: 'f1', name: 'Docs', parentId: null, ownerId: 'user-1', isPublic: false,
        docCount: 0, subfolderCount: 0, totalSize: 0,
      });
    });

    it('passes isAdmin flag to findById', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(documentDao.countByFolder).mockResolvedValue(1);
      vi.mocked(folderDao.countByParent).mockResolvedValue(1);
      vi.mocked(documentDao.sumSizeByFolder).mockResolvedValue(500);

      await getMetadata('f1', 'user-1', true);
      expect(folderDao.findById).toHaveBeenCalledWith('f1', 'user-1', true);
    });
  });

  describe('getPublicFolderTree - additional cases', () => {
    it('returns nested tree with multiple levels', async () => {
      const child = { id: 'fc', name: 'Child', ownerId: 'user-1', toJSON: () => ({ id: 'fc', name: 'Child' }) };
      const grandchild = { id: 'gc', name: 'Grand', toJSON: () => ({ id: 'gc', name: 'Grand' }) };

      vi.mocked(folderDao.findById).mockResolvedValue(mockPublicFolder as any);
      vi.mocked(folderDao.listByParent)
        .mockResolvedValueOnce([child] as any)   // children of f2
        .mockResolvedValueOnce([grandchild] as any) // children of fc
        .mockResolvedValueOnce([] as any);        // children of gc

      const tree = await getPublicFolderTree('f2');
      expect(tree).toEqual([
        { id: 'fc', name: 'Child', children: [
          { id: 'gc', name: 'Grand', children: [] },
        ]},
      ]);
    });
  });

  describe('create - isAdmin flag', () => {
    it('passes isAdmin to folderDao.findById when checking parent', async () => {
      vi.mocked(folderDao.findById).mockResolvedValue(mockFolder as any);
      vi.mocked(folderDao.create).mockResolvedValue(mockFolder as any);

      await create('Sub', 'user-1', 'f1', true);
      expect(folderDao.findById).toHaveBeenCalledWith('f1', 'user-1', true);
    });
  });
});
