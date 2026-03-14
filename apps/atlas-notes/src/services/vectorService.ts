import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/index.js';
import { EMBEDDING_DIMS } from './embeddingService.js';

const client = new QdrantClient({ url: config.qdrant.url });
const collection = config.qdrant.collection;

const objectIdToUuid = (id: string) =>
  `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}00000000`.slice(0, 36);

const uuidToObjectId = (uuid: string) =>
  uuid.replace(/-/g, '').slice(0, 24);

export const ensureCollection = async () => {
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === collection);

  if (!exists) {
    await client.createCollection(collection, {
      vectors: { size: EMBEDDING_DIMS, distance: 'Cosine' },
    });
    await client.createPayloadIndex(collection, { field_name: 'ownerId', field_schema: 'keyword' });
    await client.createPayloadIndex(collection, { field_name: 'folderId', field_schema: 'keyword' });
    await client.createPayloadIndex(collection, { field_name: 'isPublic', field_schema: 'bool' });
    await client.createPayloadIndex(collection, { field_name: 'aiAccessible', field_schema: 'bool' });
    console.log(`Qdrant collection "${collection}" created`);
  }
};

export const upsertNote = async (
  id: string,
  vector: number[],
  payload: { ownerId: string; folderId: string | null; isPublic: boolean; aiAccessible?: boolean; title: string },
) => {
  await client.upsert(collection, {
    points: [{ id: objectIdToUuid(id), vector, payload }],
  });
};

export const deleteNote = async (id: string) => {
  await client.delete(collection, { points: [objectIdToUuid(id)] });
};

interface SearchOptions {
  vector: number[];
  limit: number;
  filter?: Record<string, unknown>;
}

export const search = async ({ vector, limit, filter }: SearchOptions) => {
  const results = await client.query(collection, {
    query: vector,
    limit,
    filter: filter as never,
    with_payload: true,
  });

  return {
    points: results.points.map((p) => ({
      ...p,
      id: uuidToObjectId(p.id as string),
    })),
  };
};
