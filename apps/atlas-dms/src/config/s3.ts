import { S3Client } from '@aws-sdk/client-s3';
import { config } from './index.js';

export const s3 = new S3Client({
  endpoint: config.minio.endpoint,
  region: config.minio.region,
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});
