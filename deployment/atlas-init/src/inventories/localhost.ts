import { Inventory } from "../engine/types.js";

export const inventory: Inventory = {
  keycloak: {
    baseUrl: "http://localhost:8080",
    realm: "atlas",
    adminUser: "admin",
    adminPassword: "admin",
  },
  atlasCore: {
    baseUrl: "http://localhost:4000",
  },
  minio: {
    endpoint: "http://localhost:9000",
    accessKey: "minioadmin",
    secretKey: "minioadmin",
  },
};
