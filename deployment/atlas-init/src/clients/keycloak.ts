import { Client, Inventory } from "../engine/types.js";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAdminToken(inventory: Inventory): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const { baseUrl, realm, adminUser, adminPassword } = inventory.keycloak;
  const url = `${baseUrl}/realms/master/protocol/openid-connect/token`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: adminUser,
      password: adminPassword,
    }),
  });

  if (!res.ok) {
    throw new Error(`Keycloak admin auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 30) * 1000,
  };

  return tokenCache.accessToken;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function adminUrl(inventory: Inventory, path: string) {
  return `${inventory.keycloak.baseUrl}/admin/realms/${inventory.keycloak.realm}${path}`;
}

async function createUser(
  dtoIn: Record<string, any>,
  inventory: Inventory
): Promise<Record<string, any>> {
  const token = await getAdminToken(inventory);
  const { username, email, firstName, lastName, password, enabled = true } = dtoIn;

  const res = await fetch(adminUrl(inventory, "/users"), {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      username,
      email,
      firstName,
      lastName,
      enabled,
      credentials: [{ type: "password", value: password, temporary: false }],
    }),
  });

  if (res.status === 409) {
    return { username, status: "already_exists" };
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createUser failed (${res.status}): ${body}`);
  }

  const location = res.headers.get("location") ?? "";
  const userId = location.split("/").pop();

  return { username, userId, status: "created" };
}

async function getUserId(
  username: string,
  inventory: Inventory
): Promise<string> {
  const token = await getAdminToken(inventory);
  const res = await fetch(adminUrl(inventory, `/users?username=${encodeURIComponent(username)}&exact=true`), {
    headers: headers(token),
  });

  if (!res.ok) throw new Error(`getUserId failed: ${res.status}`);

  const users = await res.json();
  if (!users.length) throw new Error(`User "${username}" not found`);

  return users[0].id;
}

async function assignRoles(
  dtoIn: Record<string, any>,
  inventory: Inventory
): Promise<Record<string, any>> {
  const token = await getAdminToken(inventory);
  const { username, roles } = dtoIn;

  const userId = await getUserId(username, inventory);

  const availableRes = await fetch(adminUrl(inventory, `/roles`), {
    headers: headers(token),
  });
  if (!availableRes.ok) throw new Error(`Failed to list roles: ${availableRes.status}`);

  const allRoles: any[] = await availableRes.json();
  const rolesToAssign = allRoles.filter((r: any) => roles.includes(r.name));

  if (!rolesToAssign.length) {
    return { username, status: "no_matching_roles" };
  }

  const res = await fetch(adminUrl(inventory, `/users/${userId}/role-mappings/realm`), {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(rolesToAssign),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`assignRoles failed (${res.status}): ${body}`);
  }

  return { username, roles, status: "assigned" };
}

async function createClient(
  dtoIn: Record<string, any>,
  inventory: Inventory
): Promise<Record<string, any>> {
  const token = await getAdminToken(inventory);

  const res = await fetch(adminUrl(inventory, "/clients"), {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(dtoIn),
  });

  if (res.status === 409) {
    return { clientId: dtoIn.clientId, status: "already_exists" };
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createClient failed (${res.status}): ${body}`);
  }

  return { clientId: dtoIn.clientId, status: "created" };
}

async function updateRealmSettings(
  dtoIn: Record<string, any>,
  inventory: Inventory
): Promise<Record<string, any>> {
  const token = await getAdminToken(inventory);
  const url = `${inventory.keycloak.baseUrl}/admin/realms/${inventory.keycloak.realm}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(dtoIn),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`updateRealmSettings failed (${res.status}): ${body}`);
  }

  return { status: "updated", settings: Object.keys(dtoIn) };
}

const actions: Record<string, (dtoIn: Record<string, any>, inventory: Inventory) => Promise<Record<string, any>>> = {
  createUser,
  assignRoles,
  createClient,
  updateRealmSettings,
};

export const keycloakClient: Client = {
  async execute(action, dtoIn, inventory) {
    const fn = actions[action];
    if (!fn) throw new Error(`Keycloak: unknown action "${action}"`);
    return fn(dtoIn, inventory);
  },
};
