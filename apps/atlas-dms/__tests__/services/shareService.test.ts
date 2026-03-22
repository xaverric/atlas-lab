import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/shareTokenDao.js', () => ({
  findByToken: vi.fn(), findById: vi.fn(), deleteById: vi.fn(), create: vi.fn(), incrementDownloadCount: vi.fn(),
}));
vi.mock('../../src/daos/documentDao.js', () => ({ findById: vi.fn(), listByFolder: vi.fn() }));
vi.mock('../../src/daos/folderDao.js', () => ({ findById: vi.fn(), listByParent: vi.fn() }));
vi.mock('../../src/services/storageService.js', () => ({ getPresignedDownloadUrl: vi.fn() }));

import { revoke } from '../../src/services/shareService.js';
import * as shareTokenDao from '../../src/daos/shareTokenDao.js';
import * as documentDao from '../../src/daos/documentDao.js';

describe('shareService.revoke', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws 404 when not found', async () => {
    vi.mocked(shareTokenDao.findByToken).mockRejectedValue(new Error());
    vi.mocked(shareTokenDao.findById).mockResolvedValue(null as any);
    await expect(revoke('unknown', 'user-1')).rejects.toThrow('Share token not found');
  });

  it('throws 403 when non-owner revokes', async () => {
    vi.mocked(shareTokenDao.findByToken).mockResolvedValue({ id: 's1', type: 'document', documentId: 'doc-1' } as any);
    vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-2' } as any);
    await expect(revoke('s1', 'user-1')).rejects.toThrow('Access denied');
  });

  it('deletes after ownership verified', async () => {
    vi.mocked(shareTokenDao.findByToken).mockResolvedValue({ id: 's1', type: 'document', documentId: 'doc-1' } as any);
    vi.mocked(documentDao.findById).mockResolvedValue({ ownerId: 'user-1' } as any);
    vi.mocked(shareTokenDao.deleteById).mockResolvedValue(null as any);
    await revoke('s1', 'user-1');
    expect(shareTokenDao.deleteById).toHaveBeenCalledWith('s1');
  });
});
