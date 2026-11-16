import type { StaffRole } from "@wakro/shared";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { API_BASE, isRemoteDataSource } from "../data/api";
import { usePublicCustomer } from "../hooks/usePublicCustomer";
import { t } from "../locales/id";
import type { StaffUser } from "../state/auth";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

/** Dispatched on `window` by the account menus to sign out of the remote session. */
export const REMOTE_LOGOUT_EVENT = "wakro-remote-logout";

type Session = {
  id: string;
  name: string;
  role: StaffRole;
  title: string;
  description: string;
  avatarColor: string;
  initials: string;
};

type Props = { children: (staff?: StaffUser) => ReactNode };

export function RemoteAuthGate({ children }: Props) {
  const publicCustomer = usePublicCustomer();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isRemoteDataSource);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isRemoteDataSource) return;
    let active = true;
    fetch(`${API_BASE}/auth/session`, { credentials: "same-origin" })
      .then(async (response) => (response.ok ? ((await response.json()).data as Session) : null))
      .then((value) => {
        if (active) setSession(value);
      })
      .catch(() => {
        if (active) setError(t.app.remoteGate.unreachable);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const logout = () => {
      void fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "same-origin" })
        .then((response) => {
          if (!response.ok) throw new Error();
          setSession(null);
        })
        .catch(() => toast.error(t.app.remoteGate.logoutFailed));
    };
    window.addEventListener(REMOTE_LOGOUT_EVENT, logout);
    return () => {
      active = false;
      window.removeEventListener(REMOTE_LOGOUT_EVENT, logout);
    };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error(t.app.remoteGate.badCredentials);
      const current = await fetch(`${API_BASE}/auth/session`, { credentials: "same-origin" });
      if (!current.ok) throw new Error(t.app.remoteGate.sessionFailed);
      setSession((await current.json()).data as Session);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.app.remoteGate.unreachable);
    } finally {
      setLoading(false);
    }
  }

  if (!isRemoteDataSource || publicCustomer) return children();
  if (session) return children({ ...session, pin: "" });
  return (
    <main className="flex min-h-screen items-center justify-center bg-mineral p-4">
      <form onSubmit={login} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-clay">
        <h1 className="font-display text-xl font-bold text-ink">{t.app.remoteGate.title}</h1>
        <Input
          label={t.app.remoteGate.username}
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <Input
          label={t.app.remoteGate.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-sm text-error-dark">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? t.app.remoteGate.submitting : t.app.remoteGate.submit}
        </Button>
      </form>
    </main>
  );
}
