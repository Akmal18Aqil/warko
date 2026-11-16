import { Input } from "../../ui/Input";
import { t } from "../../locales/id";

interface CustomerNameCardProps {
  name: string;
  onNameChange: (name: string) => void;
  onChangeTable: () => void;
}

export function CustomerNameCard({ name, onNameChange, onChangeTable }: CustomerNameCardProps) {
  return (
    <section className="space-y-2.5 rounded-2xl border border-border bg-surface p-4 shadow-clay">
      <Input
        label={t.selfOrder.header.customerName}
        type="text"
        maxLength={60}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t.selfOrder.header.customerNamePlaceholder}
      />
      <button type="button" onClick={onChangeTable} className="text-xs2 font-bold text-text-muted underline hover:text-ink">
        {t.selfOrder.header.changeTable}
      </button>
    </section>
  );
}
