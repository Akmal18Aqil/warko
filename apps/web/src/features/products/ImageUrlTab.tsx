import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { t } from "../../locales/id";

/** Applies a pasted image address; an embedded (uploaded) photo is not shown as a giant data URL. */
export function ImageUrlTab({ value, onApply }: { value: string; onApply: (url: string) => void }) {
  const [url, setUrl] = useState(value.startsWith("data:") ? "" : value);
  const text = t.products.picker.url;

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onApply(trimmed);
    toast.success(text.applied);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <Input
          type="text"
          inputMode="url"
          size="sm"
          label={text.label}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            // The picker lives inside the product form: Enter applies the link instead of submitting the form.
            if (event.key !== "Enter") return;
            event.preventDefault();
            apply();
          }}
          placeholder={text.placeholder}
          wrapperClassName="flex-1"
        />
        <Button variant="ink" size="sm" disabled={!url.trim()} onClick={apply} className="shrink-0 font-bold">
          {text.apply}
        </Button>
      </div>
      <p className="text-2xs text-text-muted">{text.tip}</p>
    </div>
  );
}
