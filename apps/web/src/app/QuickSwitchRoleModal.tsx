import type { StaffRole } from "@wakro/shared";
import { CheckCircle2, ChefHat, Delete, KeyRound, Receipt, ShieldCheck, Sparkles, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { t } from "../locales/id";
import { type StaffUser, useAuth } from "../state/auth";
import { isDemoMode } from "../state/demo";
import { Button } from "../ui/Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../ui/Modal";

export function QuickSwitchRoleModal() {
  const { isSwitchModalOpen, closeSwitchModal, currentStaff, staffList, switchStaffByPin, switchStaffDirect } = useAuth();

  const [selectedStaff, setSelectedStaff] = useState<StaffUser>(currentStaff);
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isShaking, setIsShaking] = useState(false);

  // Sync selected staff when modal opens
  useEffect(() => {
    if (isSwitchModalOpen) {
      setSelectedStaff(currentStaff);
      setPin("");
      setErrorMsg("");
      setIsShaking(false);
    }
  }, [isSwitchModalOpen, currentStaff]);

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (pin.length < 4) {
        const nextPin = pin + digit;
        setPin(nextPin);
        setErrorMsg("");

        if (nextPin.length === 4) {
          // Auto submit PIN
          const res = switchStaffByPin(nextPin, selectedStaff.id);
          if (!res.success) {
            setErrorMsg(res.error || t.app.quickSwitch.pinMismatch);
            setIsShaking(true);
            setTimeout(() => {
              setPin("");
              setIsShaking(false);
            }, 600);
          }
        }
      }
    },
    [pin, selectedStaff, switchStaffByPin],
  );

  const handleDelete = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setErrorMsg("");
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setErrorMsg("");
  }, []);

  // Physical keyboard support
  useEffect(() => {
    if (!isSwitchModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSwitchModalOpen, handleKeyPress, handleDelete]);

  if (!isSwitchModalOpen) return null;

  const getRoleIcon = (role: StaffRole) => {
    switch (role) {
      case "pelayan":
        return <UtensilsCrossed size={18} />;
      case "dapur":
        return <ChefHat size={18} />;
      case "manajer":
        return <ShieldCheck size={18} />;
      default:
        return <Receipt size={18} />;
    }
  };

  return (
    <Modal onClose={closeSwitchModal} size="lg" className="max-h-[92vh]">
      <ModalHeader
        title={t.app.quickSwitch.title}
        subtitle={isDemoMode ? t.app.quickSwitch.subtitleDemo : t.app.quickSwitch.subtitle}
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-xs">
            <KeyRound size={20} />
          </div>
        }
      />
      <ModalBody className="space-y-4 p-5">
        {/* Step 1: Select Staff Profile */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{t.app.quickSwitch.stepSelect}</p>
            <span className="text-xs2 text-ink/40 font-medium">
              {t.app.quickSwitch.activeNow} <strong className="text-ink">{currentStaff.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {staffList.map((staff) => {
              const isSelected = selectedStaff.id === staff.id;
              const isCurrent = currentStaff.id === staff.id;

              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => {
                    setSelectedStaff(staff);
                    setPin("");
                    setErrorMsg("");
                  }}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all relative overflow-hidden",
                    isSelected
                      ? "bg-accent text-white border-accent-dark shadow-md ring-2 ring-accent/50"
                      : "bg-surface-muted/30 text-ink border-ink/10 hover:bg-surface hover:border-ink/30",
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-display font-bold text-xs shadow-2xs",
                      staff.avatarColor,
                    )}
                  >
                    {staff.initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold truncate">{staff.name}</p>
                      {isCurrent && (
                        <span
                          className={cn(
                            "text-2xs px-1.5 py-0.5 rounded font-semibold",
                            isSelected ? "bg-surface text-accent-dark" : "bg-success/20 text-success-dark",
                          )}
                        >
                          {t.app.quickSwitch.active}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs2 font-medium opacity-80 mt-0.5">
                      {getRoleIcon(staff.role)}
                      <span>{staff.title}</span>
                    </div>
                    <p className="text-2xs opacity-60 line-clamp-1 mt-0.5">{staff.description}</p>
                    {isDemoMode && (
                      <p
                        className={cn(
                          "mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-2xs font-bold",
                          isSelected ? "bg-white/20 text-white" : "bg-ink/10 text-ink",
                        )}
                      >
                        {t.app.quickSwitch.demoPin(staff.pin)}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 text-white">
                      <CheckCircle2 size={15} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: PIN Pad */}
        <div className="rounded-2xl bg-mineral/30 border border-ink/10 p-4 space-y-3">
          <div className="text-center space-y-0.5">
            <p className="text-xs font-bold text-ink/70">
              {t.app.quickSwitch.enterPinFor} <span className="text-ink font-bold">{selectedStaff.name}</span>
            </p>
          </div>

          {/* PIN Dots Display */}
          <div
            className={cn(
              "flex justify-center items-center gap-2.5 py-1 transition-transform",
              isShaking && "animate-shake text-error-dark",
            )}
          >
            {[0, 1, 2, 3].map((idx) => {
              const filled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full border-2 transition-all flex items-center justify-center",
                    filled ? "bg-accent border-accent-dark scale-110 shadow-xs" : "bg-surface border-ink/25",
                    errorMsg && "border-error-dark bg-error/20",
                  )}
                >
                  {filled && <span className="h-1.5 w-1.5 rounded-full bg-surface" />}
                </div>
              );
            })}
          </div>

          {errorMsg && <p className="text-xs font-bold text-error-dark text-center">{errorMsg}</p>}

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-10 rounded-xl bg-surface border border-ink/10 font-display font-bold text-sm text-ink hover:bg-accent hover:border-ink/30 active:scale-95 shadow-2xs transition-all flex items-center justify-center"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="h-10 rounded-xl bg-surface border border-ink/10 text-xs font-bold text-ink/60 hover:bg-error/10 hover:text-error-dark hover:border-error/30 active:scale-95 transition-all flex items-center justify-center"
            >
              {t.app.quickSwitch.clear}
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress("0")}
              className="h-10 rounded-xl bg-surface border border-ink/10 font-display font-bold text-sm text-ink hover:bg-accent hover:border-ink/30 active:scale-95 shadow-2xs transition-all flex items-center justify-center"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="h-10 rounded-xl bg-surface border border-ink/10 text-xs font-bold text-ink/60 hover:bg-ink/5 hover:text-ink active:scale-95 transition-all flex items-center justify-center"
              title={t.app.quickSwitch.deleteDigit}
              aria-label={t.app.quickSwitch.deleteDigit}
            >
              <Delete size={16} />
            </button>
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="justify-between">
        <div className="flex items-center gap-1.5 text-xs text-ink/60">
          <Sparkles size={14} className="text-warning-dark" />
          <span>{t.app.quickSwitch.quickSwitch}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {staffList.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant="outline"
              onClick={() => switchStaffDirect(s.id)}
              className={cn(
                "h-7 text-xs2 px-2.5 gap-1",
                currentStaff.id === s.id && "!border-accent-dark !bg-accent !text-white font-bold",
              )}
            >
              {s.name.split(" ")[0]}
            </Button>
          ))}
        </div>
      </ModalFooter>
    </Modal>
  );
}
