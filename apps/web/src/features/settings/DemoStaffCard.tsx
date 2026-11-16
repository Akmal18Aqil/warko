import { Users } from "lucide-react";
import { t } from "../../locales/id";
import { DEMO_STAFF } from "../../state/demoStaff";
import { Badge } from "../../ui/Badge";

/** Read-only list of the demo staff with their PINs; production accounts are managed on the server instead. */
export function DemoStaffCard() {
  const text = t.settings.demoStaff;

  return (
    <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-clay" aria-labelledby="demo-staff-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <Users size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 id="demo-staff-title" className="font-display text-base font-bold text-ink">
            {text.title}
          </h2>
          <p className="mt-0.5 text-xs text-ink/50">{text.intro}</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-sm">
          <thead>
            <tr className="label-caps text-xs2 font-semibold text-ink/50">
              <th scope="col" className="py-2 pr-3 font-semibold">{text.name}</th>
              <th scope="col" className="py-2 pr-3 font-semibold">{text.role}</th>
              <th scope="col" className="py-2 font-semibold">{text.pin}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {DEMO_STAFF.map((staff) => (
              <tr key={staff.id}>
                <td className="py-2.5 pr-3 font-semibold text-ink">{staff.name}</td>
                <td className="py-2.5 pr-3">
                  <Badge tone="accent">{t.settings.staff.roles[staff.role]}</Badge>
                </td>
                <td className="py-2.5 font-mono font-bold text-ink">{staff.pin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
