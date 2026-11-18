import { createContext, useContext } from "react";
import type { AuthMethod, DeviceStatus } from "../data/authApi";

/**
 * What the sign-in gate exposes to the signed-in app in remote mode. Absent (`null`) in the demo build and on public
 * customer pages, where there is no server session.
 */
export interface RemoteSession {
  /** How the current session was opened; sensitive actions still ask for the account password either way. */
  authMethod: AuthMethod;
  /** Registration state of this browser as a PIN device. */
  device: DeviceStatus;
  /** Re-reads the device state after it was registered or revoked from Settings. */
  refreshDevice: () => Promise<void>;
  /** Ends the session. On a registered device the gate then shows the PIN screen ("kunci"); otherwise the password form. */
  signOut: () => Promise<void>;
  /** Replaces the session with `staffId`'s own PIN session on this registered device. Rejects with the server message. */
  signInWithPin: (staffId: string, pin: string) => Promise<void>;
}

export const RemoteSessionContext = createContext<RemoteSession | null>(null);

export function useRemoteSession(): RemoteSession | null {
  return useContext(RemoteSessionContext);
}
