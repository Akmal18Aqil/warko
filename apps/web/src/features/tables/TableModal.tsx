import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_FLOORS } from "../../data/seed";
import { t } from "../../locales/id";
import type { TableRow } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { cn } from "../../lib/cn";

interface TableModalProps {
  open: boolean;
  tableToEdit?: TableRow | null;
  availableAreas?: string[];
  onClose: () => void;
  onSave: (table: TableRow) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const DEFAULT_AREAS: string[] = [...DEFAULT_FLOORS];
const DEFAULT_AREA = DEFAULT_AREAS[0] ?? "Lantai 1";
const DEFAULT_SEATS = "4";
const MAX_SEATS = 50;
const FORM_ID = "table-form";
const AREA_LIST_ID = "table-area-suggestions";

export function TableModal({ open, tableToEdit, availableAreas = DEFAULT_AREAS, onClose, onSave, onDelete }: TableModalProps) {
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [area, setArea] = useState(DEFAULT_AREA);
  const [submitting, setSubmitting] = useState(false);

  const mergedAreas = Array.from(new Set([...availableAreas, ...DEFAULT_AREAS]));

  useEffect(() => {
    setName(tableToEdit?.name ?? "");
    setSeats(tableToEdit ? String(tableToEdit.seats) : DEFAULT_SEATS);
    setArea(tableToEdit?.area || DEFAULT_AREA);
  }, [tableToEdit, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning(t.tables.form.nameRequired);
      return;
    }
    const numericSeats = Number.parseInt(seats, 10);
    if (Number.isNaN(numericSeats) || numericSeats <= 0) {
      toast.warning(t.tables.form.seatsInvalid);
      return;
    }

    try {
      setSubmitting(true);
      const tableData: TableRow = {
        id: tableToEdit?.id ?? `meja-${Date.now()}`,
        name: name.trim(),
        seats: numericSeats,
        area: area.trim() || DEFAULT_AREA,
      };
      await onSave(tableData);
      toast.success(
        tableToEdit ? t.tables.form.updated(tableData.name) : t.tables.form.added(tableData.name, tableData.area),
      );
      onClose();
    } catch (err) {
      toast.error(t.tables.form.saveFailed, {
        description: err instanceof Error ? err.message : t.common.unknownError,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!tableToEdit || !onDelete) return;
    if (!window.confirm(t.tables.form.confirmDelete(tableToEdit.name))) return;
    try {
      setSubmitting(true);
      await onDelete(tableToEdit.id);
      toast.success(t.tables.form.deleted(tableToEdit.name));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.tables.form.deleteFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader
        title={tableToEdit ? t.tables.form.titleEdit : t.tables.form.titleAdd}
        subtitle={t.tables.form.subtitle}
      />
      <ModalBody>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t.tables.form.name}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.tables.form.namePlaceholder}
          />
          <Input
            label={t.tables.form.seats}
            type="number"
            required
            min={1}
            max={MAX_SEATS}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
          <div>
            <Input
              label={t.tables.form.area}
              hint={t.tables.form.areaHint}
              list={AREA_LIST_ID}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={t.tables.form.areaPlaceholder}
            />
            <datalist id={AREA_LIST_ID}>
              {mergedAreas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <p className="mb-1.5 mt-2.5 text-xs2 font-semibold text-text-muted">{t.tables.form.presets}</p>
            <div className="flex flex-wrap gap-1.5">
              {mergedAreas.map((a) => {
                const isSelected = area.trim().toLowerCase() === a.trim().toLowerCase();
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setArea(a)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs transition-all",
                      isSelected
                        ? "border-accent bg-accent/25 font-bold text-ink shadow-xs"
                        : "border-border bg-mineral/50 text-text-muted hover:bg-mineral hover:text-ink",
                    )}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </ModalBody>
      <ModalFooter className="justify-between">
        {tableToEdit && onDelete ? (
          <Button type="button" variant="danger-ghost" size="sm" onClick={handleDelete} disabled={submitting}>
            <Trash2 size={15} className="mr-1 text-error-dark" aria-hidden="true" />
            {t.tables.form.deleteTable}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t.common.cancel}
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" loading={submitting}>
            {t.tables.form.saveTable}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
