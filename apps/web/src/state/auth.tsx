import type { StaffRole } from "@wakro/shared";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { t } from "../locales/id";
import { isDemoMode } from "./demo";
import { DEMO_STAFF } from "./demoStaff";
import { normalizeAvatarColor } from "./staffAvatar";

/**
 * Staff identity and role gating.
 *
 * Remote mode: the signed-in staff member comes from the server session and the API enforces every
 * permission; the route matrix below only decides which screens to show.
 * Local mode is demo-only: the staff list is always `DEMO_STAFF` (only the chosen member is remembered) and the
 * PINs are plaintext, so switching users is a convenience on one device, not access control. The local data
 * source is told who is acting and enforces the same role policy as the API.
 */

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
  pin: string;
  avatarColor: string;
  initials: string;
  title: string;
  description: string;
}

/** Roles with full access to every screen; they may confirm destructive actions such as deleting a category. */
export const FULL_ACCESS_ROLES: readonly StaffRole[] = ["admin", "kasir"];

interface AuthContextType {
  currentStaff: StaffUser;
  staffList: StaffUser[];
  /** True when the staff member comes from a server session (no PINs exist in the browser). */
  isRemote: boolean;
  isSwitchModalOpen: boolean;
  openSwitchModal: () => void;
  closeSwitchModal: () => void;
  switchStaffByPin: (pin: string, targetStaffId?: string) => { success: boolean; staff?: StaffUser; error?: string };
  switchStaffDirect: (staffId: string) => void;
  hasAccessTo: (path: string) => boolean;
  getAllowedDefaultRoute: (role: StaffRole) => string;
  /**
   * Confirms a sensitive action. Local mode: `pin` must belong to a staff member with one of `roles`.
   * Remote mode: there are no PINs in the browser, so the signed-in session's role decides (the API enforces it again).
   */
  verifyPin: (pin: string, roles: readonly StaffRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const withNormalizedAvatar = (staff: StaffUser): StaffUser => ({ ...staff, avatarColor: normalizeAvatarColor(staff.avatarColor) });

function getInitialCurrentStaff(list: StaffUser[]): StaffUser {
  try {
    const activeId = localStorage.getItem(STORAGE_KEYS.currentStaffId);
    const found = activeId ? list.find((s) => s.id === activeId) : undefined;
    if (found) return found;
  } catch (err) {
    console.warn("Staf aktif tersimpan tidak dapat dibaca:", err);
  }
  return list[0] ?? DEMO_STAFF[0];
}

function defaultRouteFor(role: StaffRole): string {
  switch (role) {
    case "pelayan":
      return "/pelayan";
    case "dapur":
      return "/dapur";
    case "manajer":
      return "/laporan";
    case "admin":
    case "kasir":
      return "/";
  }
}

/** Screens each restricted role may open; admin and kasir may open everything. */
const MANAGER_ROUTES = ["/laporan", "/produk", "/pesanan", "/laci-kas", "/pengaturan", "/meja"];

function roleAllows(role: StaffRole, path: string): boolean {
  if (path.startsWith("/order/")) return true;
  switch (role) {
    case "admin":
    case "kasir":
      return true;
    case "pelayan":
      return path === "/pelayan";
    case "dapur":
      return path === "/dapur";
    case "manajer":
      return MANAGER_ROUTES.includes(path);
  }
}

export function AuthProvider({ children, remoteStaff }: { children: ReactNode; remoteStaff?: StaffUser }) {
  const [staffList] = useState<StaffUser[]>(() =>
    remoteStaff ? [withNormalizedAvatar(remoteStaff)] : DEMO_STAFF.map(withNormalizedAvatar),
  );
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(() =>
    remoteStaff ? withNormalizedAvatar(remoteStaff) : getInitialCurrentStaff(staffList),
  );
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const isRemote = remoteStaff !== undefined;

  useEffect(() => {
    if (isRemote) return;
    try {
      localStorage.setItem(STORAGE_KEYS.currentStaffId, currentStaff.id);
    } catch (err) {
      console.warn("Staf aktif tidak dapat disimpan:", err);
    }
  }, [currentStaff.id, isRemote]);

  useEffect(() => {
    if (!isDemoMode) return;
    const { id, name, role } = currentStaff;
    // Dexie is only loaded in the local build; the data source module is already in the cache by now.
    void import("../data/local").then(({ setLocalActor }) => setLocalActor({ id, name, role }));
    return () => {
      void import("../data/local").then(({ setLocalActor }) => setLocalActor(null));
    };
  }, [currentStaff]);

  const openSwitchModal = useCallback(() => setIsSwitchModalOpen(true), []);
  const closeSwitchModal = useCallback(() => setIsSwitchModalOpen(false), []);

  const hasAccessTo = useCallback((path: string) => roleAllows(currentStaff.role, path), [currentStaff.role]);

  const verifyPin = useCallback(
    (pin: string, roles: readonly StaffRole[]): boolean => {
      if (isRemote) return roles.includes(currentStaff.role);
      return staffList.some((s) => roles.includes(s.role) && s.pin === pin);
    },
    [isRemote, currentStaff.role, staffList],
  );

  const enter = useCallback(
    (staff: StaffUser) => {
      setCurrentStaff(staff);
      setIsSwitchModalOpen(false);
      setLocation(defaultRouteFor(staff.role));
    },
    [setLocation],
  );

  const switchStaffByPin = useCallback(
    (pin: string, targetStaffId?: string) => {
      const matched = targetStaffId ? staffList.find((s) => s.id === targetStaffId && s.pin === pin) : staffList.find((s) => s.pin === pin);
      if (!matched) return { success: false, error: t.app.auth.wrongPin };
      enter(matched);
      toast.success(t.app.auth.loginSuccess(matched.name, matched.title));
      return { success: true, staff: matched };
    },
    [staffList, enter],
  );

  const switchStaffDirect = useCallback(
    (staffId: string) => {
      const found = staffList.find((s) => s.id === staffId);
      if (!found) return;
      enter(found);
      toast.info(t.app.auth.switchedTo(found.name, found.title));
    },
    [staffList, enter],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      currentStaff,
      staffList,
      isRemote,
      isSwitchModalOpen,
      openSwitchModal,
      closeSwitchModal,
      switchStaffByPin,
      switchStaffDirect,
      hasAccessTo,
      getAllowedDefaultRoute: defaultRouteFor,
      verifyPin,
    }),
    [
      currentStaff,
      staffList,
      isRemote,
      isSwitchModalOpen,
      openSwitchModal,
      closeSwitchModal,
      switchStaffByPin,
      switchStaffDirect,
      hasAccessTo,
      verifyPin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return context;
}
