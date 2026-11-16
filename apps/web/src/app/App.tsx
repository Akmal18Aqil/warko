import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { PrintProvider } from "./components/PrintContext";
import { AuthProvider } from "./components/AuthContext";
import { RemoteAuthGate } from "./components/RemoteAuthGate";
import { PrintLayer } from "./components/PrintLayer";
import { QuickSwitchRoleModal } from "./components/QuickSwitchRoleModal";
import { RouteFallback } from "./components/RouteFallback";
import { RouteGuard } from "./components/RouteGuard";
import { AppLayout } from "./layouts/AppLayout";
import { DataSync } from "./state/DataSync";

// Each screen is its own chunk: the public /order page never downloads the staff app.
const Home = lazy(() => import("./pages/Home"));
const Orders = lazy(() => import("./pages/Orders"));
const Tables = lazy(() => import("./pages/Tables"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Kitchen = lazy(() => import("./pages/Kitchen"));
const CustomerSelfOrder = lazy(() => import("./pages/CustomerSelfOrder"));
const WaiterOrder = lazy(() => import("./pages/WaiterOrder"));
const CashDrawer = lazy(() => import("./pages/CashDrawer"));

export default function App() {
  return (
    <RemoteAuthGate>{(remoteStaff) => <AuthProvider remoteStaff={remoteStaff}>
      <DataSync />
      <PrintProvider>
        <Switch>
          {/* 1. Standalone Customer Self-Order QR */}
          <Route path="/order">
            <Suspense fallback={<RouteFallback />}>
              <CustomerSelfOrder />
            </Suspense>
          </Route>
          <Route path="/order/:tableId">
            <Suspense fallback={<RouteFallback />}>
              <CustomerSelfOrder />
            </Suspense>
          </Route>

          {/* 2. Standalone Fullscreen Focus Mode for Waiter */}
          <Route path="/pelayan">
            <RouteGuard path="/pelayan" moduleName="Mode Pelayan">
              <Suspense fallback={<RouteFallback />}>
                <WaiterOrder />
              </Suspense>
            </RouteGuard>
          </Route>

          {/* 3. Standalone Fullscreen Focus Mode for Kitchen KDS */}
          <Route path="/dapur">
            <RouteGuard path="/dapur" moduleName="Layar Dapur (KDS)">
              <Suspense fallback={<RouteFallback />}>
                <Kitchen />
              </Suspense>
            </RouteGuard>
          </Route>

          {/* 4. Standard Dashboard with Dynamic Role-Filtered Sidebar */}
          <Route>
            <AppLayout>
              <Switch>
                <Route path="/">
                  <RouteGuard path="/" moduleName="POS Kasir Utama">
                    <Suspense fallback={<RouteFallback />}>
                      <Home />
                    </Suspense>
                  </RouteGuard>
                </Route>
                <Route path="/laci-kas">
                  <RouteGuard path="/laci-kas" moduleName="Laci Kas & Rekonsiliasi">
                    <Suspense fallback={<RouteFallback />}>
                      <CashDrawer />
                    </Suspense>
                  </RouteGuard>
                </Route>
                <Route path="/pesanan">
                  <RouteGuard path="/pesanan" moduleName="Daftar Pesanan">
                    <Suspense fallback={<RouteFallback />}>
                      <Orders />
                    </Suspense>
                  </RouteGuard>
                </Route>
                <Route path="/meja">
                  <RouteGuard path="/meja" moduleName="Manajemen Meja">
                    <Suspense fallback={<RouteFallback />}>
                      <Tables />
                    </Suspense>
                  </RouteGuard>
                </Route>
                <Route path="/produk">
                  <RouteGuard path="/produk" moduleName="Katalog & Produk">
                    <Suspense fallback={<RouteFallback />}>
                      <Products />
                    </Suspense>
                  </RouteGuard>
                </Route>
                <Route path="/laporan">
                  <RouteGuard path="/laporan" moduleName="Laporan Penjualan">
                    <Suspense fallback={<RouteFallback />}>
                      <Reports />
                    </Suspense>
                  </RouteGuard>
                </Route>
                <Route path="/pengaturan">
                  <RouteGuard path="/pengaturan" moduleName="Pengaturan Sistem">
                    <Suspense fallback={<RouteFallback />}>
                      <Settings />
                    </Suspense>
                  </RouteGuard>
                </Route>
                <Route>
                  <RouteGuard path="/" moduleName="POS Kasir Utama">
                    <Suspense fallback={<RouteFallback />}>
                      <Home />
                    </Suspense>
                  </RouteGuard>
                </Route>
              </Switch>
            </AppLayout>
          </Route>
        </Switch>

        <QuickSwitchRoleModal />
        <PrintLayer />
        <Toaster position="top-center" richColors closeButton duration={3200} />
      </PrintProvider>
    </AuthProvider>}</RemoteAuthGate>
  );
}
