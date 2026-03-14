import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

const getCollection = (name: string) => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  return db.collection(name);
};

export const createCollection = async (collectionName: string, indexes: Array<{ fields: Record<string, unknown>; options?: Record<string, unknown> }>) => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  await db.createCollection(collectionName);
  const collection = db.collection(collectionName);
  await collection.createIndex({ createdAt: -1 });

  for (const idx of indexes) {
    await collection.createIndex(idx.fields as Record<string, 1 | -1>, idx.options || {});
  }
};

export const dropCollection = async (collectionName: string) => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length > 0) {
    await db.dropCollection(collectionName);
  }
};

export const insertOne = (collectionName: string, doc: Record<string, unknown>) =>
  getCollection(collectionName).insertOne(doc);

export const find = (
  collectionName: string,
  query: Record<string, unknown>,
  sort: Record<string, 1 | -1>,
  skip: number,
  limit: number,
) =>
  getCollection(collectionName)
    .find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();

export const count = (collectionName: string, query: Record<string, unknown>) =>
  getCollection(collectionName).countDocuments(query);

export const deleteById = (collectionName: string, id: string) =>
  getCollection(collectionName).deleteOne({ _id: new ObjectId(id) });
