import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { MenuKind } from "../../data/menu";
import { t } from "../../locales/id";
import { addCategory } from "../../state/catalog";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { DEFAULT_PRODUCT_KIND, KindPicker } from "./productKinds";

/** Quick "new category" form shown in place of the category select inside the product form. */
export function InlineCategoryForm({ onCreated }: { onCreated: (name: string) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MenuKind>(DEFAULT_PRODUCT_KIND);
  const [saving, setSaving] = useState(false);
  const text = t.products.form.inlineCategory;

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning(text.nameRequired);
      return;
    }
    setSaving(true);
    try {
      const created = await addCategory({ name: trimmed, kind });
      toast.success(text.created(created.name));
      onCreated(created.name);
    } catch (err) {
      toast.error(text.failed, { description: err instanceof Error ? err.message : t.common.unknownError });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/10 p-2.5">
      <div className="flex items-start gap-1.5">
        <Input
          size="sm"
          aria-label={text.nameLabel}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            // Nested in the product form: Enter creates the category instead of submitting the product.
            if (event.key !== "Enter") return;
            event.preventDefault();
            void create();
          }}
          placeholder={text.namePlaceholder}
          wrapperClassName="flex-1"
        />
        <Button size="sm" loading={saving} onClick={() => void create()} className="shrink-0">
          <Check size={13} aria-hidden="true" />
          {t.common.save}
        </Button>
      </div>
      <KindPicker label={text.kindLabel} value={kind} onChange={setKind} />
    </div>
  );
}
