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

/** The scrolling list of cart lines (or the empty state). */
export function CartLines() {
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
    <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-mineral/20 px-3.5 py-3 min-[1200px]:min-h-[230px]">
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
        <FoodImage item={item} className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <p className="truncate text-xs font-bold leading-snug text-ink">{item.name}</p>
            <p className="shrink-0 font-display text-xs font-bold tracking-tight text-ink">{formatIDR(item.price * line.qty)}</p>
          </div>
          <p className="mt-0.5 text-xs2 text-text-muted">{t.pos.cart.unitPrice(formatIDR(item.price))}</p>

          <div className="mt-2 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-mineral/60 p-0.5">
              <QtyButton label={t.pos.cart.qtyDecrease(item.name)} onClick={() => decreaseItem(line.itemId)}>
                <Minus size={11} strokeWidth={2.6} aria-hidden="true" />
              </QtyButton>
              <span aria-live="polite" className="min-w-6 text-center font-display text-xs font-bold text-ink">
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
                "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs2 font-semibold transition-colors",
                line.note
                  ? "border-warning/60 bg-warning/10 font-bold text-warning-dark"
                  : "border-border bg-surface text-text-muted hover:border-border-hover hover:text-ink",
              )}
            >
              <MessageSquarePlus size={11} aria-hidden="true" />
              {line.note ? t.pos.cart.editNote : t.pos.cart.addNote}
            </button>

            <button
              type="button"
              aria-label={t.pos.cart.removeLine(item.name)}
              title={t.pos.cart.removeLine(item.name)}
              onClick={() => removeItem(line.itemId)}
              className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-text-light transition-colors hover:bg-error/10 hover:text-error"
            >
              <Trash2 size={12} aria-hidden="true" />
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
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-text-muted hover:bg-ink/5"
        >
          <X size={11} aria-hidden="true" /> {t.common.cancel}
        </button>
        <button
          type="button"
          aria-label={t.pos.cart.noteSave}
          onClick={save}
          className="flex items-center gap-1 rounded bg-ink px-2 py-0.5 text-xs font-bold text-white hover:bg-ink/90"
        >
          <Check size={11} aria-hidden="true" /> {t.common.save}
        </button>
      </div>
    </div>
  );
}
