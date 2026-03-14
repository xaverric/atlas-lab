import * as embeddingService from './embeddingService.js';
import * as vectorService from './vectorService.js';
import * as noteDao from '../daos/noteDao.js';

interface SearchInput {
  query: string;
  ownerId: string;
  folderId?: string;
  limit?: number;
}

interface AiSearchInput {
  query: string;
  limit?: number;
}

const enrichResults = async (points: { id: string | number; score: number }[]) => {
  const ids = points.map((p) => p.id as string);
  if (!ids.length) return [];

  const notes = await noteDao.findManyByIds(ids);
  const noteMap = new Map(notes.map((n) => [n.id, n]));

  return points
    .map((p) => ({
      note: noteMap.get(p.id as string)?.toJSON(),
      score: p.score,
    }))
    .filter((r) => r.note);
};

export const search = async ({ query, ownerId, folderId, limit = 10 }: SearchInput) => {
  const vector = await embeddingService.generateEmbedding(query);

  const must: Record<string, unknown>[] = [
    { key: 'ownerId', match: { value: ownerId } },
  ];
  if (folderId) {
    must.push({ key: 'folderId', match: { value: folderId } });
  }

  const results = await vectorService.search({ vector, limit, filter: { must } });
  return enrichResults(results.points as { id: string; score: number }[]);
};

export const aiSearch = async ({ query, limit = 10 }: AiSearchInput) => {
  const vector = await embeddingService.generateEmbedding(query);

  const results = await vectorService.search({
    vector,
    limit,
    filter: {
      must: [{ key: 'aiAccessible', match: { value: true } }],
    },
  });

  return enrichResults(results.points as { id: string; score: number }[]);
};
