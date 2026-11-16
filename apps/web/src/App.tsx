import { Route, Switch } from "wouter";
import { Toaster } from "sonner";
import { PosProvider } from "./components/PosContext";
import { PrintProvider } from "./components/PrintContext";
import { AuthProvider } from "./components/AuthContext";
import { RemoteAuthGate } from "./components/RemoteAuthGate";
import { PrintLayer } from "./components/PrintLayer";
import { QuickSwitchRoleModal } from "./components/QuickSwitchRoleModal";
import { RouteGuard } from "./components/RouteGuard";
import Home from "./pages/Home";
import Orders from "./pages/Orders";
import Tables from "./pages/Tables";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Kitchen from "./pages/Kitchen";
import CustomerSelfOrder from "./pages/CustomerSelfOrder";
import WaiterOrder from "./pages/WaiterOrder";
import CashDrawer from "./pages/CashDrawer";
import { AppLayout } from "./layouts/AppLayout";

export default function App() {
  return (
    <RemoteAuthGate>{(remoteStaff) => <AuthProvider remoteStaff={remoteStaff}>
      <PosProvider>
        <PrintProvider>
          <Switch>
            {/* 1. Standalone Customer Self-Order QR */}
            <Route path="/order" component={CustomerSelfOrder} />
            <Route path="/order/:tableId" component={CustomerSelfOrder} />

            {/* 2. Standalone Fullscreen Focus Mode for Waiter */}
            <Route path="/pelayan">
              <RouteGuard path="/pelayan" moduleName="Mode Pelayan">
                <WaiterOrder />
              </RouteGuard>
            </Route>

            {/* 3. Standalone Fullscreen Focus Mode for Kitchen KDS */}
            <Route path="/dapur">
              <RouteGuard path="/dapur" moduleName="Layar Dapur (KDS)">
                <Kitchen />
              </RouteGuard>
            </Route>

            {/* 4. Standard Dashboard with Dynamic Role-Filtered Sidebar */}
            <Route>
              <AppLayout>
                <Switch>
                  <Route path="/">
                    <RouteGuard path="/" moduleName="POS Kasir Utama">
                      <Home />
                    </RouteGuard>
                  </Route>
                  <Route path="/laci-kas">
                    <RouteGuard path="/laci-kas" moduleName="Laci Kas & Rekonsiliasi">
                      <CashDrawer />
                    </RouteGuard>
                  </Route>
                  <Route path="/pesanan">
                    <RouteGuard path="/pesanan" moduleName="Daftar Pesanan">
                      <Orders />
                    </RouteGuard>
                  </Route>
                  <Route path="/meja">
                    <RouteGuard path="/meja" moduleName="Manajemen Meja">
                      <Tables />
                    </RouteGuard>
                  </Route>
                  <Route path="/produk">
                    <RouteGuard path="/produk" moduleName="Katalog & Produk">
                      <Products />
                    </RouteGuard>
                  </Route>
                  <Route path="/laporan">
                    <RouteGuard path="/laporan" moduleName="Laporan Penjualan">
                      <Reports />
                    </RouteGuard>
                  </Route>
                  <Route path="/pengaturan">
                    <RouteGuard path="/pengaturan" moduleName="Pengaturan Sistem">
                      <Settings />
                    </RouteGuard>
                  </Route>
                  <Route>
                    <RouteGuard path="/" moduleName="POS Kasir Utama">
                      <Home />
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
      </PosProvider>
    </AuthProvider>}</RemoteAuthGate>
  );
}
