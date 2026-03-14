import { Note } from '../models/Note.js';
import type { FilterQuery } from 'mongoose';

interface ListOptions {
  ownerId: string;
  isAdmin?: boolean;
  folderId?: string | null;
  tags?: string[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export const create = (data: {
  title: string;
  content?: string;
  folderId?: string | null;
  ownerId: string;
  tags?: string[];
  isPublic?: boolean;
  contentSize?: number;
}) => Note.create({ ...data, folderId: data.folderId || null });

export const findById = (id: string, ownerId?: string, isAdmin = false) => {
  if (!isAdmin && ownerId) return Note.findOne({ _id: id, ownerId });
  return Note.findById(id);
};

export const list = async (opts: ListOptions) => {
  const { ownerId, isAdmin, folderId, tags, search, sortBy, sortOrder, page, limit } = opts;
  const filter: FilterQuery<typeof Note> = {};
  if (!isAdmin) filter.ownerId = ownerId;

  if (folderId !== undefined) filter.folderId = folderId || null;
  if (tags?.length) filter.tags = { $in: tags };
  if (search) filter.title = { $regex: search, $options: 'i' };

  const sortField = sortBy || 'createdAt';
  const sortDir = sortOrder === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Note.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit),
    Note.countDocuments(filter),
  ]);

  return { data, total, page, limit };
};

export const updateById = (id: string, data: Partial<{ title: string; content: string; tags: string[]; folderId: string | null; isPublic: boolean; contentSize: number }>) =>
  Note.findByIdAndUpdate(id, { $set: data }, { new: true });

export const deleteById = (id: string) => Note.findByIdAndDelete(id);

export const distinctTags = (ownerId: string, isAdmin = false): Promise<string[]> =>
  Note.distinct('tags', isAdmin ? {} : { ownerId });

export const findManyByIds = (ids: string[]) =>
  Note.find({ _id: { $in: ids } });

export const addAttachment = (id: string, attachment: { documentId: string; filename: string; mimeType: string; size: number }) =>
  Note.findByIdAndUpdate(id, { $push: { attachments: attachment } }, { new: true });

export const removeAttachment = (id: string, documentId: string) =>
  Note.findByIdAndUpdate(id, { $pull: { attachments: { documentId } } }, { new: true });

export const setDmsFolderId = (id: string, dmsFolderId: string) =>
  Note.findByIdAndUpdate(id, { $set: { dmsFolderId } }, { new: true });
