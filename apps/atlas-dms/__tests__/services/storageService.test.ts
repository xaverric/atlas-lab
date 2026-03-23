import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MockPutObjectCommand, MockDeleteObjectCommand, MockGetObjectCommand } = vi.hoisted(() => ({
  MockPutObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
  MockDeleteObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
  MockGetObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: MockPutObjectCommand,
  DeleteObjectCommand: MockDeleteObjectCommand,
  GetObjectCommand: MockGetObjectCommand,
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));
vi.mock('../../src/config/s3.js', () => ({
  s3: { send: vi.fn() },
  s3Public: { send: vi.fn() },
}));
vi.mock('../../src/config/index.js', () => ({
  config: {
    minio: {
      bucket: 'test-bucket',
      endpoint: 'http://localhost:9000',
      publicUrl: '',
      accessKey: 'key',
      secretKey: 'secret',
      region: 'us-east-1',
    },
  },
}));

import { upload, getPresignedDownloadUrl, getPresignedInlineUrl, remove } from '../../src/services/storageService.js';
import { s3 } from '../../src/config/s3.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const mockFile = {
  originalname: 'report.pdf',
  mimetype: 'application/pdf',
  size: 4096,
  buffer: Buffer.from('content'),
} as Express.Multer.File;

describe('storageService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('upload', () => {
    it('sends PutObjectCommand and returns generated key', async () => {
      vi.mocked(s3.send).mockResolvedValue({} as any);

      const key = await upload(mockFile);
      expect(s3.send).toHaveBeenCalledTimes(1);
      expect(MockPutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Body: mockFile.buffer,
          ContentType: 'application/pdf',
        }),
      );
      expect(key).toContain('report.pdf');
      expect(key).toMatch(/^\d+-/);
    });

    it('propagates S3 errors', async () => {
      vi.mocked(s3.send).mockRejectedValue(new Error('S3 failure'));
      await expect(upload(mockFile)).rejects.toThrow('S3 failure');
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('returns signed url with attachment disposition', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3/signed-dl');

      const url = await getPresignedDownloadUrl('key-1', 'file.pdf');
      expect(url).toBe('https://s3/signed-dl');
      expect(MockGetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'key-1',
          ResponseContentDisposition: 'attachment; filename="file.pdf"',
        }),
      );
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 });
    });
  });

  describe('getPresignedInlineUrl', () => {
    it('returns inline disposition for safe file types', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3/signed-inline');

      const url = await getPresignedInlineUrl('key-1', 'photo.jpg');
      expect(url).toBe('https://s3/signed-inline');
      expect(MockGetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ResponseContentDisposition: 'inline; filename="photo.jpg"',
        }),
      );
    });

    it('forces attachment for HTML files', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3/signed-dl');

      await getPresignedInlineUrl('key-1', 'page.html');
      expect(MockGetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ResponseContentDisposition: 'attachment; filename="page.html"',
        }),
      );
    });

    it('forces attachment for SVG files', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3/signed-dl');

      await getPresignedInlineUrl('key-1', 'icon.svg');
      expect(MockGetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ResponseContentDisposition: 'attachment; filename="icon.svg"',
        }),
      );
    });

    it('forces attachment for HTM files', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3/signed-dl');

      await getPresignedInlineUrl('key-1', 'page.htm');
      expect(MockGetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ResponseContentDisposition: 'attachment; filename="page.htm"',
        }),
      );
    });
  });

  describe('remove', () => {
    it('sends DeleteObjectCommand', async () => {
      vi.mocked(s3.send).mockResolvedValue({} as any);

      await remove('key-to-delete');
      expect(s3.send).toHaveBeenCalledTimes(1);
      expect(MockDeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'key-to-delete',
      });
    });

    it('propagates S3 errors', async () => {
      vi.mocked(s3.send).mockRejectedValue(new Error('Delete failed'));
      await expect(remove('key-1')).rejects.toThrow('Delete failed');
    });
  });
});
