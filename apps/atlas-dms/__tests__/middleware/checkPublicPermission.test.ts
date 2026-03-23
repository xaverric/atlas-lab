import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/daos/documentDao.js', () => ({
  findById: vi.fn(),
}));
vi.mock('../../src/daos/folderDao.js', () => ({
  findById: vi.fn(),
}));
vi.mock('../../src/services/folderService.js', () => ({
  resolvePublicPermission: vi.fn(),
}));

import { checkPublicPermission } from '../../src/middleware/checkPublicPermission.js';
import * as documentDao from '../../src/daos/documentDao.js';
import * as folderDao from '../../src/daos/folderDao.js';
import * as folderService from '../../src/services/folderService.js';

const createReq = (overrides: any = {}) => ({
  params: {},
  body: {},
  query: {},
  ...overrides,
});

const createRes = () => ({} as any);

describe('checkPublicPermission', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls next() when folder is public with sufficient permission', async () => {
    const req = createReq({ params: { folderId: 'f1' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('edit');

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(folderService.resolvePublicPermission).toHaveBeenCalledWith('f1');
    expect(next).toHaveBeenCalledWith();
    expect((req as any).publicPermission).toBe('edit');
    expect((req as any).publicFolderId).toBe('f1');
  });

  it('calls next(err) with 403 when permission is insufficient', async () => {
    const req = createReq({ params: { folderId: 'f1' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('view');

    await checkPublicPermission('edit')(req as any, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('calls next(err) with 403 when folder is not public', async () => {
    const req = createReq({ params: { folderId: 'f1' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue(null);

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('resolves folderId from body.folderId', async () => {
    const req = createReq({ body: { folderId: 'f-body' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('full');

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(folderService.resolvePublicPermission).toHaveBeenCalledWith('f-body');
    expect(next).toHaveBeenCalledWith();
  });

  it('resolves folderId from body.parentId', async () => {
    const req = createReq({ body: { parentId: 'f-parent' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('edit');

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(folderService.resolvePublicPermission).toHaveBeenCalledWith('f-parent');
  });

  it('resolves folderId from query.folderId', async () => {
    const req = createReq({ query: { folderId: 'f-query' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('view');

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(folderService.resolvePublicPermission).toHaveBeenCalledWith('f-query');
  });

  it('resolves folderId from document when params.id is a document', async () => {
    const req = createReq({ params: { id: 'doc-1' } });
    const next = vi.fn();
    vi.mocked(documentDao.findById).mockResolvedValue({ folderId: 'f-from-doc' } as any);
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('view');

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(documentDao.findById).toHaveBeenCalledWith('doc-1');
    expect(folderService.resolvePublicPermission).toHaveBeenCalledWith('f-from-doc');
  });

  it('resolves folderId from folder when params.id is a folder', async () => {
    const req = createReq({ params: { id: 'folder-1' } });
    const next = vi.fn();
    vi.mocked(documentDao.findById).mockResolvedValue(null as any);
    vi.mocked(folderDao.findById).mockResolvedValue({ _id: { toString: () => 'folder-1' }, parentId: 'f-parent' } as any);
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('full');

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(folderDao.findById).toHaveBeenCalledWith('folder-1');
    expect(folderService.resolvePublicPermission).toHaveBeenCalledWith('f-parent');
  });

  it('uses folder own id when folder has no parentId', async () => {
    const req = createReq({ params: { id: 'root-folder' } });
    const next = vi.fn();
    vi.mocked(documentDao.findById).mockResolvedValue(null as any);
    vi.mocked(folderDao.findById).mockResolvedValue({ _id: { toString: () => 'root-folder' }, parentId: null } as any);
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('view');

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(folderService.resolvePublicPermission).toHaveBeenCalledWith('root-folder');
  });

  it('calls next(err) with 400 when no folder context can be determined', async () => {
    const req = createReq({});
    const next = vi.fn();

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it('calls next(err) when params.id matches neither doc nor folder', async () => {
    const req = createReq({ params: { id: 'unknown' } });
    const next = vi.fn();
    vi.mocked(documentDao.findById).mockResolvedValue(null as any);
    vi.mocked(folderDao.findById).mockResolvedValue(null as any);

    await checkPublicPermission('view')(req as any, createRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it('allows exact permission match (edit requires edit)', async () => {
    const req = createReq({ params: { folderId: 'f1' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('edit');

    await checkPublicPermission('edit')(req as any, createRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('full permission satisfies all requirements', async () => {
    const req = createReq({ params: { folderId: 'f1' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('full');

    await checkPublicPermission('full')(req as any, createRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('view permission is insufficient for full', async () => {
    const req = createReq({ params: { folderId: 'f1' } });
    const next = vi.fn();
    vi.mocked(folderService.resolvePublicPermission).mockResolvedValue('view');

    await checkPublicPermission('full')(req as any, createRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});
