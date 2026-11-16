import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import type { StaffRole, StaffUser } from "./AuthContext";
import { isRemoteDataSource } from "../lib/remote";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isRemoteDataSource);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isRemoteDataSource) return;
    let active = true;
    fetch(`${API_BASE}/auth/session`, { credentials: "same-origin" })
      .then(async (response) => response.ok ? (await response.json()).data as Session : null)
      .then((value) => { if (active) setSession(value); })
      .catch(() => { if (active) setError("Server tidak dapat dijangkau."); })
      .finally(() => { if (active) setLoading(false); });
    const logout = () => {
      void fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "same-origin" })
        .then((response) => { if (!response.ok) throw new Error(); setSession(null); })
        .catch(() => toast.error("Gagal keluar. Coba lagi."));
    };
    window.addEventListener("kasa-remote-logout", logout);
    return () => { active = false; window.removeEventListener("kasa-remote-logout", logout); };
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
      if (!response.ok) throw new Error("Nama pengguna atau kata sandi tidak benar.");
      const current = await fetch(`${API_BASE}/auth/session`, { credentials: "same-origin" });
      if (!current.ok) throw new Error("Sesi tidak dapat dibuka.");
      setSession((await current.json()).data as Session);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Server tidak dapat dijangkau.");
    } finally {
      setLoading(false);
    }
  }

  if (isRemoteDataSource && /^\/order(?:\/|$)/.test(window.location.pathname)) return children();
  if (!isRemoteDataSource) return children();
  if (session) return children({ ...session, pin: "" });
  return (
    <main className="flex min-h-screen items-center justify-center bg-mineral p-4">
      <form onSubmit={login} className="w-full max-w-sm space-y-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <h1 className="font-display text-xl font-bold text-ink">Masuk staf</h1>
        <label className="block text-sm font-semibold text-ink">Nama pengguna
          <input className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label className="block text-sm font-semibold text-ink">Kata sandi
          <input className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <button className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" disabled={loading}>{loading ? "Memuat..." : "Masuk"}</button>
      </form>
    </main>
  );
}
