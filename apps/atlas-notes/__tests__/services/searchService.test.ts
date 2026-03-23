import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/embeddingService.js', () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock('../../src/services/vectorService.js', () => ({
  search: vi.fn(),
}));

vi.mock('../../src/daos/noteDao.js', () => ({
  findManyByIds: vi.fn(),
}));

import { search, aiSearch } from '../../src/services/searchService.js';
import * as embeddingService from '../../src/services/embeddingService.js';
import * as vectorService from '../../src/services/vectorService.js';
import * as noteDao from '../../src/daos/noteDao.js';

describe('searchService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const fakeVector = Array(768).fill(0.1);

  describe('search', () => {
    it('generates embedding, searches vectors, and enriches results', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(fakeVector);
      vi.mocked(vectorService.search).mockResolvedValue({
        points: [{ id: 'note1', score: 0.9 }, { id: 'note2', score: 0.8 }],
      });
      vi.mocked(noteDao.findManyByIds).mockResolvedValue([
        { id: 'note1', toJSON: () => ({ id: 'note1', title: 'A' }) },
        { id: 'note2', toJSON: () => ({ id: 'note2', title: 'B' }) },
      ] as any);

      const results = await search({ query: 'test query', ownerId: 'user-1' });

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
      expect(vectorService.search).toHaveBeenCalledWith({
        vector: fakeVector,
        limit: 10,
        filter: { must: [{ key: 'ownerId', match: { value: 'user-1' } }] },
      });
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ note: { id: 'note1', title: 'A' }, score: 0.9 });
    });

    it('adds folderId filter when provided', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(fakeVector);
      vi.mocked(vectorService.search).mockResolvedValue({ points: [] });
      vi.mocked(noteDao.findManyByIds).mockResolvedValue([]);

      await search({ query: 'q', ownerId: 'u1', folderId: 'f1' });

      expect(vectorService.search).toHaveBeenCalledWith(expect.objectContaining({
        filter: {
          must: [
            { key: 'ownerId', match: { value: 'u1' } },
            { key: 'folderId', match: { value: 'f1' } },
          ],
        },
      }));
    });

    it('returns empty when no vector results', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(fakeVector);
      vi.mocked(vectorService.search).mockResolvedValue({ points: [] });
      vi.mocked(noteDao.findManyByIds).mockResolvedValue([]);

      const results = await search({ query: 'nothing', ownerId: 'u1' });
      expect(results).toEqual([]);
    });

    it('filters out notes not found in DB', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(fakeVector);
      vi.mocked(vectorService.search).mockResolvedValue({
        points: [{ id: 'n1', score: 0.9 }, { id: 'n2', score: 0.8 }],
      });
      vi.mocked(noteDao.findManyByIds).mockResolvedValue([
        { id: 'n1', toJSON: () => ({ id: 'n1', title: 'Only One' }) },
      ] as any);

      const results = await search({ query: 'q', ownerId: 'u1' });
      expect(results).toHaveLength(1);
      expect(results[0].note.id).toBe('n1');
    });

    it('uses custom limit', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(fakeVector);
      vi.mocked(vectorService.search).mockResolvedValue({ points: [] });
      vi.mocked(noteDao.findManyByIds).mockResolvedValue([]);

      await search({ query: 'q', ownerId: 'u1', limit: 5 });

      expect(vectorService.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
    });
  });

  describe('aiSearch', () => {
    it('searches with aiAccessible filter', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(fakeVector);
      vi.mocked(vectorService.search).mockResolvedValue({
        points: [{ id: 'n1', score: 0.85 }],
      });
      vi.mocked(noteDao.findManyByIds).mockResolvedValue([
        { id: 'n1', toJSON: () => ({ id: 'n1', title: 'AI Note' }) },
      ] as any);

      const results = await aiSearch({ query: 'ai query' });

      expect(vectorService.search).toHaveBeenCalledWith({
        vector: fakeVector,
        limit: 10,
        filter: { must: [{ key: 'aiAccessible', match: { value: true } }] },
      });
      expect(results).toHaveLength(1);
    });
  });
});
