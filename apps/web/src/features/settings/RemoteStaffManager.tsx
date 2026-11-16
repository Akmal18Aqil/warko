import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { StaffRole } from "@wakro/shared";
import { API_BASE } from "../data/api";

type Staff = { id: string; username: string; name: string; role: StaffRole; active: boolean };

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload.errors ? Object.values(payload.errors).flat().join(" ") : payload.message;
    throw new Error(typeof detail === "string" ? detail : "Permintaan gagal.");
  }
  return payload.data as T;
}

export function RemoteStaffManager({ currentStaffId }: { currentStaffId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("pelayan");

  const refresh = useCallback(async () => {
    try { setStaff(await call<Staff[]>("/staff")); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Tidak dapat memuat staf."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  function clearForm() {
    setEditing(null); setName(""); setUsername(""); setPassword(""); setRole("pelayan");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const data = { name, username, role, ...(password ? { password } : {}) };
      await call(`/staff${editing ? `/${encodeURIComponent(editing)}` : ""}`, editing ? "PATCH" : "POST", data);
      if (editing === currentStaffId && password) {
        window.location.reload();
        return;
      }
      clearForm();
      setMessage("Data staf disimpan.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tidak dapat menyimpan staf."); }
    finally { setBusy(false); }
  }
  async function toggle(member: Staff) {
    setBusy(true); setError(""); setMessage("");
    try {
      await call(`/staff/${encodeURIComponent(member.id)}`, "PATCH", { active: !member.active });
      setMessage(member.active ? "Akun staf dinonaktifkan." : "Akun staf diaktifkan.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tidak dapat mengubah staf."); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-xl border border-ink/10 bg-white p-5 shadow-xs" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="font-display text-lg font-bold text-ink">Akun staf</h2>
      <p className="mt-1 text-sm text-ink/60">Akun dikelola di server. Perubahan peran dan kata sandi mengakhiri sesi staf.</p>
      {loading ? <p className="mt-4 text-sm">Memuat staf...</p> : staff.length === 0 ? <p className="mt-4 text-sm">Belum ada staf.</p> : (
        <ul className="mt-4 divide-y divide-ink/10">
          {staff.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-semibold">{member.name}</p><p className="text-sm text-ink/60">{member.username} · {member.role} · {member.active ? "Aktif" : "Nonaktif"}</p></div>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg border border-ink/20 px-3 py-2 text-sm" onClick={() => { setEditing(member.id); setName(member.name); setUsername(member.username); setRole(member.role); setPassword(""); }}>Ubah</button>
                <button type="button" disabled={busy} className="rounded-lg border border-ink/20 px-3 py-2 text-sm disabled:opacity-50" onClick={() => void toggle(member)}>{member.active ? "Nonaktifkan" : "Aktifkan"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-5 grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2">
        <h3 className="font-semibold sm:col-span-2">{editing ? "Ubah akun staf" : "Tambah staf"}</h3>
        <label className="text-sm">Nama<input className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="text-sm">Nama pengguna<input className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2" required pattern="[a-z0-9._-]{3,80}" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label className="text-sm">Peran<select className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2" value={role} onChange={(event) => setRole(event.target.value as StaffRole)}><option value="pelayan">Pelayan</option><option value="dapur">Dapur</option><option value="kasir">Kasir</option><option value="manajer">Manajer</option><option value="admin">Admin</option></select></label>
        <label className="text-sm">{editing ? "Kata sandi baru (opsional)" : "Kata sandi"}<input className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2" type="password" autoComplete="new-password" minLength={12} maxLength={256} required={!editing} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <p className="text-xs text-ink/60 sm:col-span-2">Minimal 12 karakter, tidak memuat nama pengguna.</p>
        {error && <p className="text-sm text-rose-700 sm:col-span-2" role="alert">{error}</p>}
        {message && <p className="text-sm text-emerald-700 sm:col-span-2" role="status">{message}</p>}
        <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">Simpan</button>{editing && <button type="button" className="rounded-lg border border-ink/20 px-4 py-2" onClick={clearForm}>Batal</button>}</div>
      </form>
    </section>
  );
}
