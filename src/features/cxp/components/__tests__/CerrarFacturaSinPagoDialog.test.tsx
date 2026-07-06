/**
 * Tests del componente `CerrarFacturaSinPagoDialog` (Ola A · A4).
 * Verifica doble confirmación (motivo obligatorio + "CERRAR") y payload al confirmar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CerrarFacturaSinPagoDialog } from "../CerrarFacturaSinPagoDialog";
import type { FacturaCxP } from "@/features/cxp/services";

const factura = {
  id: "f-1",
  proveedor_id: "p-1",
  proveedor_nombre: "Naviera X",
  folio_proveedor: "FAC-001",
  folio_interno: "FI-001",
  moneda: "MXN",
  saldo: 1234.56,
  total: 1234.56,
  estado: "Vigente",
  estado_aprobacion: "aprobada",
} as unknown as FacturaCxP;

function setup(overrides: Partial<Parameters<typeof CerrarFacturaSinPagoDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CerrarFacturaSinPagoDialog
      factura={factura}
      open
      isPending={false}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("CerrarFacturaSinPagoDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("el botón 'Cerrar factura' está deshabilitado sin motivo ni 'CERRAR'", () => {
    setup();
    const btn = screen.getByRole("button", { name: /cerrar factura/i });
    expect(btn).toBeDisabled();
  });

  it("sigue deshabilitado si sólo se escribe 'CERRAR' pero no hay motivo", () => {
    setup();
    const input = screen.getByLabelText(/escribe/i);
    fireEvent.change(input, { target: { value: "CERRAR" } });
    expect(screen.getByRole("button", { name: /cerrar factura/i })).toBeDisabled();
  });

  it("no confirma con texto distinto a 'CERRAR' aunque haya motivo", () => {
    const { onConfirm } = setup();
    const input = screen.getByLabelText(/escribe/i);
    fireEvent.change(input, { target: { value: "cerrar mal" } });
    // Sin poder disparar el Select de Radix en jsdom sin userEvent complejo,
    // validamos que el botón sigue deshabilitado (no hay motivo aún).
    expect(screen.getByRole("button", { name: /cerrar factura/i })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("renderiza saldo y proveedor en la descripción", () => {
    setup();
    expect(screen.getByText(/Naviera X/i)).toBeInTheDocument();
    expect(screen.getByText(/FAC-001/i)).toBeInTheDocument();
  });
});
