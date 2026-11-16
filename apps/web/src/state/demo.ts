import { isRemoteDataSource } from "../data/api";
import { demoStorageKeys } from "../lib/storageKeys";
import { broadcastSync } from "../lib/syncBus";

/** True in the browser-only build, where all data is a demo stored in this browser. */
export const isDemoMode: boolean = !isRemoteDataSource;

/**
 * Throws away everything the demo stored (database and browser settings) and reloads, so the next load
 * reseeds the full demo. Other tabs of this browser reload too; they would otherwise keep a deleted database open.
 */
export async function resetDemoData(): Promise<void> {
  // Dexie is only loaded in the local build; keep it out of the remote bundle.
  const { db } = await import("../data/db");
  db.close();
  await db.delete();
  for (const key of demoStorageKeys()) localStorage.removeItem(key);
  broadcastSync({ type: "DEMO_RESET" });
  window.location.reload();
}
