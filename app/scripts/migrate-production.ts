import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { closeDbExec, withMigrationRuntime } from "@agent-native/core/db";
import { loadEnv } from "@agent-native/core/scripts";
import {
  runAppReleaseMigrations,
  runFrameworkReleaseMigrations,
} from "@agent-native/core/server";

loadEnv();

async function main(): Promise<void> {
  await withMigrationRuntime(async () => {
    console.log("[release] Starting framework migrations");
    await runFrameworkReleaseMigrations(null);
    console.log("[release] Starting app release migrations");
    await runAppReleaseMigrations();
    console.log("[release] Release migrations complete");
  });
}

// Guard: closeDbExec() below tears down the shared database pool, so this
// script must run only as its own process (`pnpm migrate:production`). The
// framework's action auto-discovery would otherwise mount it as a live route
// and running the teardown in-process breaks every other request with "Cannot
// use a pool after calling end on the pool." Throw instead of tearing down a
// pool this process does not own.
function isProcessEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return (
      pathToFileURL(realpathSync(entry)).href ===
      pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href
    );
  } catch {
    // coercion-ok: an unresolvable entry path is not this script, so the guard below throws.
    return false;
  }
}

if (!isProcessEntrypoint()) {
  throw new Error(
    "scripts/migrate-production.ts must run as its own process " +
      "(pnpm migrate:production); it closes the shared database pool when it " +
      "finishes, so importing or invoking it in-process — e.g. via an " +
      "auto-discovered action route — would break every other request.",
  );
}

// This is a standalone release process. Framework imports may retain timers
// or sockets even after all SQL has completed. Do not let those handles hold
// the build open, and never report a timed-out migration as successful.
let phase = "release migrations";
const deadline = setTimeout(() => {
  console.error(`[release] Timed out during ${phase}; deployment blocked`);
  process.exit(1);
}, 180_000);

let exitCode = 0;
try {
  await main();
} catch {
  // Driver errors can contain connection strings or SQL with private data.
  console.error("[release] Release migrations failed; deployment blocked");
  exitCode = 1;
} finally {
  phase = "database cleanup";
  console.log("[release] Closing database connections");
  const cleanupDeadline = setTimeout(() => {
    console.error("[release] Database cleanup exceeded 10 seconds; deployment blocked");
    process.exit(1);
  }, 10_000);
  try {
    await closeDbExec();
  } catch {
    console.error("[release] Database cleanup failed; deployment blocked");
    exitCode = 1;
  } finally {
    clearTimeout(cleanupDeadline);
    clearTimeout(deadline);
  }
}
console.log(`[release] Migration process finished with status ${exitCode}`);
process.exit(exitCode);
