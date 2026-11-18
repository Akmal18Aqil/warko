import { type ComponentType, type LazyExoticComponent, lazy, type ReactNode, Suspense } from "react";
import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import { isRemoteDataSource } from "../data/api";
import { PrintLayer } from "../features/printing/PrintLayer";
import { t } from "../locales/id";
import { AuthProvider } from "../state/auth";
import { DataSync } from "../state/DataSync";
import { PrintProvider } from "../state/print";
import { AppLayout } from "./AppLayout";
import { QuickSwitchRoleModal } from "./QuickSwitchRoleModal";
import { RemoteAuthGate } from "./RemoteAuthGate";
import { RemoteSwitchModal } from "./RemoteSwitchModal";
import { RouteFallback } from "./RouteFallback";
import { RouteGuard } from "./RouteGuard";

// Each screen is its own chunk: the public /order page never downloads the staff app.
const PosPage = lazy(() => import("../features/pos/PosPage"));
const OrdersPage = lazy(() => import("../features/orders/OrdersPage"));
const TablesPage = lazy(() => import("../features/tables/TablesPage"));
const ProductsPage = lazy(() => import("../features/products/ProductsPage"));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const KitchenPage = lazy(() => import("../features/kitchen/KitchenPage"));
const CustomerSelfOrderPage = lazy(() => import("../features/self-order/CustomerSelfOrderPage"));
const WaiterOrderPage = lazy(() => import("../features/waiter/WaiterOrderPage"));
const CashDrawerPage = lazy(() => import("../features/cash-drawer/CashDrawerPage"));

function Screen({ page: Page }: { page: LazyExoticComponent<ComponentType> }): ReactNode {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Page />
    </Suspense>
  );
}

function Guarded({ path, moduleName, page }: { path: string; moduleName: string; page: LazyExoticComponent<ComponentType> }) {
  return (
    <RouteGuard path={path} moduleName={moduleName}>
      <Screen page={page} />
    </RouteGuard>
  );
}

export default function App() {
  return (
    <RemoteAuthGate>
      {(remoteStaff) => (
        // Any change of the signed-in staff member (switch, unlock, role or name change) remounts the app so nothing from the previous identity stays on screen.
        <AuthProvider key={remoteStaff ? JSON.stringify(remoteStaff) : "local"} remoteStaff={remoteStaff}>
          <DataSync />
          <PrintProvider>
            <Switch>
              {/* Public customer self-order (QR on the table) */}
              <Route path="/order">
                <Screen page={CustomerSelfOrderPage} />
              </Route>
              <Route path="/order/:tableId">
                <Screen page={CustomerSelfOrderPage} />
              </Route>

              {/* Full-screen focus modes */}
              <Route path="/pelayan">
                <Guarded path="/pelayan" moduleName={t.app.routes.waiter} page={WaiterOrderPage} />
              </Route>
              <Route path="/dapur">
                <Guarded path="/dapur" moduleName={t.app.routes.kitchen} page={KitchenPage} />
              </Route>

              {/* Dashboard with the role-filtered sidebar */}
              <Route>
                <AppLayout>
                  <Switch>
                    <Route path="/laci-kas">
                      <Guarded path="/laci-kas" moduleName={t.app.routes.cashDrawer} page={CashDrawerPage} />
                    </Route>
                    <Route path="/pesanan">
                      <Guarded path="/pesanan" moduleName={t.app.routes.orders} page={OrdersPage} />
                    </Route>
                    <Route path="/meja">
                      <Guarded path="/meja" moduleName={t.app.routes.tables} page={TablesPage} />
                    </Route>
                    <Route path="/produk">
                      <Guarded path="/produk" moduleName={t.app.routes.products} page={ProductsPage} />
                    </Route>
                    <Route path="/laporan">
                      <Guarded path="/laporan" moduleName={t.app.routes.reports} page={ReportsPage} />
                    </Route>
                    <Route path="/pengaturan">
                      <Guarded path="/pengaturan" moduleName={t.app.routes.settings} page={SettingsPage} />
                    </Route>
                    <Route>
                      <Guarded path="/" moduleName={t.app.routes.pos} page={PosPage} />
                    </Route>
                  </Switch>
                </AppLayout>
              </Route>
            </Switch>

            {isRemoteDataSource ? <RemoteSwitchModal /> : <QuickSwitchRoleModal />}
            <PrintLayer />
            <Toaster position="top-center" richColors closeButton duration={3200} />
          </PrintProvider>
        </AuthProvider>
      )}
    </RemoteAuthGate>
  );
}
