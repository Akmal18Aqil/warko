import { Plus, ScanLine, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import type { MenuItem, MenuKind } from "../../data/menu";
import { t } from "../../locales/id";
import { deleteProduct, saveProduct, useCategories } from "../../state/catalog";
import { Button } from "../../ui/Button";
import { Input, Select } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { BarcodeScanner } from "../scanner/BarcodeScanner";
import { FieldGroup } from "./FieldGroup";
import { InlineCategoryForm } from "./InlineCategoryForm";
import { ProductImagePicker } from "./ProductImagePicker";
import { DEFAULT_PRODUCT_KIND } from "./productKinds";

const FORM_ID = "product-form";
const DEFAULT_PREP_MINUTES = 5;
const MIN_PRICE = 1000;
const PRICE_STEP = 500;
const BARCODE_PREFIX = "899";

function generateRandomBarcode(): string {
  const randomPart = Math.floor(1_000_000_000 + Math.random() * 9_000_000_000);
  return `${BARCODE_PREFIX}${randomPart}`;
}

const required = (label: string): ReactNode => (
  <>
    {label}{" "}
    <span aria-hidden="true" className="text-error-dark">
      *
    </span>
  </>
);

interface ProductModalProps {
  /** The product being edited; `null` creates a new one. */
  itemToEdit: MenuItem | null;
  onClose: () => void;
}

export function ProductModal({ itemToEdit, onClose }: ProductModalProps) {
  const categories = useCategories();
  const text = t.products.form;

  const [name, setName] = useState(itemToEdit?.name ?? "");
  const [category, setCategory] = useState(itemToEdit?.category ?? categories[0]?.name ?? "");
  const [price, setPrice] = useState(itemToEdit ? String(itemToEdit.price) : "");
  const [description, setDescription] = useState(itemToEdit?.description ?? "");
  const [barcode, setBarcode] = useState(() => itemToEdit?.barcode ?? generateRandomBarcode());
  // New products start without a photo; the list falls back to the name's initials.
  const [image, setImage] = useState(itemToEdit?.image ?? "");
  const [badge, setBadge] = useState(itemToEdit?.badge ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning(text.nameRequired);
      return;
    }
    const numericPrice = Number.parseInt(price.replace(/\D/g, ""), 10);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      toast.warning(text.priceInvalid);
      return;
    }
    if (!category) {
      toast.warning(text.categoryRequired);
      return;
    }
    const kind: MenuKind = categories.find((c) => c.name === category)?.kind ?? itemToEdit?.kind ?? DEFAULT_PRODUCT_KIND;

    setSubmitting(true);
    try {
      const item: MenuItem = {
        id: itemToEdit?.id ?? `prod-${Date.now()}`,
        name: trimmedName,
        category,
        kind,
        prepMinutes: itemToEdit?.prepMinutes ?? DEFAULT_PREP_MINUTES,
        price: numericPrice,
        description: description.trim() || trimmedName,
        barcode: barcode.trim() || generateRandomBarcode(),
        image,
        badge: badge.trim() ? badge.trim() : undefined,
        // Stock is managed from the "Stok" dialog; editing details must not reset it.
        stock: itemToEdit?.stock ?? null,
      };
      await saveProduct(item);
      toast.success(itemToEdit ? text.updated(trimmedName) : text.added(trimmedName));
      onClose();
    } catch (err) {
      toast.error(text.saveFailed, { description: err instanceof Error ? err.message : t.common.unknownError });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToEdit) return;
    setSubmitting(true);
    try {
      await deleteProduct(itemToEdit.id);
      toast.success(text.deleted(itemToEdit.name));
      onClose();
    } catch (err) {
      toast.error(text.deleteFailed, { description: err instanceof Error ? err.message : t.common.unknownError });
      setConfirmDeleteOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal size="lg" onClose={onClose} closeOnBackdrop={false}>
        <ModalHeader title={itemToEdit ? text.editTitle : text.newTitle} subtitle={text.subtitle} />
        <ModalBody>
          <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={required(text.name)}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={text.namePlaceholder}
              />

              <div>
                {newCategoryOpen ? (
                  <div className="space-y-1.5">
                    <p className="text-xs2 font-semibold uppercase tracking-wider text-text-muted">{required(text.category)}</p>
                    <InlineCategoryForm
                      onCreated={(createdName) => {
                        setCategory(createdName);
                        setNewCategoryOpen(false);
                      }}
                    />
                  </div>
                ) : (
                  <Select label={required(text.category)} required value={category} onChange={(event) => setCategory(event.target.value)}>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name} ({cat.kind})
                      </option>
                    ))}
                  </Select>
                )}
                <button
                  type="button"
                  onClick={() => setNewCategoryOpen(!newCategoryOpen)}
                  className="mt-1 inline-flex items-center gap-0.5 text-xs2 font-semibold text-accent-dark hover:underline"
                >
                  {newCategoryOpen ? (
                    t.common.close
                  ) : (
                    <>
                      <Plus size={12} aria-hidden="true" />
                      {text.newCategory}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                type="number"
                label={required(text.price)}
                required
                min={MIN_PRICE}
                step={PRICE_STEP}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder={text.pricePlaceholder}
              />

              <div>
                <Input
                  label={text.barcode}
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder={text.barcodePlaceholder}
                  className="font-mono"
                />
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => setScannerOpen(true)}>
                    <ScanLine size={12} aria-hidden="true" />
                    {text.scan}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setBarcode(generateRandomBarcode())}>
                    <Sparkles size={12} aria-hidden="true" />
                    {text.autoBarcode}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={text.badge}
                value={badge}
                onChange={(event) => setBadge(event.target.value)}
                placeholder={text.badgePlaceholder}
              />
              <Input
                label={text.description}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={text.descriptionPlaceholder}
              />
            </div>

            <FieldGroup label={text.photo}>
              <ProductImagePicker value={image} onChange={setImage} productName={name} />
            </FieldGroup>
          </form>
        </ModalBody>
        <ModalFooter className="justify-between">
          {itemToEdit ? (
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)} disabled={submitting}>
              <Trash2 size={15} aria-hidden="true" />
              {text.deleteProduct}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form={FORM_ID} size="sm" loading={submitting}>
              {text.saveProduct}
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {confirmDeleteOpen && itemToEdit && (
        <Modal size="sm" onClose={() => setConfirmDeleteOpen(false)}>
          <ModalHeader title={text.deleteTitle} />
          <ModalBody>
            <p className="text-sm text-ink">{text.deleteConfirm(itemToEdit.name)}</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(false)} disabled={submitting}>
              {t.common.cancel}
            </Button>
            <Button variant="danger" size="sm" loading={submitting} onClick={() => void handleDelete()}>
              {t.common.delete}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={text.scannerTitle}
        subtitle={text.scannerSubtitle}
        onScanCode={(code) => {
          setBarcode(code);
          toast.success(text.barcodeFilled(code));
          setScannerOpen(false);
        }}
      />
    </>
  );
}
