import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { deriveFacturaFlags } from "../../../domain/facturaFlags";
import type { FacturaActionsBarProps } from "../facturaActionsBarPrimary";

vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canOperarRefacturacion: true }) }));
vi.mock("@/components/shared/DetalleActionBar", () => ({ DetalleActionBar: ({ primary, secondary, more, destructive }: { primary: Item; secondary: Item[]; more: Item[]; destructive: Item }) => <>{[primary, ...secondary, ...more, destructive].filter(Boolean).map((item) => item!.href ? <a key={item!.id} href={item!.href}>{item!.id}</a> : <button key={item!.id} onClick={item!.onClick}>{item!.id}</button>)}</> }));
type Item = { id: string; href?: string; onClick?: () => void } | null;
import { FacturaDetalleActionsBar } from "../FacturaDetalleActionsBar";

function props(deleted_at?: string | null): FacturaActionsBarProps {
  const factura = { id: "f1", deleted_at, estado: "Emitida", uuid_fiscal: "uuid", facturapi_id: "api", fecha_emision: "2026-10-03", factura_pdf_url: "pdf", factura_xml_url: "xml", sustituida_por: "sustituta-historica" } as FacturaActionsBarProps["factura"];
  return { factura, canEdit: true, puedeEmitir: true, flags: deriveFacturaFlags({ ...factura, deleted_at: null, sustituida_por: null }, true, { saldo: 100, pagosRepPendientes: 1 }), acuse: {} as FacturaActionsBarProps["acuse"], eliminando: false, puedeEliminarBorrador: true, onTimbrar: vi.fn(), onEnviarEmail: vi.fn(), onRegistrarPago: vi.fn(), onTimbrarRep: vi.fn(), onSustituir: vi.fn(), onRefacturar: vi.fn(), onCancelar: vi.fn(), onEliminar: vi.fn(), onConsultar: vi.fn(), onDownload: vi.fn() };
}

describe("barra de acciones de factura dada de baja", () => {
  it.each(["2026-10-10T10:00:00Z", undefined])("sólo conserva descargas y referencias con deleted_at=%s", (deleted_at) => {
    const p = props(deleted_at);
    render(<FacturaDetalleActionsBar {...p} />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["pdf", "xml"]);
    expect(screen.getByRole("link", { name: "ver-sustituta" }).getAttribute("href")).toBe("/facturacion/sustituta-historica");
    fireEvent.click(screen.getByRole("button", { name: "pdf" }));
    expect(p.onDownload).toHaveBeenCalledWith("pdf", "pdf");
  });
  it("vigente conserva cobrar, REP, sustituir y refacturar", () => {
    render(<FacturaDetalleActionsBar {...props(null)} />);
    for (const name of ["cobrar", "rep", "sustituir", "refacturar", "cancelar"]) expect(screen.getByRole("button", { name })).toBeTruthy();
  });
});
