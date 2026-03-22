import type { RequestHandler } from 'express';
import mongoose from 'mongoose';

const getClientDb = (name: string) => (mongoose.connection as any).client.db(name);

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
    const dmsDb = getClientDb('atlas-dms');
    const fileSizeResult = await dmsDb
      .collection('documents')
      .aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }])
      .toArray();
    const totalFileSize = fileSizeResult[0]?.total || 0;

    // Notes content sizes
    const notesDb = getClientDb('atlas-notes');
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
        bytes: db.sizeOnDisk ?? 0,
        formatted: formatBytes(db.sizeOnDisk ?? 0),
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

export const getSystemResources: RequestHandler = async (_req, res, next) => {
  try {
    const os = await import('os');

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'Unknown';

    const cpuTimes = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      return { total, idle: cpu.times.idle };
    });
    const totalCpu = cpuTimes.reduce((a, b) => a + b.total, 0);
    const totalIdle = cpuTimes.reduce((a, b) => a + b.idle, 0);
    const cpuUsage = ((totalCpu - totalIdle) / totalCpu) * 100;

    const uptimeSeconds = os.uptime();
    const processUptime = process.uptime();
    const platform = os.platform();
    const hostname = os.hostname();
    const nodeVersion = process.version;

    const formatUptime = (seconds: number) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      if (days > 0) return `${days}d ${hours}h ${mins}m`;
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    };

    const procMem = process.memoryUsage();

    res.json({
      data: {
        system: {
          hostname,
          platform,
          nodeVersion,
          cpuModel,
          cpuCount,
          uptimeFormatted: formatUptime(uptimeSeconds),
          uptimeSeconds,
        },
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          usagePercent: ((usedMem / totalMem) * 100).toFixed(1),
          totalFormatted: formatBytes(totalMem),
          usedFormatted: formatBytes(usedMem),
          freeFormatted: formatBytes(freeMem),
        },
        cpu: {
          usagePercent: cpuUsage.toFixed(1),
          cores: cpuCount,
          model: cpuModel,
        },
        process: {
          uptimeFormatted: formatUptime(processUptime),
          heapUsed: procMem.heapUsed,
          heapTotal: procMem.heapTotal,
          rss: procMem.rss,
          heapUsedFormatted: formatBytes(procMem.heapUsed),
          rssFormatted: formatBytes(procMem.rss),
        },
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

const SECTION_DB_MAP: Record<string, string> = {
  'core': 'atlas',
  'core-users-auth': 'atlas',
  'file-storage-metadata': 'atlas-dms',
  'scheduler': 'atlas-scheduler',
  'notifications': 'atlas-notify',
  'notes-metadata': 'atlas-notes',
  'notes-metadata-1': 'atlas-notes',
  'data-tracker': 'atlas-tracker',
  'atlas-audit': 'atlas-audit',
  'keycloak': 'keycloak',
  'keycloak-auth': 'keycloak',
};

export const getStorageDetail: RequestHandler = async (req, res, next) => {
  try {
    const { section } = req.params;
    const sortBy = (req.query.sortBy as string) || 'size';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

    if (section === 'uploaded-files' || section === 'uploaded-files-s3-' || section === 'uploaded-files-s3') {
      const db = getClientDb('atlas-dms');
      const sortField = sortBy === 'name' ? 'originalName' : sortBy === 'date' ? 'createdAt' : 'size';
      const docs = await db.collection('documents')
        .find({}, { projection: { name: 1, originalName: 1, mimeType: 1, size: 1, createdAt: 1 } })
        .sort({ [sortField]: sortOrder })
        .limit(100)
        .toArray();
      const total = await db.collection('documents').countDocuments();

      res.json({
        data: {
          items: docs.map((d: any) => ({
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
      const db = getClientDb('atlas-notes');
      const sortField = sortBy === 'name' ? 'title' : sortBy === 'date' ? 'updatedAt' : 'contentSize';
      const notes = await db.collection('notes')
        .find({}, { projection: { title: 1, contentSize: 1, updatedAt: 1 } })
        .sort({ [sortField]: sortOrder })
        .limit(100)
        .toArray();
      const total = await db.collection('notes').countDocuments();

      res.json({
        data: {
          items: notes.map((n: any) => ({
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

    const dbName = SECTION_DB_MAP[section as string];
    if (!dbName) {
      res.status(400).json({ error: `Unknown section: ${section}` });
      return;
    }

    const db = getClientDb(dbName);
    const collections = await db.listCollections().toArray();
    const items: { id: string; name: string; type: string; size: number; sizeFormatted: string; date: string | null }[] = [];

    for (const col of collections) {
      try {
        const result = await db.command({ collStats: col.name });
        const size = result.storageSize || result.size || 0;
        const count = result.count || 0;
        items.push({
          id: col.name,
          name: col.name,
          type: `collection (${count} docs)`,
          size,
          sizeFormatted: formatBytes(size),
          date: null,
        });
      } catch {
        // fallback: count documents and estimate size
        try {
          const count = await db.collection(col.name).countDocuments();
          items.push({
            id: col.name,
            name: col.name,
            type: `collection (${count} docs)`,
            size: 0,
            sizeFormatted: '0 B',
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
