import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TabFacturasEntrantes } from "@/features/embarques/components/TabFacturasEntrantes";

/**
 * v13.489.0 — Segregación de funciones en el buzón del embarque: operaciones
 * entrega los PDF/XML del agente; contabilidad sólo consulta y captura después
 * la factura en CxP. Espejo de la política RLS de INSERT en
 * `embarque_facturas_entrantes`.
 */
const permisos = { isAdmin: false, canSubirFacturaEntranteEmbarque: false };

vi.mock("@/hooks/shared/usePermissions", () => ({
  usePermissions: () => permisos,
}));
vi.mock("@/hooks/shared/useOrgFilter", () => ({
  useOrgFilter: () => ({ organizationId: "org-1" }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/features/cxp/hooks/useFacturasEntrantes", () => ({
  useFacturasEntrantes: () => ({ data: [], isLoading: false }),
  useEliminarFacturaEntrante: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdjuntarXmlFacturaEntrante: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSubirFacturaEntrante: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReactivarFacturaEntrante: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// El diálogo de subida consulta costos del proveedor vía react-query.
const renderTab = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TabFacturasEntrantes embarqueId="e1" canEdit /></MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("<TabFacturasEntrantes /> permisos de subida", () => {
  beforeEach(() => {
    permisos.isAdmin = false;
    permisos.canSubirFacturaEntranteEmbarque = false;
  });

  it("operaciones ve el botón de subir factura", () => {
    permisos.canSubirFacturaEntranteEmbarque = true;
    renderTab();
    expect(screen.getByRole("button", { name: /subir factura/i })).toBeInTheDocument();
  });

  it("un rol contable no ve el botón y recibe la explicación", () => {
    renderTab();
    expect(screen.queryByRole("button", { name: /subir factura/i })).not.toBeInTheDocument();
    expect(screen.getByText(/la entrega de archivos la hace operaciones/i)).toBeInTheDocument();
  });
});
