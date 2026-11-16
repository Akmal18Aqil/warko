import { broadcastSync, subscribeSync } from "../lib/syncBus";
import { STORAGE_KEYS } from "../lib/storageKeys";
import type { ConnectedDevice } from "../types/domain";

/**
 * Presence of app tabs open in this browser profile (BroadcastChannel). It does not see other
 * devices on the network. Nothing runs until `startTabPresence` is called.
 */

const HEARTBEAT_MS = 8000;
const STALE_AFTER_MS = 30000;

const peers = new Map<string, ConnectedDevice>();
const peerListeners = new Set<(peers: ConnectedDevice[]) => void>();
let activeUsers = 0;
let heartbeatTimer: number | undefined;
let unsubscribeBus: (() => void) | undefined;

/** Per-tab id: sessionStorage is not shared between tabs, unlike localStorage. */
export function getLocalTabId(): string {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEYS.deviceInfo);
    if (saved) return saved;
    const created = `tab_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
    sessionStorage.setItem(STORAGE_KEYS.deviceInfo, created);
    return created;
  } catch {
    return "tab_unknown";
  }
}

function localDevice(): ConnectedDevice {
  const path = window.location.pathname;
  const lastSeen = Date.now();
  const id = getLocalTabId();
  if (path.startsWith("/pelayan")) return { id, name: "Tab Pelayan", role: "pelayan", lastSeen };
  if (path.startsWith("/dapur")) return { id, name: "Tab Layar Dapur (KDS)", role: "dapur", lastSeen };
  if (path.startsWith("/order")) return { id, name: "Tab Self-Order", role: "meja", lastSeen };
  return { id, name: "Tab Kasir", role: "kasir", lastSeen };
}

export function getTabPeers(): ConnectedDevice[] {
  const local = localDevice();
  peers.set(local.id, local);
  return [...peers.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}

function notify(): void {
  const list = getTabPeers();
  for (const cb of peerListeners) cb(list);
}

function announce(): void {
  broadcastSync({ type: "DEVICE_HEARTBEAT", payload: localDevice() });
}

function dropStalePeers(): void {
  const now = Date.now();
  const localId = getLocalTabId();
  let changed = false;
  for (const [id, peer] of peers) {
    if (id !== localId && now - peer.lastSeen > STALE_AFTER_MS) {
      peers.delete(id);
      changed = true;
    }
  }
  if (changed) notify();
}

/** Starts announcing this tab; returns a function that stops it. Calls nest. */
export function startTabPresence(): () => void {
  activeUsers += 1;
  if (activeUsers === 1) {
    unsubscribeBus = subscribeSync((msg) => {
      if (msg.type !== "DEVICE_HEARTBEAT") return;
      const known = peers.has(msg.payload.id);
      peers.set(msg.payload.id, { ...msg.payload, lastSeen: Date.now() });
      // A newcomer does not know the existing tabs yet: answer once so it sees us immediately.
      if (!known) announce();
      notify();
    });
    heartbeatTimer = window.setInterval(() => {
      announce();
      dropStalePeers();
    }, HEARTBEAT_MS);
    announce();
  }
  return () => {
    activeUsers -= 1;
    if (activeUsers > 0) return;
    unsubscribeBus?.();
    unsubscribeBus = undefined;
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
    peers.clear();
  };
}

export function subscribeTabPeers(cb: (peers: ConnectedDevice[]) => void): () => void {
  peerListeners.add(cb);
  cb(getTabPeers());
  return () => {
    peerListeners.delete(cb);
  };
}
