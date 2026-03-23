import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/noteDao.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  list: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  distinctTags: vi.fn(),
  addAttachment: vi.fn(),
  removeAttachment: vi.fn(),
}));

vi.mock('../../src/services/embeddingService.js', () => ({
  prepareText: vi.fn().mockReturnValue('prepared text'),
  generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
}));

vi.mock('../../src/services/vectorService.js', () => ({
  upsertNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/noteFolderService.js', () => ({
  isFolderPublic: vi.fn(),
  resolvePublicPermission: vi.fn(),
}));

vi.mock('../../src/services/revisionService.js', () => ({
  generateSummary: vi.fn(),
  createRevision: vi.fn(),
}));

vi.mock('../../src/services/publishNotification.js', () => ({
  publishNotification: vi.fn(),
}));

vi.mock('../../src/models/NoteFolder.js', () => ({
  NoteFolder: { findById: vi.fn().mockResolvedValue(null) },
}));

import * as noteService from '../../src/services/noteService.js';
import * as noteDao from '../../src/daos/noteDao.js';
import * as vectorService from '../../src/services/vectorService.js';
import * as revisionService from '../../src/services/revisionService.js';
import * as noteFolderService from '../../src/services/noteFolderService.js';

describe('noteService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const makeNote = (overrides = {}) => ({
    id: 'n1',
    title: 'Test Note',
    content: 'Hello world',
    ownerId: 'user-1',
    folderId: null,
    tags: ['tag1'],
    isPublic: false,
    contentSize: 11,
    attachments: [],
    toJSON: function () { return { ...this, toJSON: undefined }; },
    ...overrides,
  });

  describe('create', () => {
    it('creates note with contentSize and triggers embedding', async () => {
      const note = makeNote();
      vi.mocked(noteDao.create).mockResolvedValue(note as any);

      const result = await noteService.create({
        title: 'Test Note',
        content: 'Hello world',
        ownerId: 'user-1',
      });

      expect(noteDao.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Note',
        content: 'Hello world',
        ownerId: 'user-1',
        contentSize: Buffer.byteLength('Hello world', 'utf8'),
      }));
      expect(result).toBe(note);
    });

    it('calculates contentSize as 0 for empty content', async () => {
      vi.mocked(noteDao.create).mockResolvedValue(makeNote({ content: '' }) as any);

      await noteService.create({ title: 'T', ownerId: 'u1' });

      expect(noteDao.create).toHaveBeenCalledWith(expect.objectContaining({ contentSize: 0 }));
    });
  });

  describe('list', () => {
    it('returns paginated results with ownerName', async () => {
      const data = [makeNote()];
      vi.mocked(noteDao.list).mockResolvedValue({ data, total: 1, page: 1, limit: 10 } as any);

      const result = await noteService.list({ ownerId: 'u1', page: 1, limit: 10, ownerName: 'Alice' });

      expect(result.total).toBe(1);
      expect(result.data[0].ownerName).toBe('Alice');
    });

    it('uses "Unknown" when ownerName not provided', async () => {
      const data = [makeNote()];
      vi.mocked(noteDao.list).mockResolvedValue({ data, total: 1, page: 1, limit: 10 } as any);

      const result = await noteService.list({ ownerId: 'u1', page: 1, limit: 10 });

      expect(result.data[0].ownerName).toBe('Unknown');
    });
  });

  describe('getById', () => {
    it('returns note when found', async () => {
      const note = makeNote();
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);

      const result = await noteService.getById('n1', 'user-1');
      expect(result).toBe(note);
    });

    it('throws 404 when not found', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(null as any);
      await expect(noteService.getById('n1', 'user-1')).rejects.toThrow('Note not found');
    });

    it('passes isAdmin to dao', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(makeNote() as any);

      await noteService.getById('n1', 'user-1', true);

      expect(noteDao.findById).toHaveBeenCalledWith('n1', 'user-1', true);
    });
  });

  describe('update', () => {
    it('creates revision when summary is generated', async () => {
      const existing = makeNote();
      vi.mocked(noteDao.findById).mockResolvedValue(existing as any);
      vi.mocked(revisionService.generateSummary).mockReturnValue('Updated content');
      vi.mocked(noteDao.updateById).mockResolvedValue(makeNote({ content: 'New content' }) as any);

      await noteService.update('n1', 'user-1', { content: 'New content' }, false, 'editor1', 'Editor');

      expect(revisionService.createRevision).toHaveBeenCalledWith('n1', 'editor1', 'Editor', 'Updated content');
    });

    it('skips revision when no summary or no editorId', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(makeNote() as any);
      vi.mocked(revisionService.generateSummary).mockReturnValue('');
      vi.mocked(noteDao.updateById).mockResolvedValue(makeNote() as any);

      await noteService.update('n1', 'user-1', { content: 'Same' });

      expect(revisionService.createRevision).not.toHaveBeenCalled();
    });

    it('recalculates contentSize when content changes', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(makeNote() as any);
      vi.mocked(revisionService.generateSummary).mockReturnValue('');
      vi.mocked(noteDao.updateById).mockResolvedValue(makeNote() as any);

      await noteService.update('n1', 'user-1', { content: 'abc' });

      expect(noteDao.updateById).toHaveBeenCalledWith('n1', expect.objectContaining({
        contentSize: Buffer.byteLength('abc', 'utf8'),
      }));
    });

    it('throws 404 when updated note not found', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(makeNote() as any);
      vi.mocked(revisionService.generateSummary).mockReturnValue('');
      vi.mocked(noteDao.updateById).mockResolvedValue(null as any);

      await expect(noteService.update('n1', 'user-1', { title: 'X' })).rejects.toThrow('Note not found');
    });
  });

  describe('remove', () => {
    it('deletes note and triggers vector deletion', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(makeNote() as any);
      vi.mocked(noteDao.deleteById).mockResolvedValue(null as any);

      await noteService.remove('n1', 'user-1');

      expect(noteDao.deleteById).toHaveBeenCalledWith('n1');
      expect(vectorService.deleteNote).toHaveBeenCalledWith('n1');
    });

    it('throws 404 when note not found', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(null as any);
      await expect(noteService.remove('n1', 'user-1')).rejects.toThrow('Note not found');
    });
  });

  describe('getTags', () => {
    it('returns distinct tags', async () => {
      vi.mocked(noteDao.distinctTags).mockResolvedValue(['a', 'b'] as any);

      const result = await noteService.getTags('user-1');
      expect(result).toEqual(['a', 'b']);
      expect(noteDao.distinctTags).toHaveBeenCalledWith('user-1', false);
    });

    it('passes isAdmin flag', async () => {
      vi.mocked(noteDao.distinctTags).mockResolvedValue([] as any);
      await noteService.getTags('u1', true);
      expect(noteDao.distinctTags).toHaveBeenCalledWith('u1', true);
    });
  });

  describe('getByIdPublic', () => {
    it('returns public note with publicPermission', async () => {
      const note = makeNote({ isPublic: true, publicPermission: 'edit' });
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);

      const result = await noteService.getByIdPublic('n1');

      expect(result.publicPermission).toBe('edit');
    });

    it('returns note when folder is public', async () => {
      const note = makeNote({ isPublic: false, folderId: { toString: () => 'f1' } });
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);
      vi.mocked(noteFolderService.isFolderPublic).mockResolvedValue(true);
      vi.mocked(noteFolderService.resolvePublicPermission).mockResolvedValue('view');

      const result = await noteService.getByIdPublic('n1');

      expect(result.publicPermission).toBe('view');
    });

    it('throws 404 for private note without public folder', async () => {
      const note = makeNote({ isPublic: false });
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);

      await expect(noteService.getByIdPublic('n1')).rejects.toThrow('Note not found');
    });

    it('throws 404 when note does not exist', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(null as any);
      await expect(noteService.getByIdPublic('n1')).rejects.toThrow('Note not found');
    });

    it('throws 404 when folder is not public', async () => {
      const note = makeNote({ isPublic: false, folderId: { toString: () => 'f1' } });
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);
      vi.mocked(noteFolderService.isFolderPublic).mockResolvedValue(false);

      await expect(noteService.getByIdPublic('n1')).rejects.toThrow('Note not found');
    });
  });

  describe('addAttachment', () => {
    it('adds attachment to note', async () => {
      const note = makeNote();
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);
      vi.mocked(noteDao.addAttachment).mockResolvedValue(note as any);

      const attachment = { documentId: 'doc1', filename: 'f.txt', mimeType: 'text/plain', size: 100 };
      await noteService.addAttachment('n1', 'user-1', attachment);

      expect(noteDao.addAttachment).toHaveBeenCalledWith('n1', attachment);
    });

    it('throws 409 when attachment already exists', async () => {
      const note = makeNote({ attachments: [{ documentId: 'doc1' }] });
      vi.mocked(noteDao.findById).mockResolvedValue(note as any);

      const attachment = { documentId: 'doc1', filename: 'f.txt', mimeType: 'text/plain', size: 100 };
      await expect(noteService.addAttachment('n1', 'user-1', attachment)).rejects.toThrow('Attachment already exists');
    });
  });

  describe('removeAttachment', () => {
    it('removes attachment from note', async () => {
      vi.mocked(noteDao.findById).mockResolvedValue(makeNote() as any);
      vi.mocked(noteDao.removeAttachment).mockResolvedValue(makeNote() as any);

      await noteService.removeAttachment('n1', 'user-1', 'doc1');

      expect(noteDao.removeAttachment).toHaveBeenCalledWith('n1', 'doc1');
    });
  });
});
