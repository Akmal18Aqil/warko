import { isRemoteDataSource } from "./api";
import { localSource } from "./local";
import { remoteSource } from "./remote";
import type { DataSource } from "./source";

export { isRemoteDataSource, RemoteDataError } from "./api";
export type { DataSource } from "./source";

/** The one data source for this session, chosen from the build mode. */
export const dataSource: DataSource = isRemoteDataSource ? remoteSource : localSource;
