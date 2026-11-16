import { STORAGE_KEYS } from "../lib/storageKeys";

export interface NetworkHostInfo {
  host: string;
  port: string;
  protocol: string;
  baseUrl: string;
  /** Host is on a private LAN range, so phones on the same Wi-Fi can reach it. */
  isLocalServer: boolean;
  /** Served from localhost: other devices cannot open this address; set the LAN IP in the network settings. */
  isLoopback: boolean;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** RFC 1918 private ranges: 10/8, 172.16/12, 192.168/16. */
function isPrivateLanHost(host: string): boolean {
  if (host.startsWith("192.168.") || host.startsWith("10.")) return true;
  const match = /^172\.(\d{1,3})\./.exec(host);
  return match !== null && Number(match[1]) >= 16 && Number(match[1]) <= 31;
}

export function getSavedServerIp(): string {
  return localStorage.getItem(STORAGE_KEYS.customServerIp)?.trim() ?? "";
}

/**
 * Address other devices should use to reach this app. On localhost the saved LAN IP (if any)
 * replaces the host; otherwise the page's own origin is used.
 */
export function getNetworkHostInfo(): NetworkHostInfo {
  const { hostname, port: locationPort, protocol } = window.location;
  const port = locationPort || (protocol === "https:" ? "443" : "80");
  const isLoopback = isLoopbackHost(hostname);
  const savedIp = getSavedServerIp();
  const host = isLoopback && savedIp ? savedIp.replace(/^https?:\/\//, "").split(":")[0] : hostname;
  const baseUrl = `${protocol}//${host}${locationPort ? `:${locationPort}` : ""}`;
  return {
    host,
    port,
    protocol,
    baseUrl,
    isLocalServer: isLoopbackHost(host) || isPrivateLanHost(host),
    isLoopback: isLoopback && !savedIp,
  };
}
