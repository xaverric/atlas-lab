import { Folder } from '../models/Folder.js';

export const create = (data: { name: string; parentId?: string | null; ownerId: string }) =>
  Folder.create({ ...data, parentId: data.parentId || null });

export const findById = (id: string) => Folder.findById(id);

export const listByParent = (ownerId: string, parentId: string | null) =>
  Folder.find({ ownerId, parentId }).sort({ name: 1 });

export const updateById = (id: string, data: { name?: string; parentId?: string | null }) =>
  Folder.findByIdAndUpdate(id, { $set: data }, { new: true });

export const deleteById = (id: string) => Folder.findByIdAndDelete(id);

export const countChildren = (parentId: string) =>
  Folder.countDocuments({ parentId });
