import { Dataset } from "../../engine/types.js";
import { roleAssignments, users } from "./users.js";

export const dataset: Dataset = [
  {
    client: "keycloak",
    action: "updateRealmSettings",
    dtoIn: {
      ssoSessionIdleTimeout: 28800,
      ssoSessionMaxLifespan: 28800,
      accessTokenLifespan: 1800,
      loginTheme: "atlas",
    },
    skipOnError: true,
  },

  ...users.map((user) => ({
    client: "keycloak",
    action: "createUser",
    dtoIn: user,
    skipOnError: true,
  })),

  ...roleAssignments.map((assignment) => ({
    client: "keycloak",
    action: "assignRoles",
    dtoIn: assignment,
    skipOnError: true,
  })),

  {
    client: "keycloak",
    action: "ensureClient",
    dtoIn: {
      clientId: "atlas-gui",
      name: "Atlas GUI",
      enabled: true,
      publicClient: true,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
      redirectUris: [
        "http://localhost:3000/*",
        "https://xaverric.cz/*",
      ],
      webOrigins: [
        "http://localhost:3000",
        "https://xaverric.cz",
      ],
      attributes: {
        "pkce.code.challenge.method": "S256",
        "post.logout.redirect.uris":
          "http://localhost:3000/*##https://xaverric.cz/*",
      },
      protocol: "openid-connect",
    },
    skipOnError: true,
  },

  {
    client: "keycloak",
    action: "ensureClient",
    dtoIn: {
      clientId: "atlas-mcp",
      name: "Atlas MCP Server",
      enabled: true,
      publicClient: true,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
      redirectUris: [
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://mcp.xaverric.cz/*",
      ],
      webOrigins: ["*"],
      attributes: {
        "pkce.code.challenge.method": "S256",
        "post.logout.redirect.uris": "+",
      },
      protocol: "openid-connect",
    },
    skipOnError: true,
  },

  {
    client: "minio",
    action: "createBucket",
    dtoIn: { bucket: "atlas-dms" },
    skipOnError: true,
  },
];
