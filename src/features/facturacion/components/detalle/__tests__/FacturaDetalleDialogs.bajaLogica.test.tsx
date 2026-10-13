import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { useFacturaDetalleDialogs } from "../../../hooks/useFacturaDetalleDialogs";
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
vi.mock("../FacturaDetalleModales", () => ({ FacturaDetalleModales: ({ factura, pagoOpen }: { factura: FacturaDetalle; pagoOpen: boolean }) => pagoOpen ? <button>Confirmar pago {factura.id}</button> : null }));
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

describe("Independent review: dismissed operations stay dismissed across entity changes", () => {
  function Harness({ deleted_at, id = "f1" }: { deleted_at: string | null | undefined; id?: string }) {
    const p = props(deleted_at);
    const dialogs = useFacturaDetalleDialogs({ ...p.factura, id });
    return <FacturaDetalleView {...p} factura={{ ...p.factura, id }} dialogs={dialogs} />;
  }
  it("live -> deleted -> another live invoice must not resurrect the payment dialog", () => {
    const { rerender } = render(<Harness deleted_at={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Invocar REP" }));
    // Open via current production action callback and real state hook.
    act(() => mocks.acciones.onRegistrarPago());
    expect(screen.getByRole("button", { name: "Confirmar pago f1" })).toBeTruthy();
    rerender(<Harness deleted_at="2026-10-13T12:00:00Z" />);
    expect(screen.queryByRole("button", { name: "Confirmar pago f1" })).toBeNull();
    rerender(<Harness deleted_at={null} id="f2" />);
    expect(screen.queryByRole("button", { name: "Confirmar pago f2" })).toBeNull();
  });
  it("live -> unknown -> recovered same invoice must not resurrect the payment dialog", () => {
    const { rerender } = render(<Harness deleted_at={null} />);
    act(() => mocks.acciones.onRegistrarPago());
    rerender(<Harness deleted_at={undefined} />);
    expect(screen.queryByRole("button", { name: "Confirmar pago f1" })).toBeNull();
    rerender(<Harness deleted_at={null} />);
    expect(screen.queryByRole("button", { name: "Confirmar pago f1" })).toBeNull();
  });
});
