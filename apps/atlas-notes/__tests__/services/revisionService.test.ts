import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/revisionDao.js', () => ({
  create: vi.fn(),
  listByNote: vi.fn(),
  findById: vi.fn(),
}));

vi.mock('../../src/daos/noteDao.js', () => ({
  findById: vi.fn(),
  updateById: vi.fn(),
}));

import * as revisionService from '../../src/services/revisionService.js';
import * as revisionDao from '../../src/daos/revisionDao.js';
import * as noteDao from '../../src/daos/noteDao.js';

describe('revisionService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('generateSummary', () => {
    const before = { title: 'Old', content: 'old content', tags: ['a'], isPublic: false };

    it('detects title change', () => {
      expect(revisionService.generateSummary(before, { title: 'New' })).toBe('Updated title');
    });

    it('detects content change', () => {
      expect(revisionService.generateSummary(before, { content: 'new content' })).toBe('Updated content');
    });

    it('detects tags change', () => {
      expect(revisionService.generateSummary(before, { tags: ['b'] })).toBe('Updated tags');
    });

    it('detects visibility change', () => {
      expect(revisionService.generateSummary(before, { isPublic: true })).toBe('Updated visibility');
    });

    it('detects multiple changes', () => {
      const result = revisionService.generateSummary(before, { title: 'New', content: 'new', tags: ['b'] });
      expect(result).toBe('Updated title, content, tags');
    });

    it('returns empty string when nothing changed', () => {
      expect(revisionService.generateSummary(before, { title: 'Old' })).toBe('');
    });

    it('returns empty string for identical tags', () => {
      expect(revisionService.generateSummary(before, { tags: ['a'] })).toBe('');
    });
  });

  describe('createRevision', () => {
    it('snapshots note state into a revision', async () => {
      const note = { title: 'T', content: 'C', tags: ['x'], isPublic: false, contentSize: 1 };
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);
      vi.mocked(revisionDao.create).mockResolvedValue({ id: 'rev1' } as any);

      await revisionService.createRevision('n1', 'editor1', 'Editor', 'Updated title');

      expect(revisionDao.create).toHaveBeenCalledWith({
        noteId: 'n1',
        title: 'T',
        content: 'C',
        tags: ['x'],
        isPublic: false,
        contentSize: 1,
        editorId: 'editor1',
        editorName: 'Editor',
        summary: 'Updated title',
      });
    });

    it('throws 404 when note not found', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(null as any);
      await expect(revisionService.createRevision('n1', 'e', 'E', 's')).rejects.toThrow('Note not found');
    });
  });

  describe('listRevisions', () => {
    it('lists revisions for owned note', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue({ id: 'n1' } as any);
      vi.mocked(revisionDao.listByNote).mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 } as any);

      const result = await revisionService.listRevisions('n1', 'owner1', false, 1, 10);

      expect(noteDao.findById).toHaveBeenCalledWith('n1', 'owner1', false);
      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10 });
    });

    it('throws 404 when note not found', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(null as any);
      await expect(revisionService.listRevisions('n1', 'o', false, 1, 10)).rejects.toThrow('Note not found');
    });
  });

  describe('getRevision', () => {
    it('returns revision when found and belongs to note', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue({ id: 'n1' } as any);
      vi.mocked(revisionDao.findById).mockResolvedValue({ id: 'r1', noteId: { toString: () => 'n1' } } as any);

      const result = await revisionService.getRevision('n1', 'r1', 'owner', false);

      expect(result).toEqual({ id: 'r1', noteId: { toString: expect.any(Function) } });
    });

    it('throws 404 when revision not found', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue({ id: 'n1' } as any);
      vi.mocked(revisionDao.findById).mockResolvedValue(null as any);
      await expect(revisionService.getRevision('n1', 'r1', 'o', false)).rejects.toThrow('Revision not found');
    });

    it('throws 404 when revision belongs to different note', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue({ id: 'n1' } as any);
      vi.mocked(revisionDao.findById).mockResolvedValue({ id: 'r1', noteId: { toString: () => 'n2' } } as any);
      await expect(revisionService.getRevision('n1', 'r1', 'o', false)).rejects.toThrow('Revision not found');
    });
  });

  describe('restore', () => {
    it('creates pre-snapshot, updates note, and creates post-revision', async () => {
      const note = { id: 'n1', title: 'Current', content: 'C', tags: ['a'], isPublic: false, contentSize: 1 };
      const revision = {
        id: 'r1',
        noteId: { toString: () => 'n1' },
        title: 'Old Title',
        content: 'Old content',
        tags: ['b'],
        isPublic: true,
        createdAt: new Date('2025-01-01'),
      };

      vi.mocked(noteDao.findById).mockResolvedValue(note as any);
      vi.mocked(revisionDao.findById).mockResolvedValue(revision as any);
      vi.mocked(revisionDao.create).mockResolvedValue({} as any);
      vi.mocked(noteDao.updateById).mockResolvedValue({ id: 'n1', title: 'Old Title' } as any);

      await revisionService.restore('n1', 'r1', 'owner', 'editor', 'EditorName', false);

      // Pre-snapshot revision
      expect(revisionDao.create).toHaveBeenCalledWith(expect.objectContaining({
        noteId: 'n1',
        summary: 'Pre-restore snapshot',
      }));

      // Note update
      expect(noteDao.updateById).toHaveBeenCalledWith('n1', {
        title: 'Old Title',
        content: 'Old content',
        tags: ['b'],
        isPublic: true,
        contentSize: Buffer.byteLength('Old content', 'utf8'),
      });

      // Post-restore revision
      expect(revisionDao.create).toHaveBeenCalledWith(expect.objectContaining({
        noteId: 'n1',
        title: 'Old Title',
        summary: expect.stringContaining('Restored to revision'),
      }));
    });

    it('throws 404 when note not found', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(null as any);
      await expect(revisionService.restore('n1', 'r1', 'o', 'e', 'E', false)).rejects.toThrow('Note not found');
    });
  });
});
