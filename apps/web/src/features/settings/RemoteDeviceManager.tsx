import { MonitorSmartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SESSION_REJECTED_EVENT } from "../../data/api";
import { DEVICE_NAME_MAX_LENGTH, listDevices, type RegisteredDevice, registerThisDevice, revokeDevice } from "../../data/authApi";
import { t } from "../../locales/id";
import { useRemoteSession } from "../../state/remoteSession";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { LoadingText } from "../../ui/Spinner";
import { PasswordConfirmModal } from "./PasswordConfirmModal";

type Pending = { kind: "register" } | { kind: "revoke"; device: RegisteredDevice };

const formatDate = (iso: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** PIN devices (remote mode, admin only): register this browser and revoke devices, always with the admin's password. */
export function RemoteDeviceManager() {
  const text = t.settings.devices;
  const refreshGateDevice = useRemoteSession()?.refreshDevice;
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [deviceName, setDeviceName] = useState("");

  const refresh = useCallback(async () => {
    try {
      setDevices(await listDevices());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [text.loadFailed]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasThisDevice = devices.some((device) => device.current && device.revokedAt === null);
  const trimmedName = deviceName.trim();

  const afterChange = async () => {
    setPending(null);
    await Promise.all([refresh(), refreshGateDevice?.()]);
  };

  const register = async (password: string) => {
    const created = await registerThisDevice(trimmedName, password);
    setDeviceName("");
    setMessage(text.registeredToast(created.name));
    await afterChange();
  };

  const revoke = async (device: RegisteredDevice, password: string) => {
    await revokeDevice(device.id, password);
    setMessage(text.revokedToast(device.name));
    await afterChange();
    // Sessions opened through a revoked device end with it, possibly including this one.
    if (device.current) window.dispatchEvent(new Event(SESSION_REJECTED_EVENT));
  };

  return (
    <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-clay" aria-labelledby="devices-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="devices-heading" className="font-display text-lg font-bold text-ink">
            {text.title}
          </h2>
          <p className="mt-1 text-sm text-ink/60">{text.intro}</p>
        </div>
        {!loading &&
          !error &&
          (hasThisDevice ? (
            <p className="text-xs font-medium text-success-dark">{text.registeredHere}</p>
          ) : (
            <Button size="sm" onClick={() => setPending({ kind: "register" })}>
              <MonitorSmartphone size={14} aria-hidden="true" />
              {text.register}
            </Button>
          ))}
      </div>

      {loading ? (
        <LoadingText className="mt-4" />
      ) : devices.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">{text.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink/10">
          {devices.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {device.name}
                  {device.current && <Badge tone="accent">{text.current}</Badge>}
                  <Badge tone={device.revokedAt ? "error" : "success"}>{device.revokedAt ? text.revoked : text.registered}</Badge>
                </p>
                <p className="mt-0.5 text-xs text-ink/60">{text.createdBy(formatDate(device.createdAt), device.createdByName)}</p>
                <p className="text-xs text-ink/60">
                  {device.revokedAt
                    ? text.revokedAt(formatDate(device.revokedAt))
                    : text.lastUsed(device.lastUsedAt ? formatDate(device.lastUsedAt) : null)}
                </p>
              </div>
              {!device.revokedAt && (
                <Button
                  variant="danger-ghost"
                  size="sm"
                  aria-label={text.revokeLabel(device.name)}
                  onClick={() => setPending({ kind: "revoke", device })}
                >
                  {text.revoke}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 text-sm text-error-dark" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 text-sm text-success-dark" role="status">
          {message}
        </p>
      )}

      {pending?.kind === "register" && (
        <PasswordConfirmModal
          title={text.registerTitle}
          description={text.registerBody}
          submitLabel={text.registerSubmit}
          canSubmit={trimmedName.length > 0}
          onClose={() => setPending(null)}
          onConfirm={register}
        >
          <Input
            label={text.name}
            hint={text.nameHint}
            maxLength={DEVICE_NAME_MAX_LENGTH}
            required
            autoComplete="off"
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
          />
        </PasswordConfirmModal>
      )}
      {pending?.kind === "revoke" && (
        <PasswordConfirmModal
          title={text.revokeTitle(pending.device.name)}
          description={text.revokeBody}
          submitLabel={text.revokeSubmit}
          danger
          onClose={() => setPending(null)}
          onConfirm={(password) => revoke(pending.device, password)}
        />
      )}
    </section>
  );
}
