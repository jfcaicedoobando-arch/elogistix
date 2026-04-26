import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PortalProtectedRoute } from "./components/auth/PortalProtectedRoute";
import RouteLoadingFallback from "./components/layout/RouteLoadingFallback";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/auth/Login"));
const NotFound = lazy(() => import("./pages/auth/NotFound"));
const TrackingPublico = lazy(() => import("./pages/auth/TrackingPublico"));

const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Operaciones = lazy(() => import("./pages/dashboard/Operaciones"));
const Reportes = lazy(() => import("./pages/dashboard/Reportes"));
const Bitacora = lazy(() => import("./pages/dashboard/Bitacora"));
const Changelog = lazy(() => import("./pages/dashboard/Changelog"));

const Embarques = lazy(() => import("./pages/embarques/Embarques"));
const EmbarqueDetalle = lazy(() => import("./pages/embarques/EmbarqueDetalle"));
const NuevoEmbarque = lazy(() => import("./pages/embarques/NuevoEmbarque"));
const EditarEmbarque = lazy(() => import("./pages/embarques/EditarEmbarque"));

const Cotizaciones = lazy(() => import("./pages/cotizaciones/Cotizaciones"));
const NuevaCotizacion = lazy(() => import("./pages/cotizaciones/NuevaCotizacion"));
const CotizacionDetalle = lazy(() => import("./pages/cotizaciones/CotizacionDetalle"));
const EditarCotizacion = lazy(() => import("./pages/cotizaciones/EditarCotizacion"));

const Clientes = lazy(() => import("./pages/clientes/Clientes"));
const ClienteDetalle = lazy(() => import("./pages/clientes/ClienteDetalle"));

const Proveedores = lazy(() => import("./pages/proveedores/Proveedores"));
const ProveedorDetalle = lazy(() => import("./pages/proveedores/ProveedorDetalle"));

const Facturacion = lazy(() => import("./pages/facturacion/Facturacion"));

const Usuarios = lazy(() => import("./pages/admin-org/Usuarios"));
const Configuracion = lazy(() => import("./pages/admin-org/Configuracion"));


// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrganizaciones = lazy(() => import("./pages/admin/AdminOrganizaciones"));
const AdminOrgDetalle = lazy(() => import("./pages/admin/AdminOrgDetalle"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminConfiguracion = lazy(() => import("./pages/admin/AdminConfiguracion"));

// Portal pages

const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalEmbarques = lazy(() => import("./pages/portal/PortalEmbarques"));
const PortalEmbarqueDetalle = lazy(() => import("./pages/portal/PortalEmbarqueDetalle"));
const PortalCotizaciones = lazy(() => import("./pages/portal/PortalCotizaciones"));
const PortalCotizacionDetalle = lazy(() => import("./pages/portal/PortalCotizacionDetalle"));
const PortalFacturas = lazy(() => import("./pages/portal/PortalFacturas"));
const TrackingPublico = lazy(() => import("./pages/TrackingPublico"));

// Admin layout
import { AdminLayout } from "./components/admin/AdminLayout";
import PortalLayout from "./components/portal/PortalLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/portal/login" element={<Navigate to="/login" replace />} />
            <Route path="/tracking/:token" element={<TrackingPublico />} />

            {/* Portal routes — cliente only */}
            <Route
              element={
                <PortalProtectedRoute>
                  <PortalLayout />
                </PortalProtectedRoute>
              }
            >
              <Route path="/portal" element={<PortalDashboard />} />
              <Route path="/portal/embarques" element={<PortalEmbarques />} />
              <Route path="/portal/embarques/:id" element={<PortalEmbarqueDetalle />} />
              <Route path="/portal/cotizaciones" element={<PortalCotizaciones />} />
              <Route path="/portal/cotizaciones/:id" element={<PortalCotizacionDetalle />} />
              <Route path="/portal/facturas" element={<PortalFacturas />} />
            </Route>

            {/* Admin routes — super_admin only */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/organizaciones" element={<AdminOrganizaciones />} />
              <Route path="/admin/organizaciones/:id" element={<AdminOrgDetalle />} />
              <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              <Route path="/admin/configuracion" element={<AdminConfiguracion />} />
            </Route>

            {/* Regular app routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/operaciones" element={<Operaciones />} />
              <Route path="/embarques" element={<Embarques />} />
              <Route path="/embarques/nuevo" element={<NuevoEmbarque />} />
              <Route path="/embarques/:id" element={<EmbarqueDetalle />} />
              <Route path="/embarques/:id/editar" element={<EditarEmbarque />} />
              <Route path="/facturacion" element={<Facturacion />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/:id" element={<ClienteDetalle />} />
              <Route path="/proveedores" element={<Proveedores />} />
              <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
              <Route path="/cotizaciones" element={<Cotizaciones />} />
              <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
              <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
              <Route path="/cotizaciones/:id/editar" element={<EditarCotizacion />} />
              <Route path="/reportes/rentabilidad" element={<Reportes />} />
              
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/bitacora" element={<Bitacora />} />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Usuarios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Configuracion />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
