import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataTable } from "@/components/shared/DataTable";
import {
  FILTROS_LIBRO_PAGOS_INICIALES,
  filtrarPagos,
  type FiltroRep,
  type PagoLibro,
} from "@/features/tesoreria/domain/libroPagos";
import { libroPagosColumns } from "../libroPagosColumns";

function cobro(id: string, estadoRep: string | null, overrides: Partial<PagoLibro> = {}): PagoLibro {
  return {
    id, tipo: "cobro", fecha: "2026-10-01", contraparte: id, contraparte_id: null,
    documento_id: null, documento_folio: `A-${id}`, moneda: "MXN", monto: 116,
    tipo_cambio: 1, monto_mxn: 116, metodo_pago: "03", referencia: null,
    cuenta_bancaria_id: null, cuenta_alias: null, cuenta_banco: null, notas: null,
    embarque_id: null, diferencia_cambiaria_mxn: 0, estado_rep: estadoRep,
    folio_rep: null, es_ajuste: false, es_anticipo_aplicado: false, lote_id: null,
    conciliado: false, movimiento_id: null, created_at: null,
    ...overrides,
  };
}

const pagos = [
  cobro("pue", "NoAplica"),
  cobro("pendiente", "Pendiente"),
  cobro("parcial", "Pendiente", { monto: 58, monto_mxn: 58 }),
  cobro("timbrado", "Timbrado"),
  cobro("cancelado", "Cancelado"),
  cobro("legacy", null),
  cobro("error", "Error"),
  cobro("desconocido", "Estado futuro"),
  cobro("proveedor", null, { tipo: "pago" }),
];

function Tabla({ rep = "todos", data = pagos }: { rep?: FiltroRep; data?: PagoLibro[] }) {
  return (
    <DataTable
      columns={libroPagosColumns()}
      data={filtrarPagos(data, { ...FILTROS_LIBRO_PAGOS_INICIALES, rep })}
      rowKey={(pago) => pago.id}
    />
  );
}

function celdaRep(id: string): HTMLElement {
  const row = screen.getByText(id, { exact: true }).closest("tr");
  if (!row) throw new Error(`No se encontró la fila ${id}`);
  return within(row).getAllByRole("cell").at(-1)!;
}

describe("libro de pagos: REP almacenado en tabla y filtro reales", () => {
  it("muestra No aplica sin inventar un pendiente y conserva el resto de estados", () => {
    render(<Tabla />);

    expect(celdaRep("pue")).toHaveTextContent(/^No aplica$/);
    expect(celdaRep("pue").querySelector('[data-domain="rep"]')).toHaveAttribute("data-status", "No aplica");
    expect(celdaRep("pue").querySelector('[data-domain="rep"]')).toHaveClass("bg-muted");
    for (const id of ["pendiente", "parcial", "legacy", "error", "desconocido"]) {
      expect(celdaRep(id)).toHaveTextContent(/^Pendiente$/);
    }
    expect(celdaRep("timbrado")).toHaveTextContent(/^Timbrado$/);
    expect(celdaRep("cancelado")).toHaveTextContent(/^Cancelado$/);
    expect(celdaRep("proveedor")).toHaveTextContent(/^N\/A$/);
  });

  it.each<readonly [FiltroRep, string[]]>([
    ["todos", pagos.map((pago) => pago.id)],
    ["pendiente", ["pendiente", "parcial", "legacy", "error", "desconocido"]],
    ["timbrado", ["timbrado"]],
    ["cancelado", ["cancelado"]],
  ])("el filtro %s conserva exactamente las filas correspondientes", (rep, ids) => {
    render(<Tabla rep={rep} />);
    expect(screen.getAllByRole("row")).toHaveLength(ids.length + 1);
    for (const pago of pagos) {
      if (ids.includes(pago.id)) expect(screen.getByText(pago.id, { exact: true })).toBeInTheDocument();
      else expect(screen.queryByText(pago.id, { exact: true })).not.toBeInTheDocument();
    }
  });

  it("normaliza mayúsculas y espacios sin cambiar el estado almacenado", () => {
    const data = [cobro("normalizado", " noaplica ")];
    const { rerender } = render(<Tabla data={data} />);
    expect(celdaRep("normalizado")).toHaveTextContent(/^No aplica$/);
    rerender(<Tabla data={data} rep="pendiente" />);
    expect(screen.queryByText("normalizado")).not.toBeInTheDocument();
    expect(data[0].estado_rep).toBe(" noaplica ");
  });
});
