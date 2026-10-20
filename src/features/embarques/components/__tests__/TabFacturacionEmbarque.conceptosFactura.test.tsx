/** Regresión GUI ELNAC00029: convertir PRO0029 reserva el flete, sin emitirlo. */
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TabFacturacionEmbarque } from "../TabFacturacionEmbarque";
import { formatCurrency } from "@/lib/formatters";
import type { Tables } from "@/types/db";
import type { ProformaConFactura } from "@/features/proformas/services";

type Concepto = Tables<"conceptos_venta">;
type Factura = ComponentProps<typeof TabFacturacionEmbarque>["facturas"][number];
type Columna = { id: string; cell?: (ctx: { row: { original: Concepto } }) => ReactNode };
const datos = vi.hoisted(() => ({ conceptos: [] as Concepto[], proformas: [] as ProformaConFactura[] }));
const embarqueId = "079973ab-0877-463d-89cb-c5ec8faf301d";
const proformaId = "828ecfd5-abc1-4eda-b318-16f03b8878cc";
const facturaId = "4d5e5354-73ad-4d9a-ad57-d3109613a3ce";
const embarque = { id: embarqueId, expediente: "ELNAC00029", estado: "En Tránsito" } as Tables<"embarques">;

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEditarProforma: true }) }));
vi.mock("@/features/cliente/hooks/useClienteAutorizacion", () => ({
  useClienteAutorizacion: () => ({ autorizacion: { requiereAutorizacionProforma: true } }),
}));
vi.mock("@/features/embarques/hooks", () => ({
  useEmbarqueConceptosVenta: () => ({ data: datos.conceptos }),
  useContenedoresEmbarque: () => ({ data: [] }),
  useProformasEmbarque: () => ({ data: datos.proformas }),
  useEliminarProforma: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDescargarProformaPdf: () => ({ descargar: vi.fn() }),
}));
vi.mock("@/features/embarques/hooks/useAbrirRefacturacion", () => ({ useAbrirRefacturacion: () => undefined }));
vi.mock("@/features/embarques/hooks/useFocusSection", () => ({
  useFocusSection: () => ({ registerRef: () => undefined }),
}));
vi.mock("../facturacion/HistorialProformas", () => ({ HistorialProformas: () => null }));
vi.mock("../facturacion/HistorialFacturas", () => ({ HistorialFacturas: () => null }));
vi.mock("../facturacion/DialogEliminarProforma", () => ({ DialogEliminarProforma: () => null }));
vi.mock("../DialogGenerarProforma", () => ({
  DialogGenerarProforma: ({ open, conceptosPendientes }: { open: boolean; conceptosPendientes: Concepto[] }) =>
    open ? <output data-testid="elegibles">{conceptosPendientes.map(c => c.id).join(",")}</output> : null,
}));
// Sustituye sólo infraestructura tabular; se ejecutan las celdas y badges reales.
vi.mock("@/components/shared/DataTable", () => ({
  defineColumns: (columns: unknown) => columns,
  DataTable: ({ columns, data }: { columns: Columna[]; data: Concepto[] }) => (
    <div role="table">{data.map(original => (
      <div role="row" key={original.id} aria-label={original.descripcion}>
        {columns.map(c => <div role="cell" key={c.id}>{c.cell?.({ row: { original } })}</div>)}
      </div>
    ))}</div>
  ),
}));

function concepto(id: string, descripcion: string, precio: number, vinculado: boolean): Concepto {
  return { id, descripcion, embarque_id: embarqueId, cantidad: 1, precio_unitario: precio,
    moneda: "MXN", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16,
    estado_facturacion: vinculado ? "facturado" : "pendiente", proforma_id: vinculado ? proformaId : null,
  } as Concepto;
}
function factura(estado: string, over: Partial<Factura> = {}): Factura {
  return { id: facturaId, numero: "F-PRO0029", total: 174, moneda: "MXN",
    fecha_emision: "2026-10-11", estado, proforma_id: proformaId, ...over };
}
function tab(facturas: Factura[]) {
  return <TabFacturacionEmbarque facturas={facturas} canEdit embarque={embarque} />;
}
function flete() { return within(screen.getByRole("row", { name: "Flete" })); }

describe("conceptos de venta: reserva y emisión son estados distintos", () => {
  beforeEach(() => {
    datos.conceptos = [concepto("flete-150", "Flete", 150, true), concepto("cargo-30", "Cargo", 30, false)];
    datos.proformas = [{ id: proformaId, numero: "PRO0029", estado_proforma: "facturada",
      factura_id: facturaId, total_mxn: 174, total_usd: 0 } as ProformaConFactura];
  });

  it("muestra el borrador parcial, conserva sus 174 MXN y reserva el flete tras rerender", () => {
    const facturas = [factura("Borrador")];
    const vista = render(tab(facturas));
    expect(flete().getByText("En borrador")).toBeInTheDocument();
    expect(screen.getByText("0 / 2 emitidos · 1 en borrador")).toBeInTheDocument();
    const total = screen.getByText("Conceptos en factura").closest(".rounded-md") as HTMLElement;
    expect(within(total).getByText(formatCurrency(174, "MXN"))).toBeInTheDocument();
    expect(within(total).getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generar proforma" }));
    expect(screen.getByTestId("elegibles")).toHaveTextContent(/^cargo-30$/);
    vista.rerender(tab([...facturas]));
    expect(flete().getByText("En borrador")).toBeInTheDocument();
    expect(screen.getByText("0 / 2 emitidos · 1 en borrador")).toBeInTheDocument();
    expect(screen.getByTestId("elegibles")).toHaveTextContent(/^cargo-30$/);
    expect(datos.conceptos[0].estado_facturacion).toBe("facturado");
    expect(datos.conceptos[0].proforma_id).toBe(proformaId);
    vista.unmount();
    render(tab([...facturas]));
    expect(flete().getByText("En borrador")).toBeInTheDocument();
    expect(screen.getByText("0 / 2 emitidos · 1 en borrador")).toBeInTheDocument();
  });

  it("distingue Por timbrar sin volver elegible el concepto", () => {
    render(tab([factura("Por timbrar")]));
    expect(flete().getByText("Por timbrar")).toBeInTheDocument();
    expect(screen.getByText(/^0 \/ 2 emitidos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generar proforma" }));
    expect(screen.getByTestId("elegibles")).toHaveTextContent(/^cargo-30$/);
  });

  it.each(["Emitida", "Parcialmente pagada", "Pagada", "Vencida"])("cuenta el concepto emitido con factura %s", estado => {
    render(tab([factura(estado)]));
    expect(flete().getByText("Emitido")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 emitidos")).toBeInTheDocument();
    expect(screen.queryByText("En borrador")).not.toBeInTheDocument();
  });

  it.each([["Cancelada", "Factura cancelada"], ["Sustituida", "Factura sustituida"]])(
    "muestra el histórico %s sin contarlo como concepto emitido vigente", (estado, etiqueta) => {
      render(tab([factura(estado)]));
      expect(flete().getByText(etiqueta)).toBeInTheDocument();
      expect(screen.getByText(/^0 \/ 2 emitidos/)).toBeInTheDocument();
    },
  );

  it("no resucita vínculos cancelados cuando el dato crudo ya liberó los conceptos", () => {
    datos.conceptos = datos.conceptos.map(c => ({ ...c, estado_facturacion: "pendiente", proforma_id: null }));
    datos.proformas = [];
    render(tab([factura("Cancelada")]));
    expect(flete().getByText("Pendiente de proforma")).toBeInTheDocument();
    expect(screen.queryByText("Factura cancelada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generar proforma" }));
    expect(screen.getByTestId("elegibles")).toHaveTextContent(/^flete-150,cargo-30$/);
  });

  it("no inventa emisión si no se conoce la factura vinculada", () => {
    render(tab([]));
    expect(flete().getByText("En factura")).toBeInTheDocument();
    expect(screen.getByText(/^0 \/ 2 emitidos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generar proforma" }));
    expect(screen.getByTestId("elegibles")).toHaveTextContent(/^cargo-30$/);
  });

  it.each(["factura_id", "factura_secundaria_id"] as const)("rechaza el vínculo %s si la factura apunta a otra proforma", vinculo => {
    datos.proformas[0] = { ...datos.proformas[0], factura_id: null, factura_secundaria_id: null, [vinculo]: facturaId };
    render(tab([factura("Emitida", { proforma_id: "proforma-ajena" })]));
    expect(flete().getByText("En factura")).toBeInTheDocument();
    expect(screen.getByText(/^0 \/ 2 emitidos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generar proforma" }));
    expect(screen.getByTestId("elegibles")).toHaveTextContent(/^cargo-30$/);
    expect(datos.conceptos[0].estado_facturacion).toBe("facturado");
    expect(datos.conceptos[0].proforma_id).toBe(proformaId);
  });

  it.each(["factura_id", "factura_secundaria_id"] as const)("conserva la fusión por %s con vínculo inverso nulo", vinculo => {
    datos.proformas[0] = { ...datos.proformas[0], factura_id: null, factura_secundaria_id: null, [vinculo]: facturaId };
    render(tab([factura("Emitida", { proforma_id: null })]));
    expect(flete().getByText("Emitido")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 emitidos")).toBeInTheDocument();
  });

  it("resuelve por moneda una proforma con MXN emitida y USD en borrador", () => {
    datos.conceptos[1] = { ...datos.conceptos[1], moneda: "USD", estado_facturacion: "facturado", proforma_id: proformaId };
    render(tab([factura("Emitida"), factura("Borrador", { id: "factura-usd", moneda: "USD", total: 34.8 })]));
    expect(flete().getByText("Emitido")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: "Cargo" })).getByText("En borrador")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 emitidos · 1 en borrador")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar proforma" })).not.toBeInTheDocument();
  });
});
