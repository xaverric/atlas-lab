import { NoteFolder } from '../models/NoteFolder.js';

export const create = (data: { name: string; parentId?: string | null; ownerId: string; aiAccessible?: boolean; visibility?: string; publicPermission?: string }) =>
  NoteFolder.create({ ...data, parentId: data.parentId || null });

export const findById = (id: string, ownerId?: string, isAdmin = false) => {
  if (!isAdmin && ownerId) return NoteFolder.findOne({ _id: id, ownerId });
  return NoteFolder.findById(id);
};

export const listByParent = (ownerId: string, parentId: string | null, isAdmin = false) => {
  const filter: Record<string, unknown> = { parentId };
  if (!isAdmin) filter.ownerId = ownerId;
  return NoteFolder.find(filter).sort({ name: 1 });
};

export const updateById = (id: string, data: Partial<{ name: string; parentId: string | null; visibility: string; aiAccessible: boolean; publicPermission: string }>) =>
  NoteFolder.findByIdAndUpdate(id, { $set: data }, { new: true });

export const deleteById = (id: string) => NoteFolder.findByIdAndDelete(id);

export const countChildren = (parentId: string) =>
  NoteFolder.countDocuments({ parentId });

export const findAiAccessible = (ownerId: string) =>
  NoteFolder.find({ ownerId, aiAccessible: true });
