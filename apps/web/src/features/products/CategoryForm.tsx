import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { MenuKind } from "../../data/menu";
import { cn } from "../../lib/cn";
import { addCategory, updateCategory } from "../../state/catalog";
import type { CategoryRow } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { t } from "../../locales/id";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from "./categoryColors";
import { FieldGroup } from "./FieldGroup";
import { DEFAULT_PRODUCT_KIND, KindPicker } from "./productKinds";

/** Add form, or edit form when `editing` is given. Remount (via `key`) to switch the category being edited. */
export function CategoryForm({ editing, onDone }: { editing: CategoryRow | null; onDone: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [kind, setKind] = useState<MenuKind>(editing?.kind ?? DEFAULT_PRODUCT_KIND);
  const [color, setColor] = useState(editing?.color || DEFAULT_CATEGORY_COLOR);
  const [saving, setSaving] = useState(false);
  const text = t.products.categories.form;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(text.nameRequired);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, { name: trimmed, kind, color }, editing.name);
        toast.success(text.updated(trimmed));
      } else {
        await addCategory({ name: trimmed, kind, color });
        toast.success(text.added(trimmed));
      }
      onDone();
    } catch (err) {
      toast.error(text.saveFailed, { description: err instanceof Error ? err.message : t.common.unknownError });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <h4 className="text-sm font-bold text-ink">{editing ? text.editTitle : text.newTitle}</h4>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={text.name}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={text.namePlaceholder}
        />
        <KindPicker label={text.kind} value={kind} onChange={setKind} />
      </div>

      <FieldGroup label={text.color} role="radiogroup">
        <div className="flex items-center gap-2">
          {CATEGORY_COLORS.map((swatch) => {
            const label = t.products.categories.colors[swatch.id];
            const selected = color === swatch.id;
            return (
              <button
                key={swatch.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                onClick={() => setColor(swatch.id)}
                className={cn(
                  "h-7 w-7 rounded-full border transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  swatch.bg,
                  swatch.border,
                  selected ? "scale-110 ring-2 ring-ink ring-offset-2" : "opacity-75 hover:opacity-100",
                )}
              />
            );
          })}
        </div>
      </FieldGroup>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onDone} disabled={saving}>
          {t.common.cancel}
        </Button>
        <Button type="submit" size="sm" loading={saving} className="font-semibold">
          {editing ? text.saveChanges : text.add}
        </Button>
      </div>
    </form>
  );
}
