import { ShareToken } from '../models/ShareToken.js';

export const create = (data: {
  documentId?: string | null;
  folderId?: string | null;
  type?: string;
  token: string;
  createdBy: string;
  expiresAt: Date;
  maxDownloads: number;
  password?: string | null;
}) => ShareToken.create(data);

export const findByToken = (token: string) => ShareToken.findOne({ token });

export const findById = (id: string) => ShareToken.findById(id);

export const findByDocumentId = (documentId: string) =>
  ShareToken.find({ documentId }).sort({ createdAt: -1 });

export const deleteById = (id: string) => ShareToken.findByIdAndDelete(id);

export const incrementDownloadCount = (id: string) =>
  ShareToken.findByIdAndUpdate(id, { $inc: { downloadCount: 1 } }, { new: true });

export const findByFolderId = (folderId: string) =>
  ShareToken.find({ folderId }).sort({ createdAt: -1 });
