import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChefHat, Info, QrCode, Radio, Smartphone, TriangleAlert, Wifi } from "lucide-react";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { t } from "../../locales/id";
import { getNetworkHostInfo, getSavedServerIp, type NetworkHostInfo } from "../../services/networkHost";
import { subscribeTabPeers } from "../../services/tabPresence";
import type { ConnectedDevice } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { SegmentedTabs, type SegmentedTab } from "../../ui/SegmentedTabs";
import { AccessLinkTab } from "./AccessLinkTab";
import { NetworkDevicesTab } from "./NetworkDevicesTab";
import { NetworkTableTab } from "./NetworkTableTab";
import { RichText } from "./RichText";
import { ServerAddressBar } from "./ServerAddressBar";
import { useCopyLink } from "./useCopyLink";
import { useQrDataUrl } from "./useQrDataUrl";

interface NetworkHubModalProps {
  open: boolean;
  onClose: () => void;
}

type HubTab = "pelayan" | "dapur" | "meja" | "perangkat";

/** Base URL other devices should use: the manually entered server address, else the detected one. */
function resolveBaseUrl(savedIp: string, info: NetworkHostInfo): string {
  const address = savedIp.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!address) return info.baseUrl;
  return `${info.protocol}//${address.includes(":") ? address : `${address}:${info.port}`}`;
}

export function NetworkHubModal({ open, onClose }: NetworkHubModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="lg">
      <NetworkHub onClose={onClose} />
    </Modal>
  );
}

/** Mounted only while the modal is open, so edits and the active tab reset each time. */
function NetworkHub({ onClose }: { onClose: () => void }) {
  const hostInfo = getNetworkHostInfo();
  const [tab, setTab] = useState<HubTab>("pelayan");
  const [savedIp, setSavedIp] = useState(getSavedServerIp);
  const [draftIp, setDraftIp] = useState("");
  const [editingIp, setEditingIp] = useState(false);
  const [peers, setPeers] = useState<ConnectedDevice[]>([]);
  const { copiedUrl, copy } = useCopyLink();

  useEffect(() => subscribeTabPeers(setPeers), []);

  const baseUrl = resolveBaseUrl(savedIp, hostInfo);
  const waiterUrl = `${baseUrl}/pelayan`;
  const kitchenUrl = `${baseUrl}/dapur`;
  const waiterQr = useQrDataUrl(tab === "pelayan" ? waiterUrl : null);
  const kitchenQr = useQrDataUrl(tab === "dapur" ? kitchenUrl : null);

  const exampleAddress = `${hostInfo.isLoopback ? t.network.hub.ipExampleHostName : hostInfo.host}:${hostInfo.port}`;

  const startEditing = () => {
    setDraftIp(savedIp);
    setEditingIp(true);
  };

  const saveIp = () => {
    const clean = draftIp.trim();
    try {
      if (clean) localStorage.setItem(STORAGE_KEYS.customServerIp, clean);
      else localStorage.removeItem(STORAGE_KEYS.customServerIp);
    } catch (error) {
      console.error("Alamat IP server gagal disimpan:", error);
      toast.error(t.common.unknownError);
      return;
    }
    setSavedIp(clean);
    setEditingIp(false);
    if (clean) toast.success(t.network.hub.ipSaved);
    else toast.info(t.network.hub.ipAuto);
  };

  const tabs: readonly SegmentedTab<HubTab>[] = [
    { id: "pelayan", label: t.network.hub.tabs.waiter, icon: <Smartphone size={14} aria-hidden="true" /> },
    { id: "dapur", label: t.network.hub.tabs.kitchen, icon: <ChefHat size={14} aria-hidden="true" /> },
    { id: "meja", label: t.network.hub.tabs.table, icon: <QrCode size={14} aria-hidden="true" /> },
    { id: "perangkat", label: t.network.hub.tabs.devices(peers.length), icon: <Wifi size={14} aria-hidden="true" /> },
  ];

  return (
    <>
      <ModalHeader
        title={t.network.hub.title}
        subtitle={t.network.hub.subtitle}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
            <Radio size={20} aria-hidden="true" />
          </div>
        }
        actions={
          <Badge tone="success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-dark" aria-hidden="true" />
            {t.network.hub.serverActive}
          </Badge>
        }
      />

      <ServerAddressBar
        baseUrl={baseUrl}
        peerCount={peers.length}
        editing={editingIp}
        draft={draftIp}
        placeholder={t.network.hub.ipExample(exampleAddress)}
        onDraftChange={setDraftIp}
        onStartEdit={startEditing}
        onCancel={() => setEditingIp(false)}
        onSave={saveIp}
      />

      {hostInfo.isLoopback && !savedIp && (
        <p role="alert" className="flex items-start gap-2 border-b border-warning/40 bg-warning/10 px-6 py-2.5 text-xs text-warning-dark">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t.network.hub.loopbackWarning}
        </p>
      )}

      <div className="shrink-0 px-6 pt-4">
        <SegmentedTabs label={t.network.hub.tabsLabel} tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <ModalBody className="bg-mineral/10">
        {tab === "pelayan" && (
          <AccessLinkTab
            qr={waiterQr}
            qrAlt={t.network.hub.waiter.qrAlt}
            qrTitle={t.network.hub.waiter.qrTitle}
            qrBody={t.network.hub.waiter.qrBody}
            linkTitle={t.network.hub.waiter.linkTitle}
            url={waiterUrl}
            copied={copiedUrl === waiterUrl}
            onCopy={() => void copy(waiterUrl, t.network.hub.waiter.copyLabel)}
            note={{
              tone: "success",
              icon: <Wifi size={14} aria-hidden="true" />,
              title: t.network.hub.waiter.noteTitle,
              children: (
                <ol className="list-inside list-decimal space-y-1">
                  {t.network.hub.waiter.steps.map((step) => (
                    <li key={step}>
                      <RichText text={step} />
                    </li>
                  ))}
                </ol>
              ),
            }}
          />
        )}

        {tab === "dapur" && (
          <AccessLinkTab
            qr={kitchenQr}
            qrAlt={t.network.hub.kitchen.qrAlt}
            qrTitle={t.network.hub.kitchen.qrTitle}
            qrBody={t.network.hub.kitchen.qrBody}
            linkTitle={t.network.hub.kitchen.linkTitle}
            url={kitchenUrl}
            copied={copiedUrl === kitchenUrl}
            onCopy={() => void copy(kitchenUrl, t.network.hub.kitchen.copyLabel)}
            note={{
              tone: "warning",
              icon: <ChefHat size={14} aria-hidden="true" />,
              title: t.network.hub.kitchen.noteTitle,
              children: <p>{t.network.hub.kitchen.noteBody}</p>,
            }}
          />
        )}

        {tab === "meja" && (
          <NetworkTableTab baseUrl={baseUrl} copiedUrl={copiedUrl} onCopy={(url, label) => void copy(url, label)} />
        )}

        {tab === "perangkat" && <NetworkDevicesTab peers={peers} onRefresh={setPeers} />}
      </ModalBody>

      <ModalFooter className="justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Info size={14} className="text-text-light" aria-hidden="true" />
          <span>{t.network.hub.footerNote}</span>
        </div>
        <Button variant="ink" size="sm" onClick={onClose}>
          {t.network.hub.done}
        </Button>
      </ModalFooter>
    </>
  );
}
