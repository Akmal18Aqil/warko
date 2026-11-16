import type { PricingSettings } from "@wakro/shared";
import { dataSource } from "../data/index";
import { broadcastSync } from "../lib/syncBus";
import { pricingStore } from "./stores";
import { useStore } from "./store";

export const usePricing = () => useStore(pricingStore, (s) => s.pricing);

/** Persists the tax / service-charge settings (server in remote mode, browser storage locally). */
export async function savePricing(pricing: PricingSettings): Promise<void> {
  pricingStore.set({ pricing: await dataSource.savePricing(pricing) });
  broadcastSync({ type: "PRICING_UPDATED" });
}

/** Re-reads the pricing after another tab changed it (read-only: never broadcasts). */
export async function reloadPricing(): Promise<void> {
  pricingStore.set({ pricing: await dataSource.loadPricing() });
}
