import { Client, Inventory, ServiceConfig } from "../engine/types.js";

function resolveBaseUrl(
  inventory: Inventory,
  service?: string
): string {
  if (!service) return inventory.atlasCore.baseUrl;

  const config = (inventory as Record<string, any>)[service] as ServiceConfig | undefined;
  if (!config?.baseUrl) throw new Error(`HTTP: unknown service "${service}"`);
  return config.baseUrl;
}

export const httpClient: Client = {
  async execute(action, dtoIn, inventory) {
    if (action !== "request") {
      throw new Error(`HTTP: unknown action "${action}"`);
    }

    const { method = "GET", path, body, headers: customHeaders, service } = dtoIn;
    const baseUrl = resolveBaseUrl(inventory, service);
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...customHeaders,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const contentType = res.headers.get("content-type") ?? "";
    const responseBody = contentType.includes("json") ? await res.json() : await res.text();

    if (!res.ok) {
      throw new Error(`HTTP ${method} ${path} failed (${res.status}): ${JSON.stringify(responseBody)}`);
    }

    return { status: res.status, body: responseBody };
  },
};
