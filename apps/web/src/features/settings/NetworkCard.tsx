import { useState } from "react";
import { BookOpen, Radio, Smartphone } from "lucide-react";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { getNetworkHostInfo } from "../../services/networkHost";
import { LocalServerGuideModal } from "../network/LocalServerGuideModal";
import { NetworkHubModal } from "../network/NetworkHubModal";
import { SettingsCard } from "./SettingsCard";

export function NetworkCard() {
  const [hubOpen, setHubOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <>
      <SettingsCard
        icon={<Radio size={19} aria-hidden="true" />}
        label={t.settings.network.label}
        value={getNetworkHostInfo().baseUrl}
        note={t.settings.network.note}
        wide
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setGuideOpen(true)}>
            <BookOpen size={15} aria-hidden="true" />
            {t.settings.network.guide}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHubOpen(true)}>
            <Smartphone size={15} aria-hidden="true" />
            {t.settings.network.pairing}
          </Button>
        </div>
      </SettingsCard>
      <NetworkHubModal open={hubOpen} onClose={() => setHubOpen(false)} />
      <LocalServerGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} onOpenPairingHub={() => setHubOpen(true)} />
    </>
  );
}
