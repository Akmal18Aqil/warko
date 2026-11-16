import { useState } from "react";
import { BookOpen, HelpCircle, Radio, Server, Smartphone, Zap } from "lucide-react";
import { t } from "../../locales/id";
import { getNetworkHostInfo } from "../../services/networkHost";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { SegmentedTabs, type SegmentedTab } from "../../ui/SegmentedTabs";
import { GuideSection, type GuideTab } from "./GuideSections";

interface LocalServerGuideModalProps {
  open: boolean;
  onClose: () => void;
  onOpenPairingHub?: () => void;
}

const TABS: readonly SegmentedTab<GuideTab>[] = [
  { id: "flow", label: t.network.guide.tabs.flow, icon: <Radio size={14} aria-hidden="true" /> },
  { id: "setup", label: t.network.guide.tabs.setup, icon: <Server size={14} aria-hidden="true" /> },
  { id: "waiter", label: t.network.guide.tabs.waiter, icon: <Smartphone size={14} aria-hidden="true" /> },
  { id: "offline", label: t.network.guide.tabs.offline, icon: <Zap size={14} aria-hidden="true" /> },
  { id: "troubleshoot", label: t.network.guide.tabs.troubleshoot, icon: <HelpCircle size={14} aria-hidden="true" /> },
];

export function LocalServerGuideModal({ open, onClose, onOpenPairingHub }: LocalServerGuideModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="lg">
      <LocalServerGuide onClose={onClose} onOpenPairingHub={onOpenPairingHub} />
    </Modal>
  );
}

/** Mounted only while the modal is open, so it reopens on the first tab. */
function LocalServerGuide({ onClose, onOpenPairingHub }: Omit<LocalServerGuideModalProps, "open">) {
  const [tab, setTab] = useState<GuideTab>("flow");
  const hostInfo = getNetworkHostInfo();
  const exampleAddress = `${hostInfo.isLoopback ? t.network.hub.ipExampleHostName : hostInfo.host}:${hostInfo.port}`;

  return (
    <>
      <ModalHeader
        title={t.network.guide.title}
        subtitle={t.network.guide.subtitle}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
            <BookOpen size={20} aria-hidden="true" />
          </div>
        }
      />

      <div className="shrink-0 overflow-x-auto px-6 pt-4">
        <SegmentedTabs label={t.network.guide.tabsLabel} tabs={TABS} value={tab} onChange={setTab} className="min-w-max" />
      </div>

      <ModalBody className="space-y-4 bg-mineral/10 text-xs text-ink">
        <GuideSection tab={tab} hostInfo={hostInfo} exampleAddress={exampleAddress} />
        {tab === "setup" && onOpenPairingHub && (
          <div className="flex justify-end">
            <Button size="sm" onClick={onOpenPairingHub} className="gap-2">
              <Radio size={14} aria-hidden="true" />
              {t.network.guide.openPairingNow}
            </Button>
          </div>
        )}
      </ModalBody>

      <ModalFooter className="justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Radio size={14} className="text-success-dark" aria-hidden="true" />
          <span>{t.network.guide.ready}</span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenPairingHub && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenPairingHub();
              }}
              className="text-xs"
            >
              {t.network.guide.openPairing}
            </Button>
          )}
          <Button variant="ink" size="sm" onClick={onClose}>
            {t.network.guide.close}
          </Button>
        </div>
      </ModalFooter>
    </>
  );
}
