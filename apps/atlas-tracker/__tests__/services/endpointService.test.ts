import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/endpointDao.js', () => ({
  create: vi.fn(),
  findByUserIdAndName: vi.fn(),
  findPublicByName: vi.fn(),
  findAllByUserId: vi.fn(),
  updateByUserIdAndName: vi.fn(),
  deleteByUserIdAndName: vi.fn(),
}));

vi.mock('../../src/daos/dynamicDao.js', () => ({
  createCollection: vi.fn(),
  dropCollection: vi.fn(),
}));

vi.mock('../../src/services/schemaValidator.js', () => ({
  compile: vi.fn(),
  remove: vi.fn(),
}));

import * as endpointService from '../../src/services/endpointService.js';
import * as endpointDao from '../../src/daos/endpointDao.js';
import * as dynamicDao from '../../src/daos/dynamicDao.js';
import * as schemaValidator from '../../src/services/schemaValidator.js';

const userId = 'user-123';

const validData = {
  name: 'my-endpoint',
  displayName: 'My Endpoint',
  description: 'Test endpoint',
  schema: { type: 'object', properties: { temp: { type: 'number' } } },
};

describe('endpointService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('create', () => {
    it('creates an endpoint with valid slug', async () => {
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue(null as any);
      vi.mocked(endpointDao.create).mockResolvedValue({ id: 'ep-1', ...validData } as any);
      vi.mocked(dynamicDao.createCollection).mockResolvedValue(undefined as any);

      const result = await endpointService.create(userId, validData);

      expect(result).toEqual({ id: 'ep-1', ...validData });
      expect(endpointDao.create).toHaveBeenCalledWith({ ...validData, userId });
      expect(dynamicDao.createCollection).toHaveBeenCalledWith(
        `tracker_${userId}_my-endpoint`,
        [],
      );
      expect(schemaValidator.compile).toHaveBeenCalledWith(
        `${userId}:my-endpoint`,
        validData.schema,
      );
    });

    it('passes indexes to createCollection', async () => {
      const indexes = [{ fields: { temp: 1 } }];
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue(null as any);
      vi.mocked(endpointDao.create).mockResolvedValue({ id: 'ep-1' } as any);
      vi.mocked(dynamicDao.createCollection).mockResolvedValue(undefined as any);

      await endpointService.create(userId, { ...validData, indexes });

      expect(dynamicDao.createCollection).toHaveBeenCalledWith(
        `tracker_${userId}_my-endpoint`,
        indexes,
      );
    });

    it('rejects invalid slug name', async () => {
      await expect(
        endpointService.create(userId, { ...validData, name: 'INVALID NAME' }),
      ).rejects.toThrow('Name must be a URL-friendly slug');
    });

    it('rejects single character slug', async () => {
      await expect(
        endpointService.create(userId, { ...validData, name: 'a' }),
      ).rejects.toThrow('Name must be a URL-friendly slug');
    });

    it('rejects slug starting with hyphen', async () => {
      await expect(
        endpointService.create(userId, { ...validData, name: '-abc' }),
      ).rejects.toThrow('Name must be a URL-friendly slug');
    });

    it('throws 409 when endpoint name already exists', async () => {
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue({ id: 'existing' } as any);

      await expect(
        endpointService.create(userId, validData),
      ).rejects.toThrow('Endpoint with this name already exists');
    });
  });

  describe('list', () => {
    it('returns all endpoints for user', async () => {
      const endpoints = [{ id: '1' }, { id: '2' }];
      vi.mocked(endpointDao.findAllByUserId).mockResolvedValue(endpoints as any);

      const result = await endpointService.list(userId);
      expect(result).toBe(endpoints);
      expect(endpointDao.findAllByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('getByName', () => {
    it('returns the endpoint when found', async () => {
      const endpoint = { id: '1', name: 'my-endpoint' };
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue(endpoint as any);

      const result = await endpointService.getByName(userId, 'my-endpoint');
      expect(result).toBe(endpoint);
    });

    it('throws 404 when not found', async () => {
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue(null as any);

      await expect(
        endpointService.getByName(userId, 'missing'),
      ).rejects.toThrow('Endpoint not found');
    });
  });

  describe('getPublicByName', () => {
    it('returns the public endpoint when found', async () => {
      const endpoint = { id: '1', name: 'pub', visibility: 'public' };
      vi.mocked(endpointDao.findPublicByName).mockResolvedValue(endpoint as any);

      const result = await endpointService.getPublicByName('pub');
      expect(result).toBe(endpoint);
    });

    it('throws 404 when not found', async () => {
      vi.mocked(endpointDao.findPublicByName).mockResolvedValue(null as any);

      await expect(
        endpointService.getPublicByName('missing'),
      ).rejects.toThrow('Endpoint not found');
    });
  });

  describe('update', () => {
    it('updates endpoint and recompiles schema when schema changes', async () => {
      const endpoint = { id: '1', name: 'my-endpoint' };
      const newSchema = { type: 'object', properties: { v: { type: 'string' } } };
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue(endpoint as any);
      vi.mocked(endpointDao.updateByUserIdAndName).mockResolvedValue({ ...endpoint, schema: newSchema } as any);

      await endpointService.update(userId, 'my-endpoint', { schema: newSchema });

      expect(schemaValidator.compile).toHaveBeenCalledWith(
        `${userId}:my-endpoint`,
        newSchema,
      );
      expect(endpointDao.updateByUserIdAndName).toHaveBeenCalledWith(
        userId, 'my-endpoint', { schema: newSchema },
      );
    });

    it('updates endpoint without recompiling when schema is unchanged', async () => {
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue({ id: '1' } as any);
      vi.mocked(endpointDao.updateByUserIdAndName).mockResolvedValue({ id: '1' } as any);

      await endpointService.update(userId, 'my-endpoint', { displayName: 'New Name' });

      expect(schemaValidator.compile).not.toHaveBeenCalled();
    });

    it('throws 404 when endpoint not found', async () => {
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue(null as any);

      await expect(
        endpointService.update(userId, 'missing', {}),
      ).rejects.toThrow('Endpoint not found');
    });
  });

  describe('remove', () => {
    it('drops collection, removes validator, and deletes endpoint', async () => {
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue({ id: '1' } as any);
      vi.mocked(dynamicDao.dropCollection).mockResolvedValue(undefined as any);
      vi.mocked(endpointDao.deleteByUserIdAndName).mockResolvedValue({ id: '1' } as any);

      await endpointService.remove(userId, 'my-endpoint');

      expect(dynamicDao.dropCollection).toHaveBeenCalledWith(`tracker_${userId}_my-endpoint`);
      expect(schemaValidator.remove).toHaveBeenCalledWith(`${userId}:my-endpoint`);
      expect(endpointDao.deleteByUserIdAndName).toHaveBeenCalledWith(userId, 'my-endpoint');
    });

    it('throws 404 when endpoint not found', async () => {
      vi.mocked(endpointDao.findByUserIdAndName).mockResolvedValue(null as any);

      await expect(
        endpointService.remove(userId, 'missing'),
      ).rejects.toThrow('Endpoint not found');
    });
  });
});
