import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Embarques from "./pages/Embarques";
import EmbarqueDetalle from "./pages/EmbarqueDetalle";
import NuevoEmbarque from "./pages/NuevoEmbarque";
import Facturacion from "./pages/Facturacion";
import Clientes from "./pages/Clientes";
import ClienteDetalle from "./pages/ClienteDetalle";
import Proveedores from "./pages/Proveedores";
import ProveedorDetalle from "./pages/ProveedorDetalle";
import Reportes from "./pages/Reportes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/embarques" element={<Embarques />} />
            <Route path="/embarques/nuevo" element={<NuevoEmbarque />} />
            <Route path="/embarques/:id" element={<EmbarqueDetalle />} />
            <Route path="/facturacion" element={<Facturacion />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalle />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
            <Route path="/reportes" element={<Reportes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
