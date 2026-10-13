import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { FacturaDetalle } from "../../../types/detalle";

vi.mock("@/features/facturacion/hooks", () => ({ usePagosFactura: () => ({ data: [{ id: "p1" }] }) }));
vi.mock("@/features/facturacion/hooks/useNotasCreditoDeFactura", () => ({ useNotasCreditoDeFactura: () => ({ data: [{ id: "nc1" }] }) }));
vi.mock("@/components/shared/documento/DocumentoTabs", () => ({ DocumentoTabs: ({ tabs }: { tabs: { id: string; content: ReactNode }[] }) => <>{tabs.map((t) => <section key={t.id}>{t.content}</section>)}</> }));
vi.mock("../FacturaResumenCard", () => ({ FacturaResumenCard: () => <p>Resumen histórico</p> }));
vi.mock("../FacturaReceptorCard", () => ({ FacturaReceptorCard: () => <p>Cliente histórico</p> }));
vi.mock("../FacturaTimbradoCard", () => ({ FacturaTimbradoCard: () => <p>UUID histórico</p> }));
vi.mock("../FacturaConceptosTable", () => ({ FacturaConceptosTable: () => <p>Conceptos históricos</p> }));
vi.mock("../FacturaDocumentosSection", () => ({ FacturaDocumentosSection: () => <p>Documentos históricos</p> }));
vi.mock("../FacturaDetalleEditableSections", () => ({ FacturaDetalleEditableSections: ({ puedeEditarBorrador }: { puedeEditarBorrador: boolean }) => puedeEditarBorrador ? <button>Editar borrador</button> : null }));
vi.mock("../FacturaPagosSection", () => ({ FacturaPagosSection: ({ canEdit }: { canEdit: boolean }) => <><p>Pago histórico</p>{canEdit && <button>Modificar pago</button>}</> }));
vi.mock("../FacturaNotasCreditoSeccion", () => ({ FacturaNotasCreditoSeccion: ({ canEdit }: { canEdit: boolean }) => <><p>NC histórica</p>{canEdit && <button>Nueva NC</button>}</> }));
import { FacturaDetalleBody } from "../FacturaDetalleBody";

function body(deleted_at?: string | null, canEdit = true) {
  const factura = { id: "f1", organization_id: "o1", deleted_at, estado: "Emitida", uuid_fiscal: "uuid", cliente_id: "c1", total: 100 } as FacturaDetalle;
  return <FacturaDetalleBody factura={factura} canEdit={canEdit} puedeEditarBorrador={true} conceptosVivos={[]} onRegistrarPago={vi.fn()} saldo={100} />;
}

describe("tabs del detalle histórico", () => {
  it.each(["2026-10-10T10:00:00Z", undefined])("baja/desconocida %s mantiene contenido sin habilitar NC ni pagos", (deleted_at) => {
    render(body(deleted_at));
    expect(screen.queryByRole("button")).toBeNull();
    for (const label of ["Pago histórico", "NC histórica", "Documentos históricos", "Conceptos históricos", "Cliente histórico", "UUID histórico"]) expect(screen.getByText(label)).toBeTruthy();
  });
  it("vigente conserva acciones; refrescar a baja las retira", () => {
    const { rerender } = render(body(null));
    expect(screen.getByRole("button", { name: "Nueva NC" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Modificar pago" })).toBeTruthy();
    rerender(body("2026-10-10T10:00:00Z"));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Pago histórico")).toBeTruthy();
  });
  it("vigencia no concede canEdit", () => {
    render(body(null, false));
    expect(screen.queryByRole("button", { name: "Nueva NC" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Modificar pago" })).toBeNull();
  });
});
