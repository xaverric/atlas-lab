import { Inventory } from "../engine/types.js";

export const inventory: Inventory = {
  keycloak: {
    baseUrl: "http://localhost:8080",
    realm: "atlas",
    adminUser: process.env.KC_ADMIN_USER || "admin",
    adminPassword: process.env.KC_ADMIN_PASSWORD || "admin",
  },
  atlasCore: {
    baseUrl: process.env.ATLAS_CORE_URL || "http://localhost:4000",
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  },
};
