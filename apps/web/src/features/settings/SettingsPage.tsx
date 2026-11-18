import { Header } from "../../app/Header";
import { isRemoteDataSource } from "../../data/index";
import { t } from "../../locales/id";
import { useAuth } from "../../state/auth";
import { isDemoMode } from "../../state/demo";
import { PageHeader } from "../../ui/PageHeader";
import { BackupCard } from "./BackupCard";
import { DemoStaffCard } from "./DemoStaffCard";
import { NetworkCard } from "./NetworkCard";
import { PricingCard } from "./PricingCard";
import { PrinterCard } from "./PrinterCard";
import { RemoteDeviceManager } from "./RemoteDeviceManager";
import { RemoteStaffManager } from "./RemoteStaffManager";
import { ShiftLinkCard } from "./ShiftLinkCard";
import { StoreCard } from "./StoreCard";

export default function SettingsPage() {
  const { currentStaff } = useAuth();

  return (
    <div className="service-rail-surface flex min-h-screen flex-col">
      <Header title={t.settings.title} />
      <div className="flex-1 space-y-5 p-5 md:p-8">
        <PageHeader subtitle={t.settings.subtitle} subtitleClassName="text-sm" className="mb-0" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:max-w-4xl">
          <StoreCard />
          <PrinterCard />
          <PricingCard />
          <ShiftLinkCard />
          <NetworkCard />
          <BackupCard />
        </div>
        {isDemoMode && (
          <div className="lg:max-w-4xl">
            <DemoStaffCard />
          </div>
        )}
        {isRemoteDataSource && currentStaff.role === "admin" && (
          <div className="space-y-4 lg:max-w-4xl">
            <RemoteStaffManager currentStaffId={currentStaff.id} />
            <RemoteDeviceManager />
          </div>
        )}
      </div>
    </div>
  );
}
