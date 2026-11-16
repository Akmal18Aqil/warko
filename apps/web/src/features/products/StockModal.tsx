import { useState } from "react";
import { toast } from "sonner";
import type { MenuItem } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { adjustStock } from "../../state/catalog";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";

type StockMode = "set" | "add";

/** Largest stock figure (or change) the dialog accepts. */
const MAX_STOCK_QTY = 1_000_000;

/** Ready-stock control: set today's portions, restock, or stop tracking. */
export function StockModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const stock = item.stock ?? null;
  const tracked = stock !== null;
  const [mode, setMode] = useState<StockMode>(tracked ? "add" : "set");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const text = t.products.stock;

  const qty = Number.parseInt(value, 10);
  const valid = Number.isSafeInteger(qty) && (mode === "set" ? qty >= 0 : qty !== 0) && Math.abs(qty) <= MAX_STOCK_QTY;
  const preview = valid ? (mode === "set" ? qty : (stock ?? 0) + qty) : null;

  const run = async (nextMode: StockMode, nextQty: number | null, message: string) => {
    setSaving(true);
    try {
      await adjustStock(item, nextMode, nextQty);
      toast.success(message);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : text.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const modeClass = (active: boolean) =>
    cn(
      "min-h-9 rounded-xl border px-2 text-xs font-bold transition-colors disabled:opacity-40",
      active ? "border-accent-dark bg-accent text-white" : "border-border text-ink/60 hover:text-ink",
    );

  return (
    <Modal size="sm" onClose={onClose}>
      <ModalHeader title={text.title(item.name)} subtitle={stock !== null ? text.currentTracked(stock) : text.currentUntracked} />
      <ModalBody className="space-y-4">
        <p className="text-xs text-text-muted">{text.explain}</p>

        <div role="group" aria-label={text.modeLabel} className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!tracked}
            aria-pressed={mode === "add"}
            onClick={() => setMode("add")}
            className={modeClass(mode === "add")}
          >
            {text.modeAdd}
          </button>
          <button type="button" aria-pressed={mode === "set"} onClick={() => setMode("set")} className={modeClass(mode === "set")}>
            {text.modeSet}
          </button>
        </div>

        <Input
          type="number"
          inputMode="numeric"
          label={mode === "set" ? text.setLabel : text.addLabel}
          min={mode === "set" ? 0 : undefined}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="font-bold"
        />
        {preview !== null && (
          <p className={cn("text-xs font-semibold", preview < 0 ? "text-error" : "text-ink/70")}>
            {preview < 0 ? text.previewNegative : text.preview(preview)}
          </p>
        )}
      </ModalBody>
      <ModalFooter className="justify-between">
        {tracked ? (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => void run("set", null, text.untracked(item.name))}>
            {text.stopTracking}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!valid || (preview ?? 0) < 0}
            onClick={() => void run(mode, qty, text.updated(item.name))}
          >
            {t.common.save}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
