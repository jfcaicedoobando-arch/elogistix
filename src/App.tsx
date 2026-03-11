import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import RouteLoadingFallback from "./components/RouteLoadingFallback";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Operaciones = lazy(() => import("./pages/Operaciones"));
const Embarques = lazy(() => import("./pages/Embarques"));
const EmbarqueDetalle = lazy(() => import("./pages/EmbarqueDetalle"));
const NuevoEmbarque = lazy(() => import("./pages/NuevoEmbarque"));
const EditarEmbarque = lazy(() => import("./pages/EditarEmbarque"));
const Facturacion = lazy(() => import("./pages/Facturacion"));
const Clientes = lazy(() => import("./pages/Clientes"));
const ClienteDetalle = lazy(() => import("./pages/ClienteDetalle"));
const Proveedores = lazy(() => import("./pages/Proveedores"));
const ProveedorDetalle = lazy(() => import("./pages/ProveedorDetalle"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Cotizaciones = lazy(() => import("./pages/Cotizaciones"));
const NuevaCotizacion = lazy(() => import("./pages/NuevaCotizacion"));
const CotizacionDetalle = lazy(() => import("./pages/CotizacionDetalle"));
const EditarCotizacion = lazy(() => import("./pages/EditarCotizacion"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Bitacora = lazy(() => import("./pages/Bitacora"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Configuracion = lazy(() => import("./pages/Configuracion"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
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
              <Route path="/reportes" element={<Reportes />} />
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
