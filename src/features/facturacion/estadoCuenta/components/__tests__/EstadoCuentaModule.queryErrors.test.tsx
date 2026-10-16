import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstadoCuentaModule } from "../EstadoCuentaModule";
import type { FacturaEstadoCuenta } from "../../services/estadoCuenta";

const h = vi.hoisted(() => ({ query: vi.fn(), retry: vi.fn(), retryKpis: vi.fn(), export: vi.fn() }));
vi.mock("../../hooks/useEstadoCuenta", () => ({ useEstadoCuenta: h.query }));
vi.mock("../../hooks/useEstadoCuentaDateRange", () => ({ useEstadoCuentaDateRange: () => ({
  desde: null, hasta: null, presetActivo: "historico", aplicarPreset: vi.fn(),
}) }));
vi.mock("../EstadoCuentaKpiCards", () => ({ EstadoCuentaKpiCards: ({ loading }: { loading: boolean }) =>
  <div>{loading ? "Cargando totales" : "Totales del cliente"}</div> }));
vi.mock("../EstadoCuentaAgingBar", () => ({ EstadoCuentaAgingBar: () => <div>Antigüedad del cliente</div> }));
vi.mock("../EstadoCuentaFilters", () => ({ EstadoCuentaFilters: ({ busqueda, onBusquedaChange }: {
  busqueda: string; onBusquedaChange: (value: string) => void;
}) => <div>Filtros de consulta<input aria-label="Buscar movimientos" value={busqueda}
  onChange={event => onBusquedaChange(event.target.value)} /></div> }));
vi.mock("../EstadoCuentaTableHead", () => ({ EstadoCuentaTableHead: () => null }));
vi.mock("../EstadoCuentaGrupoMoneda", () => ({ EstadoCuentaGrupoMoneda: ({ grupo }: { grupo: { filas: FacturaEstadoCuenta[] } }) =>
  <tr><td>{grupo.filas.map(f => f.numero).join(",")}</td></tr> }));
vi.mock("../ExportActions", () => ({ ExportActions: () => <div>
  {["PDF", "CSV", "Enviar"].map(label => <button key={label} onClick={h.export}>{label}</button>)}
</div> }));

const row: FacturaEstadoCuenta = { id: "f1", numero: "F-1", moneda: "MXN", saldo: 100, total: 100,
  pagado: 0, notas_credito_aplicadas: 0, dias_vencido: 1, fecha_emision: "2026-10-01",
  fecha_vencimiento: "2026-10-02", cliente_id: "c1", cliente_nombre: "Cliente", expediente: "EXP-1",
  estatus_cobranza: "Vencida", estado_factura: "Emitida", pagos: [], notas_credito: [] };
const props = { clienteIds: ["c1"], facturaHrefBase: "/facturacion" };
function query(overrides = {}) {
  return { rows: [], kpis: {}, isLoading: false, isFetching: false, isError: false,
    error: null, hasData: true, refetch: h.retry, kpisIsLoading: false, kpisIsError: false,
    kpisError: null, kpisHasData: true, kpisIsFetching: false, kpisRefetch: h.retryKpis, ...overrides };
}
function expectNoExports() {
  for (const name of ["PDF", "CSV", "Enviar"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  expect(h.export).not.toHaveBeenCalled();
}

beforeEach(() => { vi.clearAllMocks(); h.query.mockReturnValue(query()); });

describe("Estado de cuenta: error, vacío y vigencia del listado", () => {
  it.each([
    ["común", new Error("fallo de red"), "No se pudo completar la consulta"],
    ["LC_RESULTADO_TRUNCADO", { code: "LC_RESULTADO_TRUNCADO" }, "La consulta puede estar incompleta"],
  ])("muestra error %s inicial sin ceros, vacío ni exportaciones", (_name, error, message) => {
    h.query.mockReturnValue(query({ isError: true, error, hasData: false }));
    render(<EstadoCuentaModule {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/Sin movimientos/)).not.toBeInTheDocument();
    expect(screen.queryByText("Totales del cliente")).not.toBeInTheDocument();
    expect(screen.queryByText("Antigüedad del cliente")).not.toBeInTheDocument();
    expect(screen.getByText("Filtros de consulta")).toBeVisible();
    expectNoExports();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(h.retry).toHaveBeenCalledOnce();
  });

  it("conserva filas previas con aviso, bloquea exportaciones y recupera al reintentar", () => {
    h.query.mockReturnValue(query({ rows: [row], isError: true, error: new Error("refresco") }));
    const view = render(<EstadoCuentaModule {...props} />);
    expect(screen.getByText("F-1")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("no están actualizados");
    expectNoExports();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    h.query.mockReturnValue(query({ rows: [row], isError: true, isFetching: true }));
    view.rerender(<EstadoCuentaModule {...props} />);
    expect(screen.getByRole("button", { name: "Reintentando…" })).toBeDisabled();
    expectNoExports();
    h.query.mockReturnValue(query({ rows: [row] }));
    view.rerender(<EstadoCuentaModule {...props} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(h.export).toHaveBeenCalledOnce();
  });

  it("una respuesta vacía correcta sí muestra Sin movimientos", () => {
    render(<EstadoCuentaModule {...props} />);
    expect(screen.getByText("Sin movimientos con los filtros seleccionados.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un refresco fallido con caché vacía avisa que los totales y aging previos no están actualizados", () => {
    const view = render(<EstadoCuentaModule {...props} defaultSoloConSaldo />);
    expect(screen.getByText(/Sin movimientos/)).toBeVisible();
    h.query.mockReturnValue(query({ isError: true, hasData: true }));
    view.rerender(<EstadoCuentaModule {...props} defaultSoloConSaldo />);
    expect(screen.getByRole("alert")).toHaveTextContent("no están actualizados");
    expect(screen.getByText("Totales del cliente")).toBeVisible();
    expect(screen.getByText("Antigüedad del cliente")).toBeVisible();
    expect(screen.queryByText(/Sin movimientos/)).not.toBeInTheDocument();
    expectNoExports();
  });

  it("una búsqueda sin coincidencias conserva el aviso de caché desactualizada al fallar el refresco", () => {
    h.query.mockReturnValue(query({ rows: [row] }));
    const view = render(<EstadoCuentaModule {...props} defaultSoloConSaldo />);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar movimientos" }), {
      target: { value: "sin-coincidencias" },
    });
    expect(screen.queryByText("F-1")).not.toBeInTheDocument();
    expect(screen.getByText(/Sin movimientos/)).toBeVisible();
    h.query.mockReturnValue(query({ rows: [row], isError: true, hasData: true }));
    view.rerender(<EstadoCuentaModule {...props} defaultSoloConSaldo />);
    expect(screen.getByRole("alert")).toHaveTextContent("no están actualizados");
    expect(screen.getByText("Totales del cliente")).toBeVisible();
    expect(screen.getByText("Antigüedad del cliente")).toBeVisible();
    expect(screen.queryByText(/Sin movimientos/)).not.toBeInTheDocument();
    expectNoExports();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(h.retry).toHaveBeenCalledOnce();
  });

  it("propaga la carga de KPIs y no presenta su respaldo local como totales remotos", () => {
    h.query.mockReturnValue(query({ rows: [row], kpisIsLoading: true, kpisHasData: false }));
    render(<EstadoCuentaModule {...props} />);
    expect(screen.getByText("Cargando totales")).toBeVisible();
    expect(screen.queryByText("Totales del cliente")).not.toBeInTheDocument();
  });

  it("fallo exclusivo de KPI oculta sólo totales no disponibles y reintenta su consulta", () => {
    h.query.mockReturnValue(query({ rows: [row], kpisIsError: true, kpisError: new Error("RPC"), kpisHasData: false }));
    render(<EstadoCuentaModule {...props} />);
    expect(screen.getByText("F-1")).toBeVisible();
    expect(screen.queryByText("Totales del cliente")).not.toBeInTheDocument();
    expect(screen.getByText("Antigüedad del cliente")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(h.retryKpis).toHaveBeenCalledOnce();
    expect(h.retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(h.export).toHaveBeenCalledOnce();
  });

  it("un refresco de KPI fallido conserva el KPI previo con aviso", () => {
    h.query.mockReturnValue(query({ rows: [row], kpisIsError: true, kpisHasData: true }));
    render(<EstadoCuentaModule {...props} />);
    expect(screen.getByText("Totales del cliente")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("no están actualizados");
    expect(screen.getByText("F-1")).toBeVisible();
  });

  it.each([{ isLoading: true }, { rows: [row], isFetching: true }])("bloquea exportaciones mientras consulta %j", state => {
    h.query.mockReturnValue(query(state));
    render(<EstadoCuentaModule {...props} />);
    expectNoExports();
  });
});
