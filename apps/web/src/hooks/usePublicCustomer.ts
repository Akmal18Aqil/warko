import { useLocation } from "wouter";
import { isRemoteDataSource } from "../data/index";

const PUBLIC_ORDER_PATH = /^\/order(?:\/|$)/;

/** True on the signed-out customer self-order pages of a remote deployment. Follows SPA navigation. */
export function usePublicCustomer(): boolean {
  const [location] = useLocation();
  return isRemoteDataSource && PUBLIC_ORDER_PATH.test(location);
}
