import { STAFF_ROLES, type StaffRole } from "@wakro/shared";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { jsonBody, request, SESSION_REJECTED_EVENT } from "../../data/api";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../../data/authApi";
import { t } from "../../locales/id";
import { useRemoteSession } from "../../state/remoteSession";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Input, Select } from "../../ui/Input";
import { LoadingText } from "../../ui/Spinner";
import { PasswordConfirmModal } from "./PasswordConfirmModal";
import { StaffPinModal } from "./StaffPinModal";

type Staff = { id: string; username: string; name: string; role: StaffRole; active: boolean; hasPin?: boolean };

/** The action waiting for the admin's password. */
type Pending = { kind: "save" } | { kind: "toggle"; member: Staff } | { kind: "pin"; member: Staff; mode: "set" | "clear" };

const USERNAME_PATTERN = "[a-z0-9._-]{3,80}";
const NAME_MAX_LENGTH = 120;
const DEFAULT_ROLE: StaffRole = "pelayan";

function staffPath(id?: string): string {
  return id ? `/staff/${encodeURIComponent(id)}` : "/staff";
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

/** Server-side staff accounts (remote mode, admin only). */
export function RemoteStaffManager({ currentStaffId }: { currentStaffId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>(DEFAULT_ROLE);
  const [pending, setPending] = useState<Pending | null>(null);
  const refreshDevice = useRemoteSession()?.refreshDevice;

  const refresh = useCallback(async () => {
    try {
      setStaff(await request<Staff[]>(staffPath()));
      setError("");
    } catch (cause) {
      setError(messageOf(cause, t.settings.staff.loadFailed));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearForm = () => {
    setEditing(null);
    setName("");
    setUsername("");
    setPassword("");
    setRole(DEFAULT_ROLE);
  };

  const startEdit = (member: Staff) => {
    setEditing(member.id);
    setName(member.name);
    setUsername(member.username);
    setRole(member.role);
    setPassword("");
  };

  /** Changing the signed-in admin's own account can end their session; let the gate check right away. */
  const recheckSessionIf = (selfAffected: boolean) => {
    if (selfAffected) window.dispatchEvent(new Event(SESSION_REJECTED_EVENT));
  };

  const askToSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending({ kind: "save" });
  };

  const save = async (confirmPassword: string) => {
    const data = { name, username, role, ...(password ? { password } : {}), confirmPassword };
    await request(staffPath(editing ?? undefined), { method: editing ? "PATCH" : "POST", ...jsonBody(data) });
    const selfAffected = editing === currentStaffId;
    setPending(null);
    clearForm();
    setMessage(t.settings.staff.saved);
    recheckSessionIf(selfAffected);
    await refresh();
    await refreshDevice?.();
  };

  const toggle = async (member: Staff, confirmPassword: string) => {
    await request(staffPath(member.id), { method: "PATCH", ...jsonBody({ active: !member.active, confirmPassword }) });
    setPending(null);
    setMessage(member.active ? t.settings.staff.deactivated : t.settings.staff.activated);
    recheckSessionIf(member.id === currentStaffId);
    await refresh();
    await refreshDevice?.();
  };

  const pinDone = async (member: Staff, mode: "set" | "clear", selfRevoked: boolean) => {
    setPending(null);
    setMessage(mode === "set" ? t.settings.staff.pin.saved(member.name) : t.settings.staff.pin.cleared(member.name));
    recheckSessionIf(selfRevoked);
    await refresh();
    await refreshDevice?.();
  };

  const confirmDialog = () => {
    if (!pending) return null;
    if (pending.kind === "pin") {
      const { member, mode } = pending;
      return (
        <StaffPinModal
          member={{ id: member.id, name: member.name, hasPin: member.hasPin === true }}
          mode={mode}
          onClose={() => setPending(null)}
          onDone={({ selfRevoked }) => void pinDone(member, mode, selfRevoked)}
        />
      );
    }
    if (pending.kind === "toggle") {
      const { member } = pending;
      return (
        <PasswordConfirmModal
          title={t.settings.staff.confirm.toggleTitle(member.active)}
          description={t.settings.staff.confirm.toggleBody(member.active, member.name)}
          submitLabel={t.settings.staff.confirm.submit}
          danger={member.active}
          onClose={() => setPending(null)}
          onConfirm={(confirmPassword) => toggle(member, confirmPassword)}
        />
      );
    }
    return (
      <PasswordConfirmModal
        title={t.settings.staff.confirm.saveTitle(editing !== null)}
        description={t.settings.staff.confirm.saveBody(name, editing !== null)}
        submitLabel={t.settings.staff.confirm.submit}
        onClose={() => setPending(null)}
        onConfirm={save}
      />
    );
  };

  return (
    <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-clay" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="font-display text-lg font-bold text-ink">
        {t.settings.staff.title}
      </h2>
      <p className="mt-1 text-sm text-ink/60">{t.settings.staff.intro}</p>
      {loading ? (
        <LoadingText className="mt-4" />
      ) : staff.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">{t.settings.staff.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink/10">
          {staff.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-ink">{member.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink/60">
                  {member.username} · {t.settings.staff.roles[member.role]}
                  <Badge tone={member.active ? "success" : "neutral"}>
                    {member.active ? t.settings.staff.active : t.settings.staff.inactive}
                  </Badge>
                  <Badge tone={member.hasPin ? "accent" : "neutral"}>
                    {member.hasPin ? t.settings.staff.hasPin : t.settings.staff.noPin}
                  </Badge>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" aria-label={t.settings.staff.editMember(member.name)} onClick={() => startEdit(member)}>
                  {t.common.edit}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t.settings.staff.toggleMember(member.active, member.name)}
                  onClick={() => setPending({ kind: "toggle", member })}
                >
                  {member.active ? t.settings.staff.deactivate : t.settings.staff.activate}
                </Button>
                {member.active && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t.settings.staff.pinAction(
                      member.hasPin ? t.settings.staff.resetPin : t.settings.staff.setPin,
                      member.name,
                    )}
                    onClick={() => setPending({ kind: "pin", member, mode: "set" })}
                  >
                    {member.hasPin ? t.settings.staff.resetPin : t.settings.staff.setPin}
                  </Button>
                )}
                {member.hasPin && (
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    aria-label={t.settings.staff.pinAction(t.settings.staff.clearPin, member.name)}
                    onClick={() => setPending({ kind: "pin", member, mode: "clear" })}
                  >
                    {t.settings.staff.clearPin}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={askToSave} className="mt-5 grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2">
        <h3 className="font-semibold text-ink sm:col-span-2">{editing ? t.settings.staff.formEdit : t.settings.staff.formAdd}</h3>
        <Input
          label={t.settings.staff.name}
          required
          maxLength={NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label={t.settings.staff.username}
          required
          pattern={USERNAME_PATTERN}
          autoComplete="off"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <Select label={t.settings.staff.role} value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
          {STAFF_ROLES.map((option) => (
            <option key={option} value={option}>
              {t.settings.staff.roles[option]}
            </option>
          ))}
        </Select>
        <Input
          label={editing ? t.settings.staff.passwordNew : t.settings.staff.password}
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required={!editing}
          hint={t.settings.staff.passwordHint}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="text-sm text-error-dark sm:col-span-2" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-success-dark sm:col-span-2" role="status">
            {message}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">{t.common.save}</Button>
          {editing && (
            <Button variant="outline" onClick={clearForm}>
              {t.common.cancel}
            </Button>
          )}
        </div>
      </form>
      {confirmDialog()}
    </section>
  );
}
