import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/noteFolderService.js', () => ({
  isFolderPublic: vi.fn(),
  resolvePublicPermission: vi.fn(),
}));

const mockNoteFindById = vi.fn();
const mockNotefolderFindById = vi.fn();

vi.mock('../../src/models/Note.js', () => ({
  Note: { findById: (...args: unknown[]) => mockNoteFindById(...args) },
}));

vi.mock('../../src/models/NoteFolder.js', () => ({
  NoteFolder: { findById: (...args: unknown[]) => mockNotefolderFindById(...args) },
}));

import { checkPublicPermission } from '../../src/middleware/checkPublicPermission.js';
import * as noteFolderService from '../../src/services/noteFolderService.js';

describe('checkPublicPermission', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const makeReq = (params = {}, body = {}) => ({
    params,
    body,
  }) as any;

  const mockRes = {} as any;

  it('allows access when note folder is public with sufficient permission', async () => {
    mockNoteFindById.mockResolvedValue({ folderId: { toString: () => 'f1' } });
    vi.mocked(noteFolderService.isFolderPublic).mockResolvedValue(true);
    mockNotefolderFindById.mockResolvedValue({ visibility: 'public', publicPermission: 'edit', parentId: null });

    const middleware = checkPublicPermission('view');
    const req = makeReq({ id: 'n1' });
    const next = vi.fn();

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.publicPermission).toBeDefined();
  });

  it('passes error to next when folder is not public', async () => {
    mockNoteFindById.mockResolvedValue({ folderId: { toString: () => 'f1' } });
    vi.mocked(noteFolderService.isFolderPublic).mockResolvedValue(false);

    const middleware = checkPublicPermission('view');
    const req = makeReq({ id: 'n1' });
    const next = vi.fn();

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Folder is not public' }));
  });

  it('passes error when permission is insufficient', async () => {
    mockNoteFindById.mockResolvedValue({ folderId: { toString: () => 'f1' } });
    vi.mocked(noteFolderService.isFolderPublic).mockResolvedValue(true);
    mockNotefolderFindById.mockResolvedValue({ visibility: 'public', publicPermission: 'view', parentId: null });

    const middleware = checkPublicPermission('edit');
    const req = makeReq({ id: 'n1' });
    const next = vi.fn();

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('insufficient'),
    }));
  });

  it('resolves folderId from request body when no note', async () => {
    mockNoteFindById.mockResolvedValue(null);
    vi.mocked(noteFolderService.isFolderPublic).mockResolvedValue(true);
    mockNotefolderFindById.mockResolvedValue({ visibility: 'public', publicPermission: 'full', parentId: null });

    const middleware = checkPublicPermission('view');
    const req = makeReq({ id: 'n1' }, { folderId: 'f2' });
    const next = vi.fn();

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('passes error when no folder context can be determined', async () => {
    mockNoteFindById.mockResolvedValue(null);

    const middleware = checkPublicPermission('view');
    const req = makeReq({ id: 'n1' });
    const next = vi.fn();

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Cannot determine folder context',
    }));
  });

  it('resolves folderId from params.folderId', async () => {
    mockNoteFindById.mockResolvedValue(null);
    vi.mocked(noteFolderService.isFolderPublic).mockResolvedValue(true);
    mockNotefolderFindById.mockResolvedValue({ visibility: 'public', publicPermission: 'view', parentId: null });

    const middleware = checkPublicPermission('view');
    const req = makeReq({ id: 'n1', folderId: 'f3' });
    const next = vi.fn();

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.publicFolderId).toBe('f3');
  });
});
