import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FilaProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";
import { useTabProyeccionController } from "../useTabProyeccionController";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), csv: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-fixture", orgListo: true }) }));
vi.mock("@/features/facturacion/services", () => ({ fetchProyeccionMes: mocks.fetch }));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: mocks.csv }));

const filas: FilaProyeccion[] = Array.from({ length: 25 }, (_, index) => ({
  embarque_id: `fixture-${index}`, expediente: `FIX-${index}`,
  cliente_nombre: index === 0 ? "Textiles Ficticios" : "Otro Ficticio", operador: "Operador Ficticio",
  eta: "2026-10-01", contenedor: null, tipo_cambio_usd: 20, tipo_cambio_eur: 22,
  sin_tc: false, tiene_proforma: false, tiene_factura_pdf: false,
  venta_usd: 10, venta_mxn: 200, costo_usd: 5, costo_mxn: 100,
}));
const initial = "/reportes/cierre-mensual?mes=2026-10&conservar=si";
function LocationControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="url">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Atrás</button>
    <button onClick={() => navigate(1)}>Adelante</button>
    <button onClick={() => navigate("/reportes/cierre-mensual?mes=2026-09&cliente=Otro+Ficticio&operador=Operador+Ficticio&estado=Pendiente")}>Otro enlace</button>
  </>;
}
function Reporte() {
  const c = useTabProyeccionController();
  const navigate = useNavigate();
  return <>
    <output data-testid="selection">{JSON.stringify([c.mesActual.key, c.filtroCliente, c.filtroOperador, c.filtroEstado])}</output>
    <output data-testid="count">{c.grupos.length}</output>
    <button onClick={() => c.setFiltroCliente("Textiles Ficticios")}>Cliente</button>
    <button onClick={() => c.setFiltroOperador("Operador Ficticio")}>Operador</button>
    <button onClick={() => c.setFiltroEstado("Pendiente")}>Estado</button>
    <button onClick={() => c.setFiltroCliente("todos")}>Limpiar cliente</button>
    <button onClick={() => c.setMesKey("2026-09")}>Mes</button>
    <button onClick={() => navigate("/embarques/fixture-0")}>Abrir embarque</button>
  </>;
}
function mount(url = initial) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={["/inicio", url]} initialIndex={1}>
    <LocationControls />
    <Routes><Route path="/reportes/cierre-mensual" element={<Reporte />} /><Route path="*" element={<div>Otra pantalla</div>} /></Routes>
  </MemoryRouter></QueryClientProvider>);
}
function selection() { return JSON.parse(screen.getByTestId("selection").textContent ?? "[]"); }
function params() { return new URLSearchParams(screen.getByTestId("url").textContent?.split("?")[1]); }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T18:00:00Z"));
  mocks.fetch.mockReset().mockResolvedValue(filas);
  mocks.csv.mockReset();
});

describe("Cierre mensual: estado de filtros e historial", () => {
  it("restaura el único expediente filtrado tras abrir un embarque y Atrás/Adelante", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("25"));
    fireEvent.click(screen.getByText("Cliente"));
    fireEvent.click(screen.getByText("Operador"));
    fireEvent.click(screen.getByText("Estado"));
    expect(screen.getByTestId("count")).toHaveTextContent(/^1$/);
    fireEvent.click(screen.getByText("Abrir embarque"));
    fireEvent.click(screen.getByText("Atrás"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent(/^1$/));
    expect(selection()).toEqual(["2026-10", "Textiles Ficticios", "Operador Ficticio", "Pendiente"]);
    fireEvent.click(screen.getByText("Adelante"));
    expect(screen.getByTestId("url")).toHaveTextContent("/embarques/fixture-0");
    fireEvent.click(screen.getByText("Atrás"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent(/^1$/));
  });
  it("reabre la selección directamente desde URL y conserva parámetros ajenos", async () => {
    mount(initial + "&cliente=Textiles+Ficticios&operador=Operador+Ficticio&estado=Pendiente");
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent(/^1$/));
    fireEvent.click(screen.getByText("Mes"));
    expect(params().get("conservar")).toBe("si");
    expect(params().get("cliente")).toBe("Textiles Ficticios");
    expect(selection()[0]).toBe("2026-09");
    fireEvent.click(screen.getByText("Limpiar cliente"));
    expect(params().has("cliente")).toBe(false);
    expect(params().get("estado")).toBe("Pendiente");
    expect(selection()[1]).toBe("todos");
  });
  it("deriva la selección del historial incluso sin desmontar el reporte", async () => {
    mount(initial + "&cliente=Textiles+Ficticios");
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent(/^1$/));
    fireEvent.click(screen.getByText("Otro enlace"));
    await waitFor(() => expect(selection()).toEqual(["2026-09", "Otro Ficticio", "Operador Ficticio", "Pendiente"]));
    fireEvent.click(screen.getByText("Atrás"));
    expect(selection()).toEqual(["2026-10", "Textiles Ficticios", "todos", "todos"]);
    fireEvent.click(screen.getByText("Adelante"));
    expect(selection()[0]).toBe("2026-09");
  });
  it("editar filtros reemplaza la entrada y no agrega pasos al botón Atrás", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("25"));
    fireEvent.click(screen.getByText("Cliente"));
    expect(params().get("cliente")).toBe("Textiles Ficticios");
    fireEvent.click(screen.getByText("Operador"));
    fireEvent.click(screen.getByText("Estado"));
    fireEvent.click(screen.getByText("Atrás"));
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/inicio$/);
  });
  it("usa valores seguros para estado y mes inválidos sin borrar parámetros ajenos", () => {
    mount("/reportes/cierre-mensual?mes=invalid&cliente=&operador=&estado=bad&conservar=si");
    const [month, ...filters] = selection();
    expect(month).toBe("2026-10");
    expect(filters).toEqual(["todos", "todos", "todos"]);
    act(() => fireEvent.click(screen.getByText("Cliente")));
    expect(params().get("conservar")).toBe("si");
  });
});
