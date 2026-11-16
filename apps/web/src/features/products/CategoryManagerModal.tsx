import { Layers, Plus } from "lucide-react";
import { useState } from "react";
import { t } from "../../locales/id";
import { useCategories } from "../../state/catalog";
import type { CategoryRow } from "../../types/domain";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { CategoryForm } from "./CategoryForm";
import { CategoryList } from "./CategoryList";
import { DeleteCategoryModal } from "./DeleteCategoryModal";
import { useProductCounts } from "./useProductCounts";

/** The category form is closed, adding a new category, or editing `category`. */
type FormState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; category: CategoryRow };

export function CategoryManagerModal({ onClose }: { onClose: () => void }) {
  const categories = useCategories();
  const productCounts = useProductCounts();
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const text = t.products.categories;

  const closeForm = () => setForm({ mode: "closed" });

  return (
    <>
      <Modal size="lg" onClose={onClose}>
        <ModalHeader
          icon={
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-accent/20">
              <Layers size={20} className="text-accent-dark" aria-hidden="true" />
            </span>
          }
          title={text.title}
          subtitle={text.subtitle}
        />
        <ModalBody className="space-y-4">
          {form.mode === "closed" ? (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setForm({ mode: "add" })} className="font-semibold">
                <Plus size={15} aria-hidden="true" />
                {text.addNew}
              </Button>
            </div>
          ) : (
            <CategoryForm
              key={form.mode === "edit" ? form.category.id : "new"}
              editing={form.mode === "edit" ? form.category : null}
              onDone={closeForm}
            />
          )}

          <CategoryList
            categories={categories}
            productCounts={productCounts}
            onEdit={(category) => setForm({ mode: "edit", category })}
            onDelete={setDeleteTarget}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {text.done}
          </Button>
        </ModalFooter>
      </Modal>

      {deleteTarget && <DeleteCategoryModal category={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </>
  );
}
