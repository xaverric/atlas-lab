import { execute, printSummary } from "./engine/executor.js";
import { ClientMap } from "./engine/types.js";
import { keycloakClient } from "./clients/keycloak.js";
import { httpClient } from "./clients/http.js";
import { minioClient } from "./clients/minio.js";

const args = process.argv.slice(2);

function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const inventoryName = getArg("inventory", "localhost");
const datasetName = getArg("dataset", "atlas-dev");

const clients: ClientMap = {
  keycloak: keycloakClient,
  http: httpClient,
  minio: minioClient,
};

async function main() {
  console.log(`Atlas Init Data Loader`);
  console.log(`  Inventory: ${inventoryName}`);
  console.log(`  Dataset:   ${datasetName}`);

  const { inventory } = await import(`./inventories/${inventoryName}.js`);
  const { dataset } = await import(`./datasets/${datasetName}/index.js`);

  const results = await execute(inventory, dataset, clients);
  printSummary(results);
}

main().catch((err) => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
