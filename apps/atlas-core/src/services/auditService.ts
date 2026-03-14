import * as auditDao from '../daos/auditDao.js';
import type { AuditQuery } from '../daos/auditDao.js';

export const queryEvents = (query: AuditQuery) => auditDao.find(query);
