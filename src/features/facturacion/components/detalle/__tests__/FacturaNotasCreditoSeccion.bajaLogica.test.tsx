import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

const mocks = vi.hoisted(() => ({ timbrar: vi.fn(), cancelar: vi.fn(), tabla: {} as Record<string, (id: string) => void>, confirmar: null as null | ((motivo: string) => void) }));
vi.mock("@/features/facturacion/hooks", () => ({ usePagosFactura: () => ({ data: [] }) }));
vi.mock("@/features/facturacion/hooks/useNotasCreditoDeFactura", () => ({ useNotasCreditoDeFactura: () => ({ data: [{ id: "nc1", facturapi_id: "PENDING:claim" }], isLoading: false }) }));
vi.mock("@/features/facturacion/hooks/useNotaCreditoFacturapi", () => ({ useTimbrarNotaCredito: () => ({ mutate: mocks.timbrar }), useCancelarNotaCredito: () => ({ mutate: mocks.cancelar }) }));
vi.mock("../FacturaNotasCreditoTable", () => ({ FacturaNotasCreditoTable: (p: Record<string, (id: string) => void>) => { mocks.tabla = p; return <p>NC histórica visible</p>; } }));
vi.mock("../ClaimPendingBanner", () => ({ ClaimPendingBanner: ({ soloLectura }: { soloLectura: boolean }) => <p>{soloLectura ? "Claim en consulta" : "Claim recuperable"}</p> }));
vi.mock("../../DialogCrearNotaCredito", () => ({ DialogCrearNotaCredito: ({ open }: { open: boolean }) => open ? <p>Crear NC abierto</p> : null }));
vi.mock("../../DialogEnviarCfdi", () => ({ DialogEnviarCfdi: ({ open }: { open: boolean }) => open ? <p>Email NC abierto</p> : null }));
vi.mock("../../DialogCancelarNotaCredito", () => ({ DialogCancelarNotaCredito: ({ open, onConfirm }: { open: boolean; onConfirm: (motivo: string) => void }) => { mocks.confirmar = onConfirm; return open ? <p>Cancelar NC abierto</p> : null; } }));
import { FacturaNotasCreditoSeccion } from "../FacturaNotasCreditoSeccion";

const props: ComponentProps<typeof FacturaNotasCreditoSeccion> = { facturaId: "f1", facturaNumero: "F-1", monedaFactura: "MXN", tipoCambioFactura: 1, saldoFactura: 100, uuidFacturaOriginal: "uuid", snapshotEmision: null, canEdit: true };

describe("NC: cambio de elegibilidad con modal abierto", () => {
  beforeEach(() => vi.clearAllMocks());
  it("retira crear/cancelar/email y bloquea mutaciones; mantiene historial y claim de lectura", () => {
    const { rerender } = render(<FacturaNotasCreditoSeccion {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Nueva" }));
    expect(screen.getByText("Crear NC abierto")).toBeTruthy();
    act(() => { mocks.tabla.onCancelar("nc1"); mocks.tabla.onEmail("nc1"); });
    expect(screen.getByText("Cancelar NC abierto")).toBeTruthy();
    expect(screen.getByText("Email NC abierto")).toBeTruthy();
    rerender(<FacturaNotasCreditoSeccion {...props} canEdit={false} soloLectura />);
    expect(screen.queryByText("Crear NC abierto")).toBeNull();
    expect(screen.queryByText("Cancelar NC abierto")).toBeNull();
    expect(screen.queryByText("Email NC abierto")).toBeNull();
    expect(screen.queryByRole("button", { name: "Nueva" })).toBeNull();
    mocks.tabla.onTimbrar("nc1");
    mocks.confirmar?.("02");
    expect(mocks.timbrar).not.toHaveBeenCalled();
    expect(mocks.cancelar).not.toHaveBeenCalled();
    expect(screen.getByText("NC histórica visible")).toBeTruthy();
    expect(screen.getByText("Claim en consulta")).toBeTruthy();
  });
  it("vigente conserva timbrado de NC", () => {
    render(<FacturaNotasCreditoSeccion {...props} />);
    mocks.tabla.onTimbrar("nc1");
    expect(mocks.timbrar).toHaveBeenCalledWith("nc1");
  });
});
