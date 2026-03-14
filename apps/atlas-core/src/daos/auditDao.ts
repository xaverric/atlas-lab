import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: Date,
    service: String,
    action: String,
    category: String,
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
      status: String,
      statusCode: Number,
      errorMessage: String,
    },
    duration: Number,
  },
  { collection: 'auditlogs' },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AuditLog: mongoose.Model<any> | null = null;
let connectionReady = false;

export const connect = async (uri: string) => {
  try {
    const conn = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      bufferCommands: false,
    });
    conn.on('error', () => { connectionReady = false; });
    await conn.asPromise();
    AuditLog = conn.model('AuditLog', auditLogSchema);
    connectionReady = true;
  } catch {
    AuditLog = null;
    connectionReady = false;
  }
};

const getModel = () => {
  if (!connectionReady) return null;
  return AuditLog;
};

export interface AuditQuery {
  service?: string;
  action?: string;
  category?: string;
  userId?: string;
  from?: string;
  to?: string;
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export const find = async (query: AuditQuery) => {
  const model = getModel();
  const filter: Record<string, unknown> = {};

  if (query.service) filter.service = query.service;
  if (query.action) filter.action = { $regex: query.action, $options: 'i' };
  if (query.category) filter.category = query.category;
  if (query.userId) filter.userId = query.userId;
  if (query.status) filter['result.status'] = query.status;

  if (query.from || query.to) {
    filter.timestamp = {};
    if (query.from) (filter.timestamp as Record<string, unknown>).$gte = new Date(query.from);
    if (query.to) (filter.timestamp as Record<string, unknown>).$lte = new Date(query.to);
  }

  const limit = Math.min(query.limit || 50, 200);
  const offset = query.offset || 0;

  let sortField = 'timestamp';
  let sortOrder: 1 | -1 = -1;
  if (query.sort) {
    const [field, order] = query.sort.split(':');
    sortField = field || 'timestamp';
    sortOrder = order === 'asc' ? 1 : -1;
  }

  if (!model) return { data: [], total: 0, limit, offset };

  const [raw, total] = await Promise.all([
    model
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(offset)
      .limit(limit)
      .lean(),
    model.countDocuments(filter),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = raw.map((doc: any) => ({
    id: String(doc._id),
    timestamp: doc.timestamp,
    service: doc.service,
    action: doc.action,
    category: doc.category,
    userId: doc.userId,
    userName: doc.userName,
    resourceType: doc.resource?.type,
    resourceId: doc.resource?.id,
    resourceName: doc.resource?.name,
    status: doc.result?.status,
    statusCode: doc.result?.statusCode,
    error: doc.result?.errorMessage,
    duration: doc.duration,
    request: doc.request,
    result: doc.result,
    details: doc.details,
  }));

  return { data, total, limit, offset };
};
