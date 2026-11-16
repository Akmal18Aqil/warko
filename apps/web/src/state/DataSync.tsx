import { useEffect } from "react";
import { usePublicCustomer } from "../hooks/usePublicCustomer";
import { startDataSync } from "./sync";

/** Loads app data and keeps it fresh while mounted. Renders nothing. */
export function DataSync() {
  const publicCustomer = usePublicCustomer();
  useEffect(() => startDataSync(publicCustomer), [publicCustomer]);
  return null;
}
