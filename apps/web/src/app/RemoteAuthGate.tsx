import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { isRemoteDataSource, RemoteDataError, SESSION_REJECTED_EVENT } from "../data/api";
import {
  type DeviceStatus,
  fetchDeviceStatus,
  fetchSession,
  loginWithPassword,
  loginWithPin,
  logout,
  PASSWORD_MAX_LENGTH,
  type SessionStaff,
} from "../data/authApi";
import { usePublicCustomer } from "../hooks/usePublicCustomer";
import { broadcastSync, subscribeSync } from "../lib/syncBus";
import { t } from "../locales/id";
import { defaultRouteFor, type StaffUser } from "../state/auth";
import { type RemoteSession, RemoteSessionContext } from "../state/remoteSession";
import { clearStaffState } from "../state/snapshot";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { KasaMark } from "../ui/KasaLogo";
import { LoadingText } from "../ui/Spinner";
import { PinLogin } from "./PinLogin";

type Props = { children: (staff?: StaffUser) => ReactNode };

const UNREGISTERED: DeviceStatus = { registered: false };

function toStaffUser(session: SessionStaff): StaffUser {
  const { authMethod: _authMethod, hasPin: _hasPin, ...staff } = session;
  return { ...staff, pin: "" };
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mineral p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-clay sm:p-6">{children}</div>
    </main>
  );
}

function Heading({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="flex items-start gap-3">
      <KasaMark size={34} />
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
        {intro ? <p className="mt-0.5 text-sm text-ink/65">{intro}</p> : null}
      </div>
    </div>
  );
}

function PasswordLogin({
  onSubmit,
  notice,
  onUsePin,
}: {
  onSubmit: (username: string, password: string) => Promise<void>;
  notice: string;
  onUsePin?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(username.trim(), password);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.app.remoteGate.unreachable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Heading title={t.app.remoteGate.title} intro={t.app.remoteGate.passwordIntro} />
      {notice && (
        <p role="status" className="rounded-xl border border-warning/40 bg-warning/15 p-3 text-sm text-warning-dark">
          {notice}
        </p>
      )}
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Input
          label={t.app.remoteGate.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <Input
          label={t.app.remoteGate.password}
          type="password"
          autoComplete="current-password"
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-sm text-error-dark">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          {busy ? t.app.remoteGate.submitting : t.app.remoteGate.submit}
        </Button>
      </form>
      {onUsePin && (
        <div className="border-t border-border pt-3">
          <p className="text-xs text-ink/60">{t.app.remoteGate.deviceHint}</p>
          <Button variant="outline" className="mt-2 w-full" onClick={onUsePin}>
            {t.app.remoteGate.usePin}
          </Button>
        </div>
      )}
    </Shell>
  );
}

function PinScreen({
  device,
  onSignIn,
  onUsePassword,
}: {
  device: Extract<DeviceStatus, { registered: true }>;
  onSignIn: (staffId: string, pin: string) => Promise<void>;
  onUsePassword: () => void;
}) {
  return (
    <Shell>
      <Heading title={t.app.remoteGate.pinTitle} intro={t.app.remoteGate.pinIntro(device.name)} />
      <PinLogin staff={device.staff} onSignIn={onSignIn} />
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-ink/70">{t.app.remoteGate.forgotPin}</p>
        <p className="mt-0.5 text-xs text-ink/60">{t.app.remoteGate.forgotPinHelp}</p>
        <Button variant="outline" className="mt-2 w-full" onClick={onUsePassword}>
          {t.app.remoteGate.usePassword}
        </Button>
      </div>
    </Shell>
  );
}

/**
 * Remote sign-in: password for the first sign-in or recovery, PIN on a device an admin registered. A signed-in app
 * receives the session and the device actions through `RemoteSessionContext`.
 */
export function RemoteAuthGate({ children }: Props) {
  const publicCustomer = usePublicCustomer();
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<SessionStaff | null>(null);
  const [device, setDevice] = useState<DeviceStatus>(UNREGISTERED);
  const [loading, setLoading] = useState(isRemoteDataSource);
  const [fatal, setFatal] = useState("");
  const [passwordMode, setPasswordMode] = useState(false);
  const [notice, setNotice] = useState("");
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const deviceRef = useRef(device);
  deviceRef.current = device;

  const refreshDevice = useCallback(async () => {
    try {
      const next = await fetchDeviceStatus();
      if (deviceRef.current.registered && !next.registered) setNotice(t.app.remoteGate.deviceRevoked);
      setDevice(next);
    } catch {
      // Keep the last known state; the next sign-in attempt re-checks.
    }
  }, []);

  useEffect(() => {
    if (!isRemoteDataSource) return;
    let active = true;
    void Promise.allSettled([fetchSession(), fetchDeviceStatus()]).then(([sessionResult, deviceResult]) => {
      if (!active) return;
      if (deviceResult.status === "fulfilled") setDevice(deviceResult.value);
      if (sessionResult.status === "fulfilled") setSession(sessionResult.value);
      else if (!(sessionResult.reason instanceof RemoteDataError && sessionResult.reason.status === 401))
        setFatal(t.app.remoteGate.unreachable);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  /** Shows `next` as the signed-in staff member. A different identity never inherits the previous one's data or drafts. */
  const adopt = useCallback(
    (next: SessionStaff) => {
      const previous = sessionRef.current;
      if (previous && JSON.stringify(previous) === JSON.stringify(next)) return;
      clearStaffState();
      setNotice("");
      setSession(next);
      if (!previous || previous.id !== next.id) setLocation(defaultRouteFor(next.role));
    },
    [setLocation],
  );

  const endSession = useCallback(() => {
    clearStaffState();
    setSession(null);
    setPasswordMode(false);
    void refreshDevice();
  }, [refreshDevice]);

  // The session cookie is shared by every tab of this browser, and the server may end a session at any time (PIN, role
  // or status changed, device revoked). `reconcile` re-reads it so this tab shows the identity the server will act on;
  // the API stays authoritative for every action either way.
  const reconciling = useRef(false);
  const reconcile = useCallback(async () => {
    if (reconciling.current) return;
    reconciling.current = true;
    try {
      adopt(await fetchSession());
    } catch (cause) {
      if (cause instanceof RemoteDataError && cause.status === 401 && sessionRef.current) {
        endSession();
        toast.info(t.app.remoteGate.sessionEnded);
      }
    } finally {
      reconciling.current = false;
    }
  }, [adopt, endSession]);

  useEffect(() => {
    if (!isRemoteDataSource || publicCustomer) return;
    const onAuthChanged = () => {
      void reconcile();
      void refreshDevice();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void reconcile();
    };
    // A data request answered 401: the session was revoked or expired.
    window.addEventListener(SESSION_REJECTED_EVENT, onAuthChanged);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const stopBus = subscribeSync((message) => {
      if (message.type === "AUTH_CHANGED") onAuthChanged();
    });
    return () => {
      window.removeEventListener(SESSION_REJECTED_EVENT, onAuthChanged);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      stopBus();
    };
  }, [publicCustomer, reconcile, refreshDevice]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      toast.error(t.app.remoteGate.logoutFailed);
      return;
    }
    setNotice("");
    endSession();
    broadcastSync({ type: "AUTH_CHANGED" });
  }, [endSession]);

  const signInWithPin = useCallback(
    async (staffId: string, pin: string) => {
      try {
        await loginWithPin(staffId, pin);
      } catch (cause) {
        // 403: this browser is no longer a registered device (revoked or cookie cleared).
        if (cause instanceof RemoteDataError && cause.status === 403) await refreshDevice();
        throw cause;
      }
      adopt(await fetchSession());
      broadcastSync({ type: "AUTH_CHANGED" });
    },
    [adopt, refreshDevice],
  );

  const signInWithPassword = useCallback(
    async (username: string, password: string) => {
      try {
        await loginWithPassword(username, password);
      } catch (cause) {
        throw cause instanceof RemoteDataError && cause.status === 401 ? new Error(t.app.remoteGate.badCredentials) : cause;
      }
      let next: SessionStaff;
      try {
        next = await fetchSession();
      } catch {
        throw new Error(t.app.remoteGate.sessionFailed);
      }
      adopt(next);
      await refreshDevice();
      broadcastSync({ type: "AUTH_CHANGED" });
    },
    [adopt, refreshDevice],
  );

  const remote = useMemo<RemoteSession | null>(
    () => (session ? { authMethod: session.authMethod ?? "password", device, refreshDevice, signOut, signInWithPin } : null),
    [session, device, refreshDevice, signOut, signInWithPin],
  );

  if (!isRemoteDataSource || publicCustomer) return children();
  if (session && remote)
    return <RemoteSessionContext.Provider value={remote}>{children(toStaffUser(session))}</RemoteSessionContext.Provider>;
  if (loading) {
    return (
      <Shell>
        <LoadingText label={t.app.remoteGate.checkingSession} />
      </Shell>
    );
  }
  if (fatal) {
    return (
      <Shell>
        <Heading title={t.app.remoteGate.title} />
        <p role="alert" className="text-sm text-error-dark">
          {fatal}
        </p>
        <Button className="w-full" onClick={() => window.location.reload()}>
          {t.common.retry}
        </Button>
      </Shell>
    );
  }
  if (device.registered && !passwordMode) {
    return <PinScreen device={device} onSignIn={signInWithPin} onUsePassword={() => setPasswordMode(true)} />;
  }
  return (
    <PasswordLogin onSubmit={signInWithPassword} notice={notice} onUsePin={device.registered ? () => setPasswordMode(false) : undefined} />
  );
}
