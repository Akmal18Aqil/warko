import type { KitchenStatus } from "@wakro/shared";
import type { ConnectedDevice, OrderRow, ShiftRecord } from "../types/domain";
import { STORAGE_KEYS, SYNC_CHANNEL_NAME } from "./storageKeys";

/**
 * Same-browser sync between tabs (BroadcastChannel, with a `storage` event fallback). It tells other
 * tabs to reload a slice of state after this tab changed it; it never crosses devices. Cross-device
 * freshness comes from the data source (`watch`).
 */
export type SyncEvent =
  | { type: "ORDER_CREATED"; payload: { order: OrderRow } }
  | { type: "ORDER_STATUS_CHANGED"; payload: { no: number; kitchenStatus?: KitchenStatus } }
  | { type: "TABLE_UPDATED" }
  | { type: "PRODUCTS_UPDATED" }
  | { type: "CATEGORIES_UPDATED" }
  | { type: "SHIFT_CHANGED"; payload: { shift: ShiftRecord } }
  | { type: "CASH_MOVEMENTS_CHANGED" }
  | { type: "PRICING_UPDATED" }
  /** A backup was imported: every slice may have changed. */
  | { type: "DATA_IMPORTED" }
  /** The demo database was reset: reload the page. */
  | { type: "DEMO_RESET" }
  | { type: "DEVICE_HEARTBEAT"; payload: ConnectedDevice }
  /** Remote mode: this tab signed in, switched user or signed out; the session cookie is shared, so other tabs re-read it. */
  | { type: "AUTH_CHANGED" };

export type SyncMessage = SyncEvent & { senderId: string; timestamp: number };

type Listener = (msg: SyncMessage) => void;

const senderId = `node_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
const listeners = new Set<Listener>();

function dispatch(msg: SyncMessage): void {
  if (msg.senderId === senderId) return;
  for (const fn of listeners) {
    try {
      fn(msg);
    } catch (err) {
      console.error("Error in sync listener:", err);
    }
  }
}

function openChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => dispatch(event.data);
    return channel;
  } catch (err) {
    console.warn("BroadcastChannel initialization failed:", err);
    return null;
  }
}

const channel = openChannel();

if (!channel && typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEYS.syncEvent || !e.newValue) return;
    try {
      dispatch(JSON.parse(e.newValue) as SyncMessage);
    } catch {
      // Malformed message from another tab: ignore.
    }
  });
}

export function broadcastSync(event: SyncEvent): void {
  const message: SyncMessage = { ...event, senderId, timestamp: Date.now() };
  if (channel) {
    try {
      channel.postMessage(message);
    } catch (err) {
      console.warn("Failed to post message on BroadcastChannel:", err);
    }
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.syncEvent, JSON.stringify(message));
  } catch {
    // Storage full or unavailable: other tabs catch up on their next reload.
  }
}

export function subscribeSync(callback: Listener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
