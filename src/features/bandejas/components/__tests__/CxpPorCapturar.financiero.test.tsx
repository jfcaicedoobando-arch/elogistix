import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CxpAvanceCaptura } from "../CxpAvanceCaptura";
import { buildCxpPorCapturarColumns } from "../cxpPorCapturarColumns";
import { DataTable } from "@/components/shared/DataTable";
import { aplicarFiltros, type FiltersState } from "../../hooks/useCxpPorCapturarFilters";
import { referenciaCxpEmbarque } from "../../domain/cxpReferenciaEmbarque";
import type { CxpPorCapturarRow } from "../../services/bandejas";

const row: CxpPorCapturarRow = {
  embarque_id: "3efb2cc8-0a85-464c-8b6b-d66673b932f6", expediente: "ELIMP00010", cliente_nombre: "Aceros",
  presupuestado_mxn: 1000, presupuestado_usd: 556.8, facturado_mxn: 0, facturado_usd: 800,
  facturas_capturadas: 2, ultima_factura_fecha: null, dias_desde_ultima_factura: null,
};

describe("Por capturar — avance por moneda", () => {
  it("representa MXN0/1000 y USD800/556.80 con exceso USD visible", () => {
    render(<CxpAvanceCaptura row={row} />);
    expect(screen.getByRole("progressbar", { name: "Captura MXN" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("progressbar", { name: "Captura USD" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("144%")).toBeInTheDocument();
    expect(screen.getByText(/Excede el presupuesto en USD 243\.20/)).toBeInTheDocument();
  });

  it("un cambio de escala nominal no oculta ninguna moneda", () => {
    const { rerender } = render(<CxpAvanceCaptura row={{ ...row, presupuestado_mxn: 10 }} />);
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.getByText("144%")).toBeInTheDocument();
    rerender(<CxpAvanceCaptura row={{ ...row, presupuestado_mxn: 100000 }} />);
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.getByText("144%")).toBeInTheDocument();
  });

  it("una sola moneda muestra su avance y captura sin presupuesto queda explícita", () => {
    const { rerender } = render(<CxpAvanceCaptura row={{ ...row, presupuestado_usd: 0, facturado_usd: 0, facturado_mxn: 500 }} />);
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.getByText("50%")).toBeInTheDocument();
    rerender(<CxpAvanceCaptura row={{ ...row, presupuestado_mxn: 0, presupuestado_usd: 0, facturado_usd: 10 }} />);
    expect(screen.getByText("Sin presupuesto")).toBeInTheDocument();
    expect(screen.getByText(/USD 10\.00 \/ USD 0\.00/)).toBeInTheDocument();
  });
});

describe("Por capturar — borradores identificables", () => {
  const draft = { ...row, expediente: null, estado_embarque: "Borrador", cotizacion_folio: "COT-2026-0025" };
  const other = { ...draft, embarque_id: "809b58c4-a250-4fcd-a462-723d78634e65", cotizacion_folio: "COT-2026-0026" };
  it("dos borradores iguales tienen referencias únicas y origen visible; confirmar conserva el folio", () => {
    const columns = buildCxpPorCapturarColumns({});
    const { rerender } = render(<DataTable data={[draft, other]} columns={columns} rowKey={(r) => r.embarque_id} />);
    expect(screen.getByText("Borrador 3efb2cc8")).toBeInTheDocument();
    expect(screen.getByText("Borrador 809b58c4")).toBeInTheDocument();
    expect(screen.getByText("Cotización COT-2026-0025")).toBeInTheDocument();
    expect(screen.getAllByText("Operación no confirmada")).toHaveLength(2);
    rerender(<DataTable data={[{ ...draft, expediente: "ELNAC00014", estado_embarque: "Confirmado" }, other]}
      columns={columns} rowKey={(r) => r.embarque_id} />);
    const confirmed = screen.getByText("ELNAC00014").closest("tr");
    if (!confirmed) throw new Error("No se renderizó la fila confirmada");
    expect(within(confirmed).queryByText("Operación no confirmada")).not.toBeInTheDocument();
    expect(screen.getByText("Cotización COT-2026-0025")).toBeInTheDocument();
  });

  it("permite buscar por referencia o cotización y no presume Borrador sin estado", () => {
    const filtros: FiltersState = { query: "3efb2cc8", estatus: "todos", antiguedad: "todos", ordenarPor: "expediente", direccion: "asc" };
    expect(aplicarFiltros([draft, other], filtros)).toEqual([draft]);
    expect(aplicarFiltros([draft, other], { ...filtros, query: "COT-2026-0026" })).toEqual([other]);
    expect(referenciaCxpEmbarque({ ...row, expediente: null })).toBe("Sin folio (3efb2cc8)");
  });
});
