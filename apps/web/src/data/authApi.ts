import type { StaffRole } from "@wakro/shared";
import { jsonBody, request } from "./api";

/** Server-side sign-in, device registration and PIN endpoints (remote mode only). */

export const PIN_LENGTH = 6;
export const PIN_PATTERN = /^\d{6}$/;
/** Minimum and maximum account password length, matching the API. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 256;
export const DEVICE_NAME_MAX_LENGTH = 80;

export type AuthMethod = "password" | "pin";

export type SessionStaff = {
  id: string;
  name: string;
  role: StaffRole;
  title: string;
  description: string;
  avatarColor: string;
  initials: string;
  /** Absent on sessions created before PIN sign-in existed: those are password sessions. */
  authMethod?: AuthMethod;
  hasPin?: boolean;
};

export type DeviceStaff = Omit<SessionStaff, "authMethod" | "hasPin">;

export type DeviceStatus = { registered: false } | { registered: true; id: string; name: string; staff: DeviceStaff[] };

export type RegisteredDevice = {
  id: string;
  name: string;
  createdAt: string;
  createdByName: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  /** True for the browser that sent the request. */
  current: boolean;
};

export const fetchSession = () => request<SessionStaff>("/auth/session");

export const fetchDeviceStatus = () => request<DeviceStatus>("/auth/device");

export const loginWithPassword = (username: string, password: string) =>
  request<true>("/auth/login", { method: "POST", ...jsonBody({ username, password }) });

export const loginWithPin = (staffId: string, pin: string) =>
  request<true>("/auth/pin-login", { method: "POST", ...jsonBody({ staffId, pin }) });

export const logout = () => request<true>("/auth/logout", { method: "POST" });

export const listDevices = () => request<RegisteredDevice[]>("/auth/devices");

export const registerThisDevice = (name: string, password: string) =>
  request<{ id: string; name: string }>("/auth/devices", { method: "POST", ...jsonBody({ name, password }) });

export const revokeDevice = (id: string, password: string) =>
  request<true>(`/auth/devices/${encodeURIComponent(id)}/revoke`, { method: "POST", ...jsonBody({ password }) });

/**
 * Sets or resets a staff member's PIN; `null` removes it. The acting admin's password is always required.
 * All of that member's sessions end; `selfRevoked` is true when that includes the acting admin's own.
 */
export const setStaffPin = (staffId: string, pin: string | null, password: string) =>
  request<{ selfRevoked: boolean }>(`/staff/${encodeURIComponent(staffId)}/pin`, { method: "PUT", ...jsonBody({ pin, password }) });
