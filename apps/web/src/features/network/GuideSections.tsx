import { CheckCircle2, ChefHat, Laptop, Radio, Server, ShieldCheck, Smartphone, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "../../locales/id";
import type { NetworkHostInfo } from "../../services/networkHost";
import { RichText } from "./RichText";

export type GuideTab = keyof typeof t.network.guide.tabs;

interface GuideSectionProps {
  hostInfo: NetworkHostInfo;
  /** Example `host:port` built from the detected address, used in instructions. */
  exampleAddress: string;
}

const GUIDE = t.network.guide;

function Card({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-clay">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
        <Icon size={16} className="text-accent-dark" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Callout({ tone, icon: Icon, title, children }: { tone: "success" | "warning"; icon: LucideIcon; title: string; children: ReactNode }) {
  const toneClass = tone === "success" ? "border-success/30 bg-success/10 text-success-dark" : "border-warning/40 bg-warning/10 text-warning-dark";
  return (
    <div className={`space-y-1.5 rounded-xl border p-4 ${toneClass}`}>
      <p className="flex items-center gap-1.5 font-bold">
        <Icon size={15} aria-hidden="true" /> {title}
      </p>
      {children}
    </div>
  );
}

function Marker({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{children}</span>
  );
}

const NODE_ICONS: Record<(typeof GUIDE.flow.nodes)[number]["id"], LucideIcon> = {
  host: Laptop,
  waiter: Smartphone,
  kitchen: ChefHat,
};

function FlowSection({ hostInfo }: GuideSectionProps) {
  return (
    <div className="space-y-4">
      <Card title={GUIDE.flow.title} icon={Radio}>
        <p className="leading-relaxed text-text-muted">
          <RichText text={GUIDE.flow.intro} />
        </p>
        <ul className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
          {GUIDE.flow.nodes.map((node) => {
            const Icon = NODE_ICONS[node.id];
            const address = "path" in node ? node.path : hostInfo.baseUrl;
            return (
              <li key={node.id} className="flex flex-col items-center rounded-xl border border-border bg-mineral/30 p-3.5 text-center">
                <div
                  className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${node.id === "kitchen" ? "bg-warning text-ink" : "bg-accent text-white"}`}
                >
                  <Icon size={20} aria-hidden="true" />
                </div>
                <p className="text-xs font-bold text-ink">{node.title}</p>
                <p className="mt-1 text-xs2 text-text-muted">{node.body}</p>
                <span className="mt-2 rounded border border-border bg-surface px-2 py-0.5 font-mono text-2xs font-bold">{address}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Callout tone="success" icon={CheckCircle2} title={GUIDE.flow.benefitsTitle}>
        <ul className="list-inside list-disc space-y-1">
          {GUIDE.flow.benefits.map((benefit) => (
            <li key={benefit}>
              <RichText text={benefit} />
            </li>
          ))}
        </ul>
      </Callout>
    </div>
  );
}

function SetupSection({ hostInfo }: GuideSectionProps) {
  return (
    <Card title={GUIDE.setup.title} icon={Server}>
      <ol className="space-y-3">
        {GUIDE.setup.steps(hostInfo.port).map((step, index) => (
          <li key={step.title} className="flex items-start gap-3 rounded-xl border border-border bg-mineral/30 p-3">
            <Marker>{index + 1}</Marker>
            <div>
              <p className="font-bold text-ink">{step.title}</p>
              <p className="mt-0.5 text-text-muted">{step.body}</p>
              {"showAddress" in step && (
                <code className="mt-1.5 inline-block rounded border border-border bg-surface px-2.5 py-1 font-mono text-xs font-bold text-ink">
                  {hostInfo.baseUrl}
                </code>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function WaiterSection() {
  return (
    <Card title={GUIDE.waiter.title} icon={Smartphone}>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {GUIDE.waiter.steps.map((step, index) => (
          <li key={step.title} className="space-y-2 rounded-xl border border-border bg-mineral/20 p-3.5">
            <p className="flex items-center gap-1.5 font-bold text-ink">
              <Marker>{String.fromCharCode(65 + index)}</Marker>
              {step.title}
            </p>
            <p className="text-xs2 leading-relaxed text-text-muted">
              <RichText text={step.body} />
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function OfflineSection() {
  return (
    <div className="space-y-4">
      <Card title={GUIDE.offline.title} icon={Zap}>
        <p className="leading-relaxed text-text-muted">
          <RichText text={GUIDE.offline.intro} />
        </p>
        <ol className="list-inside list-decimal space-y-2 rounded-xl border border-border bg-mineral/30 p-4 text-ink">
          {GUIDE.offline.steps.map((step) => (
            <li key={step}>
              <RichText text={step} />
            </li>
          ))}
        </ol>
      </Card>
      <Callout tone="warning" icon={ShieldCheck} title={GUIDE.offline.noteTitle}>
        <p className="text-xs2">{GUIDE.offline.note}</p>
      </Callout>
    </div>
  );
}

function TroubleshootSection({ hostInfo, exampleAddress }: GuideSectionProps) {
  return (
    <ul className="space-y-3">
      {GUIDE.troubleshoot.items(hostInfo.port, exampleAddress).map((item) => (
        <li key={item.title} className="space-y-1.5 rounded-xl border border-border bg-surface p-4 shadow-clay">
          <p className="flex items-center gap-2 font-bold text-ink">
            <TriangleAlert size={15} className="text-warning-dark" aria-hidden="true" />
            {item.title}
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs2 leading-relaxed text-text-muted">
            {item.lines.map((line) => (
              <li key={line}>
                <RichText text={line} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function GuideSection({ tab, ...props }: GuideSectionProps & { tab: GuideTab }) {
  switch (tab) {
    case "flow":
      return <FlowSection {...props} />;
    case "setup":
      return <SetupSection {...props} />;
    case "waiter":
      return <WaiterSection />;
    case "offline":
      return <OfflineSection />;
    case "troubleshoot":
      return <TroubleshootSection {...props} />;
  }
}
