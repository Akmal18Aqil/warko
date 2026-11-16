import { useStore } from "./store";
import { sessionStore } from "./stores";

export const useDataReady = () => useStore(sessionStore, (s) => s.ready);
export const useDataSourceError = () => useStore(sessionStore, (s) => s.dataSourceError);
