import { ChefHat, ExternalLink, FlaskConical, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../../locales/id";
import { getNetworkHostInfo } from "../../services/networkHost";
import { subscribeTabPeers } from "../../services/tabPresence";
import type { ConnectedDevice } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { NetworkDevicesTab } from "./NetworkDevicesTab";

const OPEN_LINK =
  "inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-ink shadow-clay transition-colors hover:border-accent hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Network hub of the local demo. Demo data lives in each browser's own database, so phones cannot be
 * paired; only tabs of this browser stay in sync, and the hub says so instead of offering pairing QR codes.
 */
export function NetworkDemoHub({ onClose }: { onClose: () => void }) {
  const text = t.network.hub.demo;
  const { baseUrl } = getNetworkHostInfo();
  const [peers, setPeers] = useState<ConnectedDevice[]>([]);

  useEffect(() => subscribeTabPeers(setPeers), []);

  return (
    <>
      <ModalHeader
        title={text.title}
        subtitle={text.subtitle}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning text-ink">
            <FlaskConical size={20} aria-hidden="true" />
          </div>
        }
        actions={<Badge tone="warning">{text.badge}</Badge>}
      />

      <ModalBody className="space-y-5 bg-mineral/10">
        <div className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-xs text-warning-dark">
          <p className="flex items-center gap-1.5 font-bold">
            <TriangleAlert size={14} aria-hidden="true" /> {text.noteTitle}
          </p>
          <p>{text.noteBody}</p>
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">{text.openTitle}</h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <a href={`${baseUrl}/pelayan`} target="_blank" rel="noreferrer" className={OPEN_LINK}>
              <span className="flex items-center gap-2">
                <UtensilsCrossed size={16} aria-hidden="true" /> {text.openWaiter}
              </span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <a href={`${baseUrl}/dapur`} target="_blank" rel="noreferrer" className={OPEN_LINK}>
              <span className="flex items-center gap-2">
                <ChefHat size={16} aria-hidden="true" /> {text.openKitchen}
              </span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>

        <NetworkDevicesTab peers={peers} onRefresh={setPeers} />
      </ModalBody>

      <ModalFooter>
        <Button variant="ink" size="sm" onClick={onClose}>
          {t.network.hub.done}
        </Button>
      </ModalFooter>
    </>
  );
}
