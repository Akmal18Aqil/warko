import { Check, Edit3, MessageSquarePlus, Minus, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { useState } from "react";
import { formatIDR, type MenuItem } from "../../data/menu";
import { cn } from "../../lib/cn";
import { t } from "../../locales/id";
import { decreaseItem, increaseItem, removeItem, setItemNote, useCart } from "../../state/cart";
import { useProducts } from "../../state/catalog";
import type { CartLine } from "../../types/domain";
import { Empty } from "../../ui/Empty";
import { FoodImage } from "../../ui/FoodImage";
import { Input } from "../../ui/Input";
import { QtyButton } from "./OrderTypeSelector";

/**
 * The cart lines (or the empty state). In the side rail the list scrolls on its own between the order
 * header and the summary; in the sheet (`inSheet`) the whole sheet scrolls, which leaves far more room.
 */
export function CartLines({ inSheet = false }: { inSheet?: boolean }) {
  const { lines } = useCart();
  const products = useProducts();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  if (lines.length === 0) {
    return (
      <Empty
        className="bg-mineral/20"
        icon={<ReceiptText size={24} aria-hidden="true" />}
        title={t.pos.cart.emptyTitle}
        subtitle={t.pos.cart.emptyBody}
      />
    );
  }

  return (
    <ul
      className={cn(
        "space-y-2 bg-mineral/20 px-3.5 py-3",
        inSheet ? "flex-none" : "min-h-0 flex-1 overflow-y-auto overscroll-contain min-[1200px]:min-h-[230px]",
      )}
    >
      {lines.map((line) => {
        const item = products.find((p) => p.id === line.itemId);
        if (!item) return null;
        return (
          <CartLineItem
            key={line.itemId}
            line={line}
            item={item}
            editingNote={editingNoteId === line.itemId}
            onEditNote={() => setEditingNoteId(line.itemId)}
            onCloseNote={() => setEditingNoteId(null)}
          />
        );
      })}
    </ul>
  );
}

function CartLineItem({
  line,
  item,
  editingNote,
  onEditNote,
  onCloseNote,
}: {
  line: CartLine;
  item: MenuItem;
  editingNote: boolean;
  onEditNote: () => void;
  onCloseNote: () => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-2.5 shadow-clay transition-colors hover:border-border-hover">
      <div className="flex items-start gap-2.5">
        <FoodImage item={item} className="hidden h-12 w-12 shrink-0 rounded-lg border border-border object-cover min-[1200px]:block" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <p className="truncate text-sm font-bold leading-snug text-ink min-[1200px]:text-xs">{item.name}</p>
            <p className="shrink-0 font-display text-sm font-bold tracking-tight text-ink min-[1200px]:text-xs">
              {formatIDR(item.price * line.qty)}
            </p>
          </div>
          <p className="mt-0.5 text-xs2 text-text-muted">{t.pos.cart.unitPrice(formatIDR(item.price))}</p>

          <div className="mt-2 flex items-center justify-between gap-1.5">
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-mineral/60 p-0.5">
              <QtyButton label={t.pos.cart.qtyDecrease(item.name)} onClick={() => decreaseItem(line.itemId)}>
                <Minus size={11} strokeWidth={2.6} aria-hidden="true" />
              </QtyButton>
              <span
                aria-live="polite"
                className="min-w-8 text-center font-display text-sm font-bold text-ink min-[1200px]:min-w-6 min-[1200px]:text-xs"
              >
                {line.qty}
              </span>
              <QtyButton label={t.pos.cart.qtyIncrease(item.name)} onClick={() => increaseItem(line.itemId)}>
                <Plus size={11} strokeWidth={2.6} aria-hidden="true" />
              </QtyButton>
            </div>

            <button
              type="button"
              onClick={onEditNote}
              className={cn(
                "inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg border px-3 py-0.5 text-xs font-semibold transition-colors min-[1200px]:min-h-0 min-[1200px]:px-2 min-[1200px]:text-xs2",
                line.note
                  ? "border-warning/60 bg-warning/10 font-bold text-warning-dark"
                  : "border-border bg-surface text-text-muted hover:border-border-hover hover:text-ink",
              )}
            >
              <MessageSquarePlus size={14} aria-hidden="true" className="min-[1200px]:size-[11px]" />
              <span className="max-[359px]:sr-only">{line.note ? t.pos.cart.editNote : t.pos.cart.addNote}</span>
            </button>

            <button
              type="button"
              aria-label={t.pos.cart.removeLine(item.name)}
              title={t.pos.cart.removeLine(item.name)}
              onClick={() => removeItem(line.itemId)}
              className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-error/30 text-error transition-colors hover:bg-error/10 hover:text-error active:bg-error/15 min-[1200px]:h-6 min-[1200px]:w-6 min-[1200px]:border-0 min-[1200px]:text-text-light"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {line.note && !editingNote && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1 font-medium text-warning-dark">
          <span className="truncate text-xs2 font-semibold">{line.note}</span>
          <button
            type="button"
            aria-label={t.pos.cart.editNote}
            onClick={onEditNote}
            className="ml-2 flex shrink-0 items-center gap-0.5 text-2xs font-bold hover:underline"
          >
            <Edit3 size={10} aria-hidden="true" /> {t.common.edit}
          </button>
        </div>
      )}

      {editingNote && <NoteEditor line={line} name={item.name} onClose={onCloseNote} />}
    </li>
  );
}

function NoteEditor({ line, name, onClose }: { line: CartLine; name: string; onClose: () => void }) {
  const [value, setValue] = useState(line.note ?? "");
  const save = () => {
    setItemNote(line.itemId, value.trim());
    onClose();
  };
  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-mineral/60 p-2">
      <Input
        size="sm"
        autoFocus
        aria-label={t.pos.cart.noteLabel(name)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.pos.cart.notePlaceholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          aria-label={t.pos.cart.noteCancel}
          onClick={onClose}
          className="flex min-h-10 items-center gap-1 rounded px-3 py-0.5 text-xs font-medium text-text-muted hover:bg-ink/5 min-[1200px]:min-h-0 min-[1200px]:px-2"
        >
          <X size={11} aria-hidden="true" /> {t.common.cancel}
        </button>
        <button
          type="button"
          aria-label={t.pos.cart.noteSave}
          onClick={save}
          className="flex min-h-10 items-center gap-1 rounded bg-ink px-3 py-0.5 text-xs font-bold text-white hover:bg-ink/90 min-[1200px]:min-h-0 min-[1200px]:px-2"
        >
          <Check size={11} aria-hidden="true" /> {t.common.save}
        </button>
      </div>
    </div>
  );
}
