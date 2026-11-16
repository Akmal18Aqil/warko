import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, KeyRound, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategory, useCategories, useProducts } from "../../state/catalog";
import { FULL_ACCESS_ROLES, useAuth } from "../../state/auth";
import type { CategoryRow } from "../../types/domain";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Input, Select } from "../../ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { t } from "../../locales/id";

const PIN_MAX_LENGTH = 6;
/** Product names listed as an example of what the deletion affects. */
const SAMPLE_PRODUCT_COUNT = 4;

type Step = 1 | 2;

/**
 * Two-step category deletion. Step 1 shows the impact and where the products go; step 2 authorises it:
 * a staff PIN in local mode, the signed-in session (checked again by the API) in remote mode.
 */
export function DeleteCategoryModal({ category, onClose }: { category: CategoryRow; onClose: () => void }) {
  const categories = useCategories();
  const products = useProducts();
  const { isRemote, verifyPin } = useAuth();
  const text = t.products.categories.delete;

  const fallbacks = useMemo(() => categories.filter((c) => c.id !== category.id), [categories, category.id]);
  const affected = useMemo(() => products.filter((p) => p.category === category.name), [products, category.name]);

  const [step, setStep] = useState<Step>(1);
  const [reassignTo, setReassignTo] = useState(fallbacks[0]?.name ?? "");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    // Remote mode ignores the PIN: the session role decides, and the API enforces it again.
    if (!verifyPin(isRemote ? "" : pin.trim(), FULL_ACCESS_ROLES)) {
      setAuthError(isRemote ? text.notAllowed : text.wrongPin);
      return;
    }
    setAuthError(null);
    setDeleting(true);
    try {
      await deleteCategory(category.id, category.name, reassignTo || undefined);
      toast.success(text.deleted(category.name, affected.length > 0 && reassignTo ? { count: affected.length, to: reassignTo } : null));
      onClose();
    } catch (err) {
      toast.error(text.failed, { description: err instanceof Error ? err.message : t.common.unknownError });
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} closeOnBackdrop={false}>
      <ModalHeader
        icon={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-error/30 bg-error/10 text-error-dark">
            <ShieldAlert size={20} aria-hidden="true" />
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {text.title}
            <Badge tone="error" solid>
              {text.step(step)}
            </Badge>
          </span>
        }
        subtitle={text.subtitle}
      />

      {step === 1 ? (
        <>
          <ModalBody className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3.5 text-xs text-error-dark">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-bold">{text.warningTitle} </span>
                {text.warning(category.name)}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-ink/70">{text.impactTitle}</p>
              <div className="space-y-1.5 rounded-xl border border-border bg-mineral/30 p-3 text-xs text-ink/80">
                <div className="flex justify-between font-semibold">
                  <span>{text.registeredProducts}</span>
                  <span className="font-bold text-error-dark">{text.productsCount(affected.length)}</span>
                </div>
                {affected.length > 0 && (
                  <p className="line-clamp-2 text-xs2 text-text-muted">
                    {text.sampleProducts(affected.slice(0, SAMPLE_PRODUCT_COUNT).map((p) => p.name), affected.length > SAMPLE_PRODUCT_COUNT)}
                  </p>
                )}
              </div>
            </div>

            {affected.length > 0 && (
              <Select label={text.reassignLabel(affected.length)} value={reassignTo} onChange={(event) => setReassignTo(event.target.value)}>
                {fallbacks.map((c) => (
                  <option key={c.id} value={c.name}>
                    {text.reassignOption(c.name, c.kind)}
                  </option>
                ))}
              </Select>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button variant="ink" size="sm" onClick={() => setStep(2)} className="font-semibold">
              {text.toStep2}
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
          </ModalFooter>
        </>
      ) : (
        <>
          <ModalBody className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/15 p-3.5 text-xs text-warning-dark">
              <KeyRound size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-bold">{text.authTitle} </span>
                {isRemote ? text.authRemote : text.authLocal}
              </p>
            </div>

            {isRemote ? (
              authError && (
                <p role="alert" className="text-xs font-medium text-error-dark">
                  {authError}
                </p>
              )
            ) : (
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_MAX_LENGTH}
                label={text.pinLabel}
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value);
                  setAuthError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && pin.trim()) void handleConfirm();
                }}
                error={authError ?? undefined}
                placeholder={text.pinPlaceholder}
                className="text-center text-lg font-bold tracking-widest"
              />
            )}
          </ModalBody>
          <ModalFooter className="justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={deleting}>
              <ArrowLeft size={14} aria-hidden="true" />
              {text.toStep1}
            </Button>
            <Button variant="danger" size="sm" loading={deleting} disabled={!isRemote && !pin.trim()} onClick={() => void handleConfirm()} className="font-bold">
              <Trash2 size={15} aria-hidden="true" />
              {text.confirm}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
