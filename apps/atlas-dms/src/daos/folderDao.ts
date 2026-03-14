import { Folder } from '../models/Folder.js';

export const create = (data: { name: string; parentId?: string | null; ownerId: string }) =>
  Folder.create({ ...data, parentId: data.parentId || null });

export const findById = (id: string, ownerId?: string, isAdmin = false) => {
  if (!isAdmin && ownerId) return Folder.findOne({ _id: id, ownerId });
  return Folder.findById(id);
};

export const listByParent = (ownerId: string, parentId: string | null, isAdmin = false) => {
  const filter: Record<string, unknown> = { parentId };
  if (!isAdmin) filter.ownerId = ownerId;
  return Folder.find(filter).sort({ name: 1 });
};

export const updateById = (id: string, data: { name?: string; parentId?: string | null }) =>
  Folder.findByIdAndUpdate(id, { $set: data }, { new: true });

export const deleteById = (id: string) => Folder.findByIdAndDelete(id);

export const countChildren = (parentId: string) =>
  Folder.countDocuments({ parentId });

export const countByParent = (parentId: string) =>
  Folder.countDocuments({ parentId });

export const findByNameAndParent = (name: string, parentId: string | null) =>
  Folder.findOne({ name, parentId });

export const updateIsPublic = (id: string, isPublic: boolean, publicPermission?: string) => {
  const update: Record<string, unknown> = { isPublic };
  if (publicPermission) update.publicPermission = publicPermission;
  return Folder.findByIdAndUpdate(id, { $set: update }, { new: true });
};
