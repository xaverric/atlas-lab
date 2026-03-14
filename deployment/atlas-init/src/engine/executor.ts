import { ClientMap, Command, CommandResult, Dataset, Inventory } from "./types.js";

export async function execute(
  inventory: Inventory,
  dataset: Dataset,
  clients: ClientMap
): Promise<CommandResult[]> {
  const context: Record<string, any> = {};
  const results: CommandResult[] = [];

  console.log(`\nExecuting ${dataset.length} commands...\n`);

  for (let i = 0; i < dataset.length; i++) {
    const command = dataset[i];
    const label = `[${i + 1}/${dataset.length}] ${command.client}.${command.action}`;

    try {
      const dtoOut = await clients[command.client].execute(
        command.action,
        command.dtoIn,
        inventory,
        context
      );

      command.dtoOut = dtoOut;

      if (command.contextKey) {
        context[command.contextKey] = dtoOut;
      }

      console.log(`  OK  ${label}`);
      results.push({ command, status: "success", dtoOut });
    } catch (err: any) {
      const message = err?.message ?? String(err);

      if (command.skipOnError) {
        console.log(`  SKIP ${label} — ${message}`);
        results.push({ command, status: "skipped", error: message });
      } else {
        console.error(`  ERR  ${label} — ${message}`);
        results.push({ command, status: "error", error: message });
        throw new Error(`Command failed: ${label} — ${message}`);
      }
    }
  }

  return results;
}

export function printSummary(results: CommandResult[]) {
  const ok = results.filter((r) => r.status === "success").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  console.log(`\n--- Summary ---`);
  console.log(`  Total: ${results.length}  OK: ${ok}  Skipped: ${skipped}  Errors: ${errors}`);
}
