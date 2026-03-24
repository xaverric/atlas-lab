export const users = [
  {
    username: "xaverric",
    email: process.env.DEV_USER_EMAIL || "admin@xaverric.cz",
    firstName: process.env.DEV_USER_FIRST_NAME || "Admin",
    lastName: process.env.DEV_USER_LAST_NAME || "User",
    password: process.env.DEV_USER_PASSWORD || 'changeme',
  },
];

export const roleAssignments = [
  { username: "xaverric", roles: ["admin", "user"] }
];
