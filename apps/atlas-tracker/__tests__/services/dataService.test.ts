import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/dynamicDao.js', () => ({
  insertOne: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
  deleteById: vi.fn(),
}));

vi.mock('../../src/services/schemaValidator.js', () => ({
  compile: vi.fn(),
  validate: vi.fn(),
}));

vi.mock('../../src/services/publishNotification.js', () => ({
  publishNotification: vi.fn(),
}));

import * as dataService from '../../src/services/dataService.js';
import * as dynamicDao from '../../src/daos/dynamicDao.js';
import * as schemaValidator from '../../src/services/schemaValidator.js';
import { publishNotification } from '../../src/services/publishNotification.js';

const userId = 'user-123';
const endpointName = 'my-endpoint';
const schema = { type: 'object', properties: { temp: { type: 'number' } } };
const metadata = { source: 'api', ip: '127.0.0.1' };

describe('dataService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('insert', () => {
    it('validates data, inserts, and publishes notification', async () => {
      vi.mocked(schemaValidator.validate).mockReturnValue({ valid: true });
      vi.mocked(dynamicDao.insertOne).mockResolvedValue({ insertedId: 'doc-1' } as any);

      const result = await dataService.insert(userId, endpointName, schema, { temp: 22 }, metadata);

      expect(schemaValidator.validate).toHaveBeenCalledWith(`${userId}:${endpointName}`, { temp: 22 });
      expect(dynamicDao.insertOne).toHaveBeenCalledWith(
        `tracker_${userId}_${endpointName}`,
        expect.objectContaining({ data: { temp: 22 }, metadata }),
      );
      expect(result.id).toBe('doc-1');
      expect(publishNotification).toHaveBeenCalledWith(
        userId,
        'Data Submitted',
        expect.stringContaining(endpointName),
        'tracker.data.submitted',
      );
    });

    it('compiles schema if validator is not yet cached', async () => {
      vi.mocked(schemaValidator.validate)
        .mockImplementationOnce(() => { throw new Error('not compiled'); })
        .mockReturnValue({ valid: true });
      vi.mocked(dynamicDao.insertOne).mockResolvedValue({ insertedId: 'doc-2' } as any);

      await dataService.insert(userId, endpointName, schema, { temp: 10 }, metadata);

      expect(schemaValidator.compile).toHaveBeenCalledWith(`${userId}:${endpointName}`, schema);
    });

    it('throws when data validation fails', async () => {
      vi.mocked(schemaValidator.validate).mockReturnValue({
        valid: false,
        errors: ['/temp must be number'],
      });

      await expect(
        dataService.insert(userId, endpointName, schema, { temp: 'bad' }, metadata),
      ).rejects.toThrow('Data validation failed');
    });
  });

  describe('query', () => {
    it('returns items with pagination', async () => {
      const docs = [
        { _id: 'id-1', data: { temp: 20 }, createdAt: new Date() },
        { _id: 'id-2', data: { temp: 21 }, createdAt: new Date() },
      ];
      vi.mocked(dynamicDao.find).mockResolvedValue(docs as any);
      vi.mocked(dynamicDao.count).mockResolvedValue(2);

      const result = await dataService.query(userId, endpointName, {
        limit: 10,
        offset: 0,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty('id', 'id-1');
      expect(result.items[0]).not.toHaveProperty('_id');
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('applies default sort (createdAt desc) when no sort given', async () => {
      vi.mocked(dynamicDao.find).mockResolvedValue([]);
      vi.mocked(dynamicDao.count).mockResolvedValue(0);

      await dataService.query(userId, endpointName, {});

      expect(dynamicDao.find).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { createdAt: -1 },
        0,
        100,
      );
    });

    it('applies custom sort', async () => {
      vi.mocked(dynamicDao.find).mockResolvedValue([]);
      vi.mocked(dynamicDao.count).mockResolvedValue(0);

      await dataService.query(userId, endpointName, { sort: 'temp:asc' });

      expect(dynamicDao.find).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { temp: 1 },
        0,
        100,
      );
    });

    it('builds date range filter from from/to', async () => {
      vi.mocked(dynamicDao.find).mockResolvedValue([]);
      vi.mocked(dynamicDao.count).mockResolvedValue(0);

      await dataService.query(userId, endpointName, {
        from: '2026-01-01',
        to: '2026-01-31',
      });

      const expectedQuery = {
        createdAt: {
          $gte: new Date('2026-01-01'),
          $lte: new Date('2026-01-31'),
        },
      };
      expect(dynamicDao.find).toHaveBeenCalledWith(
        expect.any(String),
        expectedQuery,
        expect.any(Object),
        0,
        100,
      );
    });

    it('builds filter from JSON filter param', async () => {
      vi.mocked(dynamicDao.find).mockResolvedValue([]);
      vi.mocked(dynamicDao.count).mockResolvedValue(0);

      await dataService.query(userId, endpointName, {
        filter: JSON.stringify({ temp: { $gte: 20 } }),
      });

      expect(dynamicDao.find).toHaveBeenCalledWith(
        expect.any(String),
        { 'data.temp': { $gte: 20 } },
        expect.any(Object),
        0,
        100,
      );
    });

    it('ignores top-level dollar-sign keys in filter', async () => {
      vi.mocked(dynamicDao.find).mockResolvedValue([]);
      vi.mocked(dynamicDao.count).mockResolvedValue(0);

      await dataService.query(userId, endpointName, {
        filter: JSON.stringify({ $where: 'true', name: 'ok' }),
      });

      expect(dynamicDao.find).toHaveBeenCalledWith(
        expect.any(String),
        { 'data.name': 'ok' },
        expect.any(Object),
        0,
        100,
      );
    });

    it('strips disallowed mongo operators from filter', async () => {
      vi.mocked(dynamicDao.find).mockResolvedValue([]);
      vi.mocked(dynamicDao.count).mockResolvedValue(0);

      await dataService.query(userId, endpointName, {
        filter: JSON.stringify({ temp: { $where: 'hack', $gt: 5 } }),
      });

      expect(dynamicDao.find).toHaveBeenCalledWith(
        expect.any(String),
        { 'data.temp': { $gt: 5 } },
        expect.any(Object),
        0,
        100,
      );
    });

    it('handles invalid JSON filter gracefully', async () => {
      vi.mocked(dynamicDao.find).mockResolvedValue([]);
      vi.mocked(dynamicDao.count).mockResolvedValue(0);

      await dataService.query(userId, endpointName, { filter: 'not-json' });

      expect(dynamicDao.find).toHaveBeenCalledWith(
        expect.any(String),
        {},
        expect.any(Object),
        0,
        100,
      );
    });
  });

  describe('deleteEntry', () => {
    it('deletes entry by id', async () => {
      vi.mocked(dynamicDao.deleteById).mockResolvedValue({ deletedCount: 1 } as any);

      await expect(
        dataService.deleteEntry(userId, endpointName, 'entry-1'),
      ).resolves.toBeUndefined();

      expect(dynamicDao.deleteById).toHaveBeenCalledWith(
        `tracker_${userId}_${endpointName}`,
        'entry-1',
      );
    });

    it('throws 404 when entry not found', async () => {
      vi.mocked(dynamicDao.deleteById).mockResolvedValue({ deletedCount: 0 } as any);

      await expect(
        dataService.deleteEntry(userId, endpointName, 'missing'),
      ).rejects.toThrow('Entry not found');
    });
  });
});
