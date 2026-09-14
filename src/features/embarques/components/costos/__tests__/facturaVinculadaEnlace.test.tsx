/**
 * B1 (v13.823.394): el folio de la factura vinculada al expediente es visible
 * para los roles operativos, pero SIN enlace al módulo de CxP.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: vi.fn() }));

import { usePermissions } from "@/hooks/shared/usePermissions";
import { GrupoCostosFacturasCell } from "../GrupoCostosFacturasCell";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";

const mockPerms = vi.mocked(usePermissions);

type Permisos = ReturnType<typeof usePermissions>;
const permisos = (canViewFinancials: boolean) =>
  ({ canViewFinancials, canViewCosts: true }) as Partial<Permisos> as Permisos;

const fila = {
  concepto: "Flete",
  moneda: "USD",
  facturas: [
    {
      proveedor_factura_id: "pf-1",
      folio_interno: "FP-000123",
      folio_proveedor: "A-9801",
      monto: 1000,
      fecha_emision: "2026-09-01",
      fecha_vencimiento: null,
      estatus_pago: "Pendiente",
      descripcion: "Cargos en destino",
    },
  ],
} as unknown as FilaReconciliacion;

const renderCelda = () =>
  render(
    <MemoryRouter>
      <GrupoCostosFacturasCell fila={fila} />
    </MemoryRouter>,
  );

describe("GrupoCostosFacturasCell · acceso al folio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rol financiero: el folio enlaza a la factura en CxP", () => {
    mockPerms.mockReturnValue(permisos(true));
    renderCelda();
    const enlace = screen.getByRole("link", { name: /Abrir factura FP-000123/i });
    expect(enlace).toHaveAttribute("href", "/compras/facturas/pf-1");
  });

  it("rol operativo: ve el folio pero sin enlace a CxP", () => {
    mockPerms.mockReturnValue(permisos(false));
    renderCelda();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByLabelText(/Factura FP-000123/i)).toBeInTheDocument();
    expect(screen.getByText(/FP-000123/)).toBeInTheDocument();
  });
});
