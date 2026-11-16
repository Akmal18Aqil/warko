import { Laptop, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { t } from "../../locales/id";
import { getLocalTabId, getTabPeers } from "../../services/tabPresence";
import type { ConnectedDevice } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";

interface NetworkDevicesTabProps {
  peers: ConnectedDevice[];
  onRefresh: (peers: ConnectedDevice[]) => void;
}

function DeviceIcon({ role }: { role: ConnectedDevice["role"] }) {
  if (role === "kasir") return <Laptop size={18} aria-hidden="true" />;
  if (role === "dapur") return <Tablet size={18} aria-hidden="true" />;
  return <Smartphone size={18} aria-hidden="true" />;
}

export function NetworkDevicesTab({ peers, onRefresh }: NetworkDevicesTabProps) {
  const localId = getLocalTabId();
  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">{t.network.hub.devices.title}</h3>
          <p className="text-xs text-text-muted">{t.network.hub.devices.body}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onRefresh(getTabPeers());
            toast.success(t.network.hub.devices.refreshed);
          }}
          className="gap-1.5 text-xs font-semibold"
        >
          <RefreshCw size={13} aria-hidden="true" />
          {t.network.hub.devices.refresh}
        </Button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-clay">
        {peers.map((peer) => (
          <li key={peer.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-mineral text-text-muted">
                <DeviceIcon role={peer.role} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-ink">{peer.name}</p>
                  {peer.id === localId && <Badge tone="accent">{t.network.hub.devices.thisDevice}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  {t.network.hub.devices.role}{" "}
                  <span className="font-semibold uppercase text-ink">{t.network.hub.devices.roles[peer.role]}</span> ·{" "}
                  {t.network.hub.devices.active(Math.max(0, Math.round((now - peer.lastSeen) / 1000)))}
                </p>
              </div>
            </div>
            <Badge tone="success">{t.network.hub.devices.online}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
