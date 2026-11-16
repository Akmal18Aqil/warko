import { isRemoteDataSource } from "./api";
import type { DataSource } from "./source";

export { isRemoteDataSource, RemoteDataError } from "./api";
export type { DataSource } from "./source";

/** The one data source for this session, chosen from the build mode by `initDataSource()`. */
export let dataSource: DataSource;

/**
 * Must resolve before the app renders. The implementation is loaded by dynamic import because the
 * build mode decides it: a remote build never downloads Dexie, a local build never loads the HTTP client.
 */
export async function initDataSource(): Promise<void> {
  dataSource = isRemoteDataSource ? (await import("./remote")).remoteSource : (await import("./local")).localSource;
}
