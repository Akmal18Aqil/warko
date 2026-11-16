import { t } from "../locales/id";
import { LoadingText } from "../ui/Spinner";

export function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingText label={t.app.layout.loadingPage} className="text-sm font-semibold" />
    </div>
  );
}
