import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpsert, mockDelete, mockQuery, mockGetCollections } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
  mockQuery: vi.fn(),
  mockGetCollections: vi.fn(),
}));

vi.mock('@qdrant/js-client-rest', () => {
  return {
    QdrantClient: class {
      upsert = mockUpsert;
      delete = mockDelete;
      query = mockQuery;
      getCollections = mockGetCollections;
    },
  };
});

vi.mock('../../src/config/index.js', () => ({
  config: {
    qdrant: { url: 'http://localhost:6333', collection: 'atlas-notes' },
    ollama: { url: 'http://localhost:11434', model: 'nomic-embed-text' },
  },
}));

import { upsertNote, deleteNote, search } from '../../src/services/vectorService.js';

describe('vectorService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('upsertNote', () => {
    it('converts ObjectId to UUID and upserts point', async () => {
      mockUpsert.mockResolvedValue({});
      const vector = Array(768).fill(0.5);
      const payload = { ownerId: 'user-1', folderId: null, isPublic: false, title: 'Test' };

      await upsertNote('507f1f77bcf86cd799439011', vector, payload);

      expect(mockUpsert).toHaveBeenCalledWith('atlas-notes', {
        points: [{
          id: '507f1f77-bcf8-6cd7-9943-901100000000',
          vector,
          payload,
        }],
      });
    });

    it('passes aiAccessible in payload', async () => {
      mockUpsert.mockResolvedValue({});
      const vector = Array(768).fill(0.1);
      const payload = { ownerId: 'u1', folderId: 'f1', isPublic: true, aiAccessible: true, title: 'T' };

      await upsertNote('aabbccddeeff001122334455', vector, payload);

      const call = mockUpsert.mock.calls[0];
      expect(call[1].points[0].payload.aiAccessible).toBe(true);
    });
  });

  describe('deleteNote', () => {
    it('converts ObjectId to UUID and deletes', async () => {
      mockDelete.mockResolvedValue({});

      await deleteNote('507f1f77bcf86cd799439011');

      expect(mockDelete).toHaveBeenCalledWith('atlas-notes', {
        points: ['507f1f77-bcf8-6cd7-9943-901100000000'],
      });
    });
  });

  describe('search', () => {
    it('returns results with ObjectId IDs', async () => {
      mockQuery.mockResolvedValue({
        points: [
          { id: '507f1f77-bcf8-6cd7-9943-901100000000', score: 0.95, payload: { title: 'Test' } },
        ],
      });

      const result = await search({
        vector: Array(768).fill(0.1),
        limit: 5,
      });

      expect(result.points).toHaveLength(1);
      expect(result.points[0].id).toBe('507f1f77bcf86cd799439011');
      expect(result.points[0].score).toBe(0.95);
    });

    it('returns empty results', async () => {
      mockQuery.mockResolvedValue({ points: [] });

      const result = await search({ vector: Array(768).fill(0), limit: 10 });

      expect(result.points).toHaveLength(0);
    });

    it('passes filter to query', async () => {
      mockQuery.mockResolvedValue({ points: [] });
      const filter = { must: [{ key: 'ownerId', match: { value: 'user-1' } }] };

      await search({ vector: Array(768).fill(0), limit: 5, filter });

      expect(mockQuery).toHaveBeenCalledWith('atlas-notes', expect.objectContaining({ filter }));
    });
  });
});
