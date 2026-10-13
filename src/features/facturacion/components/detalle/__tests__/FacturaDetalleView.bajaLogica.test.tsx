import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { deriveFacturaFlags } from "../../../domain/facturaFlags";
import type { FacturaDetalle } from "../../../types/detalle";

const mocks = vi.hoisted(() => ({ acciones: {} as Record<string, () => void> }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/documento/DocumentoDetalleShell", () => ({ DocumentoDetalleShell: ({ children, header, banners }: { children: ReactNode; header: ReactNode; banners: ReactNode }) => <>{header}{banners}{children}</> }));
vi.mock("../FacturaDetalleHeader", () => ({ FacturaDetalleHeader: ({ actions }: { actions: ReactNode }) => <>{actions}</> }));
vi.mock("../FacturaDetalleBody", () => ({ FacturaDetalleBody: () => <p>Detalle histórico</p> }));
vi.mock("../FacturaDetalleBanners", () => ({ FacturaDetalleBanners: () => null }));
vi.mock("../FacturaBitacoraCard", () => ({ FacturaBitacoraCard: () => null }));
vi.mock("../../refacturacion/RefacturacionTrazabilidadSection", () => ({ RefacturacionTrazabilidadSection: () => <p>Trazabilidad histórica</p> }));
vi.mock("../FacturaDetalleActionsBar", () => ({ FacturaDetalleActionsBar: (props: Record<string, () => void>) => { mocks.acciones = props; return <button onClick={props.onTimbrarRep}>Invocar REP</button>; } }));
vi.mock("../FacturaDetalleModales", () => ({ FacturaDetalleModales: () => <button>Confirmar operación abierta</button> }));
vi.mock("../FacturaDetalleFooterDialogs", () => ({ FacturaDetalleFooterDialogs: ({ onEliminar }: { onEliminar: () => void }) => <button onClick={onEliminar}>Confirmar eliminación abierta</button> }));
import { FacturaDetalleView } from "../FacturaDetalleView";

type Props = ComponentProps<typeof FacturaDetalleView>;
function props(deleted_at?: string | null): Props {
  const factura = { id: "f1", numero: "F-1", deleted_at, estado: "Emitida", total: 100, moneda: "MXN", uuid_fiscal: "uuid", fecha_emision: "2026-10-03", fecha_vencimiento: "2026-10-30" } as FacturaDetalle;
  return {
    factura, canEdit: true, puedeEmitir: true, flags: deriveFacturaFlags(factura, true, { saldo: 100, pagosRepPendientes: 1 }),
    acuse: {} as Props["acuse"], eliminando: false, conceptosVivos: [], pagoRepPendiente: { id: "p1" } as Props["pagoRepPendiente"],
    timbrarRep: { mutate: vi.fn() } as unknown as Props["timbrarRep"], handleDownload: vi.fn(), onEliminar: vi.fn(), volverHref: "/facturacion", volverLabel: "Volver", saldo: 100,
    dialogs: Object.fromEntries(["Pago", "Timbrar", "Enviar", "Sustituir", "Cancelar", "Eliminar", "Consultar", "Recordatorio", "Refacturar"].flatMap((name) => [[name[0].toLowerCase() + name.slice(1) + "Open", true], ["set" + name + "Open", vi.fn()]])) as Props["dialogs"],
  };
}

describe("detalle vivo que pasa a baja con diálogos abiertos", () => {
  it.each(["2026-10-10T10:00:00Z", undefined])("desmonta operaciones y bloquea callbacks con deleted_at=%s", (deleted_at) => {
    const live = props(null);
    const { rerender } = render(<FacturaDetalleView {...live} />);
    expect(screen.getByRole("button", { name: "Confirmar operación abierta" })).toBeTruthy();
    const historical = { ...live, factura: { ...live.factura, deleted_at } as FacturaDetalle };
    // Incluso flags previos a la recarga no deben reabrir la escritura.
    rerender(<FacturaDetalleView {...historical} />);
    expect(screen.queryByRole("button", { name: "Confirmar operación abierta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar eliminación abierta" })).toBeNull();
    for (const action of ["onTimbrar", "onRegistrarPago", "onSustituir", "onRefacturar", "onCancelar", "onEliminar", "onConsultar", "onEnviarEmail"]) mocks.acciones[action]();
    fireEvent.click(screen.getByRole("button", { name: "Invocar REP" }));
    expect(live.timbrarRep.mutate).not.toHaveBeenCalled();
    expect(live.onEliminar).not.toHaveBeenCalled();
    for (const setter of Object.values(live.dialogs).filter((value) => typeof value === "function")) expect(setter).not.toHaveBeenCalled();
    expect(screen.getByText("Detalle histórico")).toBeTruthy();
    expect(screen.getByText("Trazabilidad histórica")).toBeTruthy();
  });
  it("vigente conserva la entrada a REP y a sus diálogos", () => {
    const live = props(null);
    render(<FacturaDetalleView {...live} />);
    fireEvent.click(screen.getByRole("button", { name: "Invocar REP" }));
    expect(live.timbrarRep.mutate).toHaveBeenCalledWith("p1");
    mocks.acciones.onRegistrarPago();
    expect(live.dialogs.setPagoOpen).toHaveBeenCalledWith(true);
  });
});
