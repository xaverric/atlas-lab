import { createHmac } from "node:crypto";
import { Client, Inventory } from "../engine/types.js";

async function createBucket(
  dtoIn: Record<string, any>,
  inventory: Inventory
): Promise<Record<string, any>> {
  const { bucket } = dtoIn;
  const { endpoint, accessKey, secretKey } = inventory.minio!;

  const checkRes = await fetch(`${endpoint}/${bucket}`, {
    method: "HEAD",
    headers: minioHeaders("HEAD", bucket, accessKey, secretKey),
  });

  if (checkRes.ok) {
    return { bucket, status: "already_exists" };
  }

  const res = await fetch(`${endpoint}/${bucket}`, {
    method: "PUT",
    headers: minioHeaders("PUT", bucket, accessKey, secretKey),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createBucket failed (${res.status}): ${body}`);
  }

  return { bucket, status: "created" };
}

function minioHeaders(method: string, bucket: string, accessKey: string, secretKey: string) {
  const date = new Date().toUTCString();
  const stringToSign = `${method}\n\n\n${date}\n/${bucket}`;
  const signature = hmacSha1(secretKey, stringToSign);

  return {
    Date: date,
    Authorization: `AWS ${accessKey}:${signature}`,
  };
}

function hmacSha1(key: string, data: string): string {
  return createHmac("sha1", key).update(data).digest("base64");
}

const actions: Record<string, (dtoIn: Record<string, any>, inventory: Inventory) => Promise<Record<string, any>>> = {
  createBucket,
};

export const minioClient: Client = {
  async execute(action, dtoIn, inventory) {
    const fn = actions[action];
    if (!fn) throw new Error(`MinIO: unknown action "${action}"`);
    return fn(dtoIn, inventory);
  },
};
