import type { RequestHandler } from 'express';
import * as folderService from '../services/folderService.js';
import * as documentService from '../services/documentService.js';
import * as documentDao from '../daos/documentDao.js';
import * as folderDao from '../daos/folderDao.js';

const stripPrivate = ({ parentId, ownerId, folderId, ...rest }: Record<string, any>) => rest;

export const getFolder: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.getPublicFolder(req.params.id as string);
    const folderId = (folder as any).id ?? req.params.id;
    const subfolders = await folderDao.listByParent(folder.ownerId, folderId);
    const documents = await documentDao.listByFolder(folderId);
    res.json({
      data: {
        folder: stripPrivate(folder),
        subfolders: subfolders.map((s: any) => ({ id: s.id, name: s.name })),
        documents: documents.map((d: any) => stripPrivate(d.toJSON ? d.toJSON() : d)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getFolderTree: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.getPublicFolder(req.params.id as string);
    const tree = await folderService.getPublicFolderTree(req.params.id as string);
    res.json({ data: { folder, children: tree } });
  } catch (err) {
    next(err);
  }
};

export const downloadDocument: RequestHandler = async (req, res, next) => {
  try {
    const url = await documentService.getPublicDownloadUrl(req.params.id as string);
    res.json({ data: { url } });
  } catch (err) {
    next(err);
  }
};

export const previewDocument: RequestHandler = async (req, res, next) => {
  try {
    const url = await documentService.getPublicPreviewUrl(req.params.id as string);
    res.json({ data: { url } });
  } catch (err) {
    next(err);
  }
};

export const resolveByPath: RequestHandler = async (req, res, next) => {
  try {
    const pathStr = req.params[0];
    if (!pathStr) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }
    const segments = pathStr.split('/').filter(Boolean);
    if (segments.length === 0) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const folder = await folderService.resolveByPath(segments);
    const folderId = folder._id?.toString();
    const subfolders = await folderDao.listByParent(folder.ownerId, folderId);
    const documents = await documentDao.listByFolder(folderId);
    res.json({ data: { folder, subfolders, documents } });
  } catch (err) {
    next(err);
  }
};

export const updateDocument: RequestHandler = async (req, res, next) => {
  try {
    const doc = await documentService.updatePublic(req.params.id as string, req.body);
    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
};

export const uploadDocument: RequestHandler = async (req, res, next) => {
  try {
    const name = req.body.name || req.file?.originalname;
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const folderId = req.body.folderId;

    if (!req.file) {
      res.status(400).json({ error: 'File is required' });
      return;
    }
    if (!folderId) {
      res.status(400).json({ error: 'folderId is required' });
      return;
    }

    const doc = await documentService.uploadPublic({ file: req.file, name, tags, folderId });
    res.status(201).json({ data: doc });
  } catch (err) {
    next(err);
  }
};

export const deleteDocument: RequestHandler = async (req, res, next) => {
  try {
    await documentService.removePublic(req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const renameFolder: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.updatePublic(req.params.id as string, req.body);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const createFolder: RequestHandler = async (req, res, next) => {
  try {
    const folder = await folderService.createPublic(req.body.name, req.body.parentId);
    res.status(201).json({ data: folder });
  } catch (err) {
    next(err);
  }
};

export const deleteFolder: RequestHandler = async (req, res, next) => {
  try {
    await folderService.removePublic(req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
