import { useRef, useState } from "react";
import { FileDown, FileSpreadsheet, FileUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { isRemoteDataSource } from "../../data/index";
import { t } from "../../locales/id";
import { Button } from "../../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../ui/Modal";
import { resetCatalogToDemo, useProducts } from "../../state/catalog";
import { reloadAllData } from "../../state/snapshot";
import { exportBackupJson, exportProductsCsv, importBackupFile } from "../../lib/exporters";
import { SettingsCard } from "./SettingsCard";

const IMPORT_ACCEPT = ".json,.csv,application/json,text/csv";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Export always works; import, full backup and demo reset only exist for the browser database (local mode). */
export function BackupCard() {
  const products = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const runExport = async (action: () => Promise<void>) => {
    try {
      await action();
      toast.success(t.settings.data.exported, { description: t.settings.data.exportedBody });
    } catch (err) {
      toast.error(errorMessage(err, t.settings.data.exportFailed));
    }
  };

  const handleImport = async (file: File) => {
    try {
      const counts = await importBackupFile(file);
      await reloadAllData();
      toast.success(t.settings.data.importSuccess, { description: t.settings.data.importSuccessBody(counts) });
    } catch (err) {
      toast.error(t.settings.data.importError, { description: errorMessage(err, t.settings.data.importErrorBody) });
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetCatalogToDemo();
      toast.success(t.settings.data.resetDone);
      setConfirmingReset(false);
    } catch (err) {
      toast.error(errorMessage(err, t.settings.data.resetFailed));
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <SettingsCard
        icon={<FileDown size={19} aria-hidden="true" />}
        label={t.settings.data.label}
        value={isRemoteDataSource ? t.settings.data.summaryRemote(products.length) : t.settings.data.summaryLocal(products.length)}
        note={isRemoteDataSource ? t.settings.data.noteRemote : t.settings.data.noteLocal}
        wide
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void runExport(() => exportProductsCsv(products))}>
            <FileSpreadsheet size={15} aria-hidden="true" />
            {t.settings.data.exportCsv}
          </Button>
          {!isRemoteDataSource && (
            <>
              <Button variant="outline" size="sm" onClick={() => void runExport(exportBackupJson)}>
                <FileDown size={15} aria-hidden="true" />
                {t.settings.data.exportJson}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileUp size={15} aria-hidden="true" />
                {t.settings.data.importFile}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)}>
                <RotateCcw size={14} aria-hidden="true" />
                {t.settings.data.resetDemo}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMPORT_ACCEPT}
                aria-label={t.settings.data.importInput}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImport(file);
                  event.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </SettingsCard>

      {confirmingReset && (
        <Modal onClose={() => setConfirmingReset(false)} size="sm" closeOnBackdrop={!resetting}>
          <ModalHeader title={t.settings.data.resetTitle} />
          <ModalBody>
            <p className="text-sm text-ink/70">{t.settings.data.resetBody}</p>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="outline" disabled={resetting} onClick={() => setConfirmingReset(false)}>
              {t.common.cancel}
            </Button>
            <Button size="sm" variant="danger" loading={resetting} onClick={() => void handleReset()}>
              {t.settings.data.resetConfirm}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
