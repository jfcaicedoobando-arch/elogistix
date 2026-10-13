import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agruparPorExpediente, calcularKpisProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";
import { TabProyeccion } from "../TabProyeccion";
const mocks = vi.hoisted(() => ({ mobile: true }));
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => mocks.mobile }));
vi.mock("@/features/facturacion/hooks", () => ({ useTabProyeccionController: () => controller }));
const groups = agruparPorExpediente([{
  embarque_id: "fixture-0", expediente: "FIXTURE-00030", cliente_nombre: "Textiles Ficticios", operador: "Operador Ficticio",
  eta: "2026-10-01", contenedor: null, tipo_cambio_usd: 20, tipo_cambio_eur: 22,
  sin_tc: false, tiene_proforma: false, tiene_factura_pdf: false, venta_usd: 10, venta_mxn: 200, costo_usd: 5, costo_mxn: 100,
}]);
const controller = {
  kpis: calcularKpisProyeccion(groups), kpisGlobales: calcularKpisProyeccion(groups), grupos: groups,
  mesActual: { key: "2026-10", label: "Octubre 2026" }, mesesDisponibles: [{ key: "2026-10", label: "Octubre 2026" }],
  filtroCliente: "Textiles Ficticios", filtroOperador: "todos", filtroEstado: "todos", clientesDisponibles: ["Textiles Ficticios"], operadoresDisponibles: [],
  isLoading: false, setFiltroCliente: vi.fn(), setFiltroOperador: vi.fn(), setFiltroEstado: vi.fn(), setMesKey: vi.fn(), irMesAnterior: vi.fn(), irMesSiguiente: vi.fn(), exportarCsv: vi.fn(),
};
function Controls() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="url">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Atrás</button><button onClick={() => navigate(1)}>Adelante</button></>;
}
const reportUrl = "/reportes/cierre-mensual?mes=2026-10&cliente=Textiles+Ficticios";
function mount() {
  return render(<MemoryRouter initialEntries={["/inicio", reportUrl]} initialIndex={1}><Controls /><Routes>
    <Route path="/reportes/cierre-mensual" element={<TabProyeccion />} />
    <Route path="*" element={<div>Detalle ficticio</div>} />
  </Routes></MemoryRouter>);
}
function card() { return screen.getByText("FIXTURE-00030"); }
beforeEach(() => { mocks.mobile = true; });
afterEach(() => vi.restoreAllMocks());
describe("TabProyeccion: historial de tarjetas y filas", () => {
  it.each([true, false])("un doble clic abre una única entrada; Atrás permite reabrir (mobile=%s)", (mobile) => {
    mocks.mobile = mobile;
    mount(); const row = card();
    // Batch the two native click events to retain the source during a pending route transition.
    // fireEvent.doubleClick alone emits only dblclick and would miss the production bug.
    act(() => { fireEvent.click(row, { detail: 1 }); fireEvent.click(row, { detail: 2 }); });
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/embarques\/fixture-0$/);
    fireEvent.click(screen.getByText("Atrás"));
    expect(screen.getByTestId("url").textContent).toBe(reportUrl);
    fireEvent.click(card(), { detail: 1 });
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/embarques\/fixture-0$/);
    fireEvent.click(screen.getByText("Atrás"));
    fireEvent.click(screen.getByText("Adelante"));
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/embarques\/fixture-0$/);
  });
  it.each(["Enter", " "])("mantiene activación accesible mediante %s", (key) => {
    mount(); const link = card().closest('[role="link"]'); expect(link).not.toBeNull();
    fireEvent.keyDown(link!, { key });
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/embarques\/fixture-0$/);
    fireEvent.click(screen.getByText("Atrás"));
    expect(screen.getByTestId("url").textContent).toBe(reportUrl);
  });
  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])("conserva modificadores sin ensuciar historial: %j", (modifier) => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mount(); fireEvent.click(card(), { detail: 1, ...modifier });
    expect(open).toHaveBeenCalledWith("/embarques/fixture-0", "_blank", "noopener,noreferrer");
    expect(screen.getByTestId("url").textContent).toBe(reportUrl);
  });
});
