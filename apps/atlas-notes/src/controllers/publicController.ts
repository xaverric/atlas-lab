import type { RequestHandler } from 'express';
import * as noteService from '../services/noteService.js';
import * as noteFolderService from '../services/noteFolderService.js';
import { Note } from '../models/Note.js';

export const getNote: RequestHandler = async (req, res, next) => {
  try {
    const note = await noteService.getByIdPublic(req.params.id as string);
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
};

export const getFolder: RequestHandler = async (req, res, next) => {
  try {
    const folder = await noteFolderService.getByIdPublic(req.params.id as string);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const listFolderContents: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const folder = await noteFolderService.getByIdPublic(id);

    const [subfolders, notes] = await Promise.all([
      noteFolderService.listByParentPublic(id),
      Note.find({ folderId: id }).sort({ createdAt: -1 }),
    ]);

    res.json({ data: { folder, subfolders, notes } });
  } catch (err) {
    next(err);
  }
};

export const updateNote: RequestHandler = async (req, res, next) => {
  try {
    const note = await noteService.updatePublic(req.params.id as string, req.body);
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
};
