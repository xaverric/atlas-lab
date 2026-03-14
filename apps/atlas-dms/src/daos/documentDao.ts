import { Document } from '../models/Document.js';
import type { FilterQuery } from 'mongoose';

interface ListOptions {
  ownerId: string;
  folderId?: string | null;
  tags?: string[];
  search?: string;
  mimeType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export const create = (data: {
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  tags: string[];
  ownerId: string;
  folderId?: string | null;
}) => Document.create(data);

export const findById = (id: string) => Document.findById(id);

export const list = async (opts: ListOptions) => {
  const { ownerId, folderId, tags, search, mimeType, dateFrom, dateTo, sortBy, sortOrder, page, limit } = opts;
  const filter: FilterQuery<typeof Document> = { ownerId };

  if (folderId !== undefined) filter.folderId = folderId || null;
  if (tags?.length) filter.tags = { $in: tags };
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (mimeType) filter.mimeType = { $regex: mimeType, $options: 'i' };

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  const sortField = sortBy || 'createdAt';
  const sortDir = sortOrder === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Document.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit),
    Document.countDocuments(filter),
  ]);

  return { data, total, page, limit };
};

export const deleteById = (id: string) => Document.findByIdAndDelete(id);

export const updateById = (id: string, data: Partial<{ name: string; tags: string[]; folderId: string | null }>) =>
  Document.findByIdAndUpdate(id, { $set: data }, { new: true });

export const deleteManyByIds = (ids: string[], ownerId: string) =>
  Document.deleteMany({ _id: { $in: ids }, ownerId });

export const updateManyFolder = (ids: string[], ownerId: string, folderId: string | null) =>
  Document.updateMany({ _id: { $in: ids }, ownerId }, { $set: { folderId } });

export const findManyByIds = (ids: string[], ownerId: string) =>
  Document.find({ _id: { $in: ids }, ownerId });

export const distinctTags = (ownerId: string): Promise<string[]> =>
  Document.distinct('tags', { ownerId });
