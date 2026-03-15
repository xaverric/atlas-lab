import type { RequestHandler } from 'express';
import mongoose from 'mongoose';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const SERVICE_MAP: Record<string, { name: string; color: string }> = {
  'atlas': { name: 'Core (Users & Auth)', color: '#8caaee' },
  'atlas-dms': { name: 'File Storage (metadata)', color: '#1e66f5' },
  'atlas-scheduler': { name: 'Scheduler', color: '#df8e1d' },
  'atlas-notify': { name: 'Notifications', color: '#ea76cb' },
  'atlas-notes': { name: 'Notes (metadata)', color: '#40a02b' },
  'atlas-tracker': { name: 'Data Tracker', color: '#209fb5' },
  'keycloak': { name: 'Keycloak (Auth)', color: '#7287fd' },
};

export const getStorageStats: RequestHandler = async (_req, res, next) => {
  try {
    const admin = mongoose.connection.db!.admin();
    const dbList = await admin.listDatabases();

    const atlasDBs = dbList.databases.filter(
      (db: { name: string }) => db.name.startsWith('atlas') || db.name === 'keycloak'
    );

    // DMS file sizes from documents collection
    const dmsDb = mongoose.connection.client.db('atlas-dms');
    const fileSizeResult = await dmsDb
      .collection('documents')
      .aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }])
      .toArray();
    const totalFileSize = fileSizeResult[0]?.total || 0;

    // Notes content sizes
    const notesDb = mongoose.connection.client.db('atlas-notes');
    const notesSizeResult = await notesDb
      .collection('notes')
      .aggregate([{ $group: { _id: null, total: { $sum: '$contentSize' } } }])
      .toArray();
    const totalNotesSize = notesSizeResult[0]?.total || 0;

    const breakdown: { name: string; bytes: number; formatted: string; color: string }[] = [];

    for (const db of atlasDBs) {
      const info = SERVICE_MAP[db.name] || { name: db.name, color: '#acb0be' };
      breakdown.push({
        name: info.name,
        bytes: db.sizeOnDisk,
        formatted: formatBytes(db.sizeOnDisk),
        color: info.color,
      });
    }

    breakdown.push({
      name: 'Uploaded Files (S3)',
      bytes: totalFileSize,
      formatted: formatBytes(totalFileSize),
      color: '#04a5e5',
    });

    breakdown.push({
      name: 'Notes Content',
      bytes: totalNotesSize,
      formatted: formatBytes(totalNotesSize),
      color: '#a6d189',
    });

    const totalBytes = breakdown.reduce((sum, b) => sum + b.bytes, 0);
    breakdown.sort((a, b) => b.bytes - a.bytes);

    res.json({
      data: {
        total: { bytes: totalBytes, formatted: formatBytes(totalBytes) },
        breakdown,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

const SECTION_DB_MAP: Record<string, string> = {
  'core': 'atlas',
  'file-storage-metadata': 'atlas-dms',
  'scheduler': 'atlas-scheduler',
  'notifications': 'atlas-notify',
  'notes-metadata': 'atlas-notes',
  'data-tracker': 'atlas-tracker',
  'atlas-audit': 'atlas-audit',
  'keycloak': 'keycloak',
};

export const getStorageDetail: RequestHandler = async (req, res, next) => {
  try {
    const { section } = req.params;
    const sortBy = (req.query.sortBy as string) || 'size';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

    if (section === 'uploaded-files') {
      const db = mongoose.connection.client.db('atlas-dms');
      const sortField = sortBy === 'name' ? 'originalName' : sortBy === 'date' ? 'createdAt' : 'size';
      const docs = await db.collection('documents')
        .find({}, { projection: { name: 1, originalName: 1, mimeType: 1, size: 1, createdAt: 1 } })
        .sort({ [sortField]: sortOrder })
        .limit(100)
        .toArray();
      const total = await db.collection('documents').countDocuments();

      res.json({
        data: {
          items: docs.map((d) => ({
            id: d._id.toString(),
            name: d.originalName || d.name,
            type: d.mimeType || 'file',
            size: d.size || 0,
            sizeFormatted: formatBytes(d.size || 0),
            date: d.createdAt || null,
          })),
          total,
        },
      });
      return;
    }

    if (section === 'notes-content') {
      const db = mongoose.connection.client.db('atlas-notes');
      const sortField = sortBy === 'name' ? 'title' : sortBy === 'date' ? 'updatedAt' : 'contentSize';
      const notes = await db.collection('notes')
        .find({}, { projection: { title: 1, contentSize: 1, updatedAt: 1 } })
        .sort({ [sortField]: sortOrder })
        .limit(100)
        .toArray();
      const total = await db.collection('notes').countDocuments();

      res.json({
        data: {
          items: notes.map((n) => ({
            id: n._id.toString(),
            name: n.title || 'Untitled',
            type: 'note',
            size: n.contentSize || 0,
            sizeFormatted: formatBytes(n.contentSize || 0),
            date: n.updatedAt || null,
          })),
          total,
        },
      });
      return;
    }

    const dbName = SECTION_DB_MAP[section];
    if (!dbName) {
      res.status(400).json({ error: `Unknown section: ${section}` });
      return;
    }

    const db = mongoose.connection.client.db(dbName);
    const collections = await db.listCollections().toArray();
    const items: { id: string; name: string; type: string; size: number; sizeFormatted: string; date: string | null }[] = [];

    for (const col of collections) {
      try {
        const stats = await db.collection(col.name).stats();
        items.push({
          id: col.name,
          name: col.name,
          type: 'collection',
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          date: null,
        });
      } catch {
        items.push({
          id: col.name,
          name: col.name,
          type: 'collection',
          size: 0,
          sizeFormatted: '0 B',
          date: null,
        });
      }
    }

    const sortFn = (a: typeof items[0], b: typeof items[0]) => {
      if (sortBy === 'name') return sortOrder * a.name.localeCompare(b.name);
      return sortOrder * (a.size - b.size);
    };
    items.sort(sortFn);

    res.json({
      data: { items, total: items.length },
    });
  } catch (err) {
    next(err);
  }
};
