import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

describe("<TabFacturasEntrantes /> permisos de subida", () => {
  beforeEach(() => {
    permisos.isAdmin = false;
    permisos.canSubirFacturaEntranteEmbarque = false;
  });

  it("operaciones ve el botón de subir factura", () => {
    permisos.canSubirFacturaEntranteEmbarque = true;
    render(<MemoryRouter><TabFacturasEntrantes embarqueId="e1" canEdit /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /subir factura/i })).toBeInTheDocument();
  });

  it("un rol contable no ve el botón y recibe la explicación", () => {
    render(<MemoryRouter><TabFacturasEntrantes embarqueId="e1" canEdit /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /subir factura/i })).not.toBeInTheDocument();
    expect(screen.getByText(/la entrega de archivos la hace operaciones/i)).toBeInTheDocument();
  });
});
