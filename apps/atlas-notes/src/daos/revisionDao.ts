import { NoteRevision } from '../models/NoteRevision.js';

export const create = (data: {
  noteId: string;
  title: string;
  content: string;
  tags: string[];
  isPublic: boolean;
  contentSize: number;
  editorId: string;
  editorName: string;
  summary: string;
}) => NoteRevision.create(data);

export const listByNote = async (noteId: string, page: number, limit: number) => {
  const [data, total] = await Promise.all([
    NoteRevision.find({ noteId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    NoteRevision.countDocuments({ noteId }),
  ]);
  return { data, total, page, limit };
};

export const findById = (id: string) => NoteRevision.findById(id);

export const countByNote = (noteId: string) => NoteRevision.countDocuments({ noteId });
