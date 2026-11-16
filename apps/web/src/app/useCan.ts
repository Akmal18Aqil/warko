import type { StaffRole } from "@wakro/shared";
import { useAuth } from "../state/auth";

/** Whether the acting staff member holds one of `roles`; use the shared policy lists so the UI mirrors the API. */
export function useCan(roles: readonly StaffRole[]): boolean {
  const { currentStaff } = useAuth();
  return roles.includes(currentStaff.role);
}
