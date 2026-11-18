import { KeyRound, Lock, Settings } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { t } from "../locales/id";
import { useAuth } from "../state/auth";
import { useRemoteSession } from "../state/remoteSession";
import { Button } from "../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../ui/Modal";
import { PinLogin } from "./PinLogin";

/**
 * Remote-mode user switch. On a registered device: pick a staff member and enter their PIN, or lock the screen.
 * On any other browser there is no PIN sign-in, so the only action is signing out.
 */
export function RemoteSwitchModal() {
  const { isSwitchModalOpen, closeSwitchModal, currentStaff } = useAuth();
  const remote = useRemoteSession();
  const [, setLocation] = useLocation();
  const refreshDevice = remote?.refreshDevice;

  useEffect(() => {
    if (isSwitchModalOpen) void refreshDevice?.();
  }, [isSwitchModalOpen, refreshDevice]);

  const signInWithPin = remote?.signInWithPin;
  const onSignIn = useCallback(
    async (staffId: string, pin: string) => {
      await signInWithPin?.(staffId, pin);
      closeSwitchModal();
    },
    [signInWithPin, closeSwitchModal],
  );

  if (!isSwitchModalOpen || !remote) return null;
  const { device, signOut } = remote;
  const leave = () => {
    closeSwitchModal();
    void signOut();
  };

  if (!device.registered) {
    return (
      <Modal onClose={closeSwitchModal} size="sm">
        <ModalHeader title={t.app.remoteSwitch.unregisteredTitle(currentStaff.name)} />
        <ModalBody className="space-y-3">
          <p className="text-sm text-ink/70">{t.app.remoteSwitch.unregisteredBody}</p>
          {currentStaff.role === "admin" && (
            <>
              <p className="text-sm text-ink/70">{t.app.remoteSwitch.adminRegisterHint}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  closeSwitchModal();
                  setLocation("/pengaturan");
                }}
              >
                <Settings size={14} aria-hidden="true" />
                {t.app.remoteSwitch.openSettings}
              </Button>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={closeSwitchModal}>
            {t.common.cancel}
          </Button>
          <Button onClick={leave}>{t.app.header.logout}</Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal onClose={closeSwitchModal} size="md" placement="sheet" className="max-h-[92vh]">
      <ModalHeader
        title={t.app.remoteSwitch.title}
        subtitle={t.app.remoteSwitch.subtitle}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-xs">
            <KeyRound size={20} aria-hidden="true" />
          </div>
        }
      />
      <ModalBody className="p-4 sm:p-5">
        <PinLogin staff={device.staff} currentId={currentStaff.id} onSignIn={onSignIn} />
      </ModalBody>
      <ModalFooter className="justify-between">
        <p className="hidden text-xs text-ink/60 sm:block">{t.app.remoteSwitch.lockHint}</p>
        <Button variant="outline" onClick={leave}>
          <Lock size={15} aria-hidden="true" />
          {t.app.remoteSwitch.lock}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
