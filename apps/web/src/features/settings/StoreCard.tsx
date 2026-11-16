import { Store } from "lucide-react";
import { t } from "../../locales/id";
import { STORE_TITLE } from "../../lib/storeProfile";
import { SettingsCard } from "./SettingsCard";

export function StoreCard() {
  return <SettingsCard icon={<Store size={19} aria-hidden="true" />} label={t.settings.store.label} value={STORE_TITLE} />;
}
