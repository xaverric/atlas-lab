import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: {
    ollama: { url: 'http://localhost:11434', model: 'nomic-embed-text' },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { prepareText, generateEmbedding, EMBEDDING_DIMS } from '../../src/services/embeddingService.js';

describe('embeddingService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('prepareText', () => {
    it('combines title, tags, and content', () => {
      const result = prepareText('My Title', 'Some content', ['tag1', 'tag2']);
      expect(result).toBe('My Title\n\nTags: tag1, tag2\n\nSome content');
    });

    it('omits tags section when tags are empty', () => {
      const result = prepareText('Title', 'Content', []);
      expect(result).toBe('Title\n\nContent');
    });

    it('omits tags section when tags not provided', () => {
      const result = prepareText('Title', 'Content');
      expect(result).toBe('Title\n\nContent');
    });

    it('handles empty content', () => {
      const result = prepareText('Title', '', ['tag1']);
      expect(result).toBe('Title\n\nTags: tag1');
    });
  });

  describe('generateEmbedding', () => {
    const fakeVector = Array(768).fill(0.1);

    it('calls Ollama API and returns embedding vector', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embeddings: [fakeVector] }),
      });

      const result = await generateEmbedding('test text');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', input: 'test text' }),
      });
      expect(result).toEqual(fakeVector);
      expect(result.length).toBe(EMBEDDING_DIMS);
    });

    it('throws when Ollama API returns error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(generateEmbedding('test')).rejects.toThrow('Ollama embedding failed: 500 Internal Server Error');
    });

    it('throws when embedding dimensions mismatch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embeddings: [Array(100).fill(0.1)] }),
      });

      await expect(generateEmbedding('test')).rejects.toThrow('Expected 768 dims, got 100');
    });

    it('throws when embedding is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embeddings: [] }),
      });

      await expect(generateEmbedding('test')).rejects.toThrow(/Expected 768 dims/);
    });
  });
});
