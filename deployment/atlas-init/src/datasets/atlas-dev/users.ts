export const users = [
  {
    username: "xaverric",
    email: "jilek.daniel@gmail.com",
    firstName: "Daniel",
    lastName: "Jílek",
    password: process.env.DEV_USER_PASSWORD || 'changeme',
  },
];

export const roleAssignments = [
  { username: "xaverric", roles: ["admin", "user"] }
];
