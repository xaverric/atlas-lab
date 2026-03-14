import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import { createLogger } from '../config/logger.js';

const logger = createLogger('audit');

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    service: { type: String, required: true },
    action: { type: String, required: true },
    category: { type: String, default: 'api' },
    userId: String,
    userName: String,
    resource: {
      type: { type: String },
      id: String,
      name: String,
    },
    details: mongoose.Schema.Types.Mixed,
    request: {
      method: String,
      path: String,
      ip: String,
      userAgent: String,
    },
    result: {
      status: { type: String, enum: ['success', 'error'] },
      statusCode: Number,
      errorMessage: String,
    },
    duration: Number,
  },
  { collection: 'auditlogs' },
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ service: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 });

const SKIP_PATHS = new Set(['/health']);

const shouldSkip = (method: string, path: string): boolean => {
  if (method === 'OPTIONS') return true;
  if (SKIP_PATHS.has(path)) return true;
  return false;
};

const deriveAction = (method: string, path: string): string => {
  const stripped = path.replace(/^\/api\/v\d+\//, '');
  const segments = stripped.split('/').filter(Boolean);

  const parts: string[] = [];
  for (const seg of segments) {
    if (/^[a-f0-9]{24}$/.test(seg) || /^[0-9a-f-]{36}$/.test(seg)) continue;
    parts.push(seg);
  }

  const resource = parts.join('.') || 'root';
  return `${method.toLowerCase()}.${resource}`;
};

const extractResource = (path: string): { type?: string; id?: string } => {
  const stripped = path.replace(/^\/api\/v\d+\//, '');
  const segments = stripped.split('/').filter(Boolean);

  let type: string | undefined;
  let id: string | undefined;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (/^[a-f0-9]{24}$/.test(seg) || /^[0-9a-f-]{36}$/.test(seg)) {
      id = seg;
    } else if (!type) {
      type = seg;
    }
  }

  return { type, id };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AuditLog: mongoose.Model<any> | null = null;
let auditDisabled = false;
let connectionReady = false;
let connectionPromise: Promise<void> | null = null;

const ensureConnection = (uri: string): Promise<void> => {
  if (connectionReady || auditDisabled) return Promise.resolve();
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      const conn = mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        bufferCommands: false,
      });
      conn.on('error', (err) => {
        logger.warn({ err: err.message }, 'Audit DB connection error — disabling audit logging');
        auditDisabled = true;
        connectionReady = false;
      });
      await conn.asPromise();
      logger.info('Audit DB connected');
      AuditLog = conn.model('AuditLog', auditLogSchema);
      connectionReady = true;
    } catch {
      logger.warn('Audit DB connection failed — disabling audit logging');
      auditDisabled = true;
    }
  })();

  return connectionPromise;
};

const getAuditModel = () => {
  if (!connectionReady || auditDisabled) return null;
  return AuditLog;
};

export interface AuditEvent {
  service: string;
  action: string;
  category: string;
  userId?: string;
  userName?: string;
  resource?: { type?: string; id?: string; name?: string };
  details?: Record<string, unknown>;
  request?: { method?: string; path?: string; ip?: string; userAgent?: string };
  result?: { status: string; statusCode?: number; errorMessage?: string };
  duration?: number;
}

export const logAuditEvent = async (uri: string, event: AuditEvent): Promise<void> => {
  try {
    await ensureConnection(uri);
    const Model = getAuditModel();
    if (!Model) return;
    await Model.create({ timestamp: new Date(), ...event });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Failed to write audit event');
  }
};

export const createAuditMiddleware = (serviceName: string, auditMongoUri?: string): RequestHandler => {
  const uri = auditMongoUri || process.env.AUDIT_MONGODB_URI || 'mongodb://localhost:27017/atlas-audit';
  ensureConnection(uri);

  return (req, res, next) => {
    if (shouldSkip(req.method, req.path)) return next();

    const start = Date.now();
    const originalEnd = res.end;

    res.end = function (...args: Parameters<typeof originalEnd>) {
      const duration = Date.now() - start;
      const action = deriveAction(req.method, req.path);
      const resource = extractResource(req.path);

      const event: AuditEvent = {
        service: serviceName,
        action,
        category: 'api',
        userId: req.auth?.sub,
        userName: req.auth?.name,
        resource,
        request: {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
        result: {
          status: res.statusCode < 400 ? 'success' : 'error',
          statusCode: res.statusCode,
        },
        duration,
      };

      logAuditEvent(uri, event).catch(() => {});

      return originalEnd.apply(res, args) as unknown as ReturnType<typeof originalEnd>;
    } as typeof originalEnd;

    next();
  };
};
