import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from '../config/s3.js';
import { config } from '../config/index.js';
import crypto from 'node:crypto';

const { bucket } = config.minio;

export const upload = async (file: Express.Multer.File): Promise<string> => {
  const key = `${Date.now()}-${crypto.randomUUID()}-${file.originalname}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return key;
};

export const getPresignedDownloadUrl = async (key: string, filename: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  return getSignedUrl(s3, command, { expiresIn: 300 });
};

export const getPresignedInlineUrl = async (key: string, filename: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `inline; filename="${filename}"`,
  });

  return getSignedUrl(s3, command, { expiresIn: 300 });
};

export const remove = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
};
