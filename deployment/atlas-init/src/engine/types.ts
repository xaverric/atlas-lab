export interface Command {
  client: string;
  action: string;
  dtoIn: Record<string, any>;
  dtoOut?: Record<string, any>;
  contextKey?: string;
  skipOnError?: boolean;
}

export type Dataset = Command[];

export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  adminUser: string;
  adminPassword: string;
}

export interface ServiceConfig {
  baseUrl: string;
}

export interface MinioConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
}

export interface Inventory {
  keycloak: KeycloakConfig;
  atlasCore: ServiceConfig;
  minio?: MinioConfig;
}

export interface Client {
  execute(
    action: string,
    dtoIn: Record<string, any>,
    inventory: Inventory,
    context: Record<string, any>
  ): Promise<Record<string, any>>;
}

export type ClientMap = Record<string, Client>;

export interface CommandResult {
  command: Command;
  status: "success" | "skipped" | "error";
  dtoOut?: Record<string, any>;
  error?: string;
}
