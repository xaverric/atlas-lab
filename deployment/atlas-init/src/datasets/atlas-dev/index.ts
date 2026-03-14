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
    client: "minio",
    action: "createBucket",
    dtoIn: { bucket: "atlas-dms" },
    skipOnError: true,
  },
];
