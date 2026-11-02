import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { PuertoOption } from "@/features/catalogos";
import type { RutaPuertos } from "@/features/costeo/utils/puertosDeRutas";
import { createWrapper } from "@/test/utils/queryWrapper";

const fixtures = vi.hoisted(() => ({
  rutas: [] as RutaPuertos[],
  catalogo: [] as PuertoOption[],
  tarifas: [] as { id: string }[],
  top: vi.fn(),
  diagnostico: vi.fn(),
  requests: [] as string[],
  rejectFetch: async (input: RequestInfo | URL): Promise<Response> => {
    throw new Error(`Unexpected network request: ${String(input)}`);
  },
}));

vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({ data: fixtures.catalogo }),
  useTiposContenedor: () => ({ data: [TIPO] }),
}));
vi.mock("@/features/costeo/hooks/useCosteoRutas", () => ({
  useCosteoRutas: () => ({ data: fixtures.rutas, isLoading: false }),
}));
vi.mock("@/features/costeo/hooks/useTopTarifas", () => ({
  useTopTarifas: (params: unknown) => fixtures.top(params),
}));
vi.mock("@/features/costeo/hooks/useDiagnosticoTarifas", () => ({
  useDiagnosticoTarifas: (params: unknown) => fixtures.diagnostico(params),
}));
// Keep route selection/results real; only make a retained query row observable.
vi.mock("@/features/costeo/components/TarifaResultCard", () => ({
  TarifaResultCard: ({ row }: { row: { id: string } }) => <p data-testid="cached-rate">{row.id}</p>,
}));

import CosteoBuscar from "../CosteoBuscar";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const C = "00000000-0000-4000-8000-000000000003";
const D = "00000000-0000-4000-8000-000000000004";
const E = "00000000-0000-4000-8000-000000000005";
const F = "00000000-0000-4000-8000-000000000006";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";
const TIPO = { id: "10000000-0000-4000-8000-000000000001", name: "Contenedor de prueba", code: "20DV" };
const PUERTOS: PuertoOption[] = [
  { id: A, code: "XXALF", name: "Origen Alfa", country: "Prueba", activo: true },
  { id: B, code: "XXBET", name: "Destino Beta", country: "Prueba", activo: true },
  { id: C, code: "XXGAM", name: "Origen Gamma", country: "Prueba", activo: true },
  { id: D, code: "XXDEL", name: "Destino Delta", country: "Prueba", activo: true },
  { id: E, code: "XXEPS", name: "Puerto sin ruta", country: "Prueba", activo: true },
  { id: F, code: "XXZET", name: "Origen de ruta inactiva", country: "Prueba", activo: true },
];
const RUTAS: RutaPuertos[] = [
  { puerto_origen_id: A, puerto_destino_id: B, activa: true },
  { puerto_origen_id: A, puerto_destino_id: B, activa: true },
  { puerto_origen_id: A, puerto_destino_id: D, activa: true },
  { puerto_origen_id: C, puerto_destino_id: D, activa: true },
  { puerto_origen_id: F, puerto_destino_id: E, activa: false },
  { puerto_origen_id: UNKNOWN, puerto_destino_id: D, activa: true },
  { puerto_origen_id: A, puerto_destino_id: UNKNOWN, activa: true },
];

beforeEach(() => {
  fixtures.rutas = RUTAS.map((ruta) => ({ ...ruta }));
  fixtures.catalogo = PUERTOS.map((puerto) => ({ ...puerto }));
  fixtures.tarifas = [];
  fixtures.requests = [];
  fixtures.top.mockImplementation((params: { tipoContenedorId?: string }) => ({
    data: fixtures.tarifas, isFetching: false, isError: false,
    isSuccess: !!params.tipoContenedorId, refetch: vi.fn(),
    tipoContenedorIds: params.tipoContenedorId ? [params.tipoContenedorId] : [],
  }));
  fixtures.diagnostico.mockReturnValue({ diagnostico: undefined });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    fixtures.requests.push(String(input));
    return fixtures.rejectFetch(input);
  });
});

async function options(label: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  return within(await screen.findByRole("listbox"));
}

async function choosePort(label: string, name: string) {
  const list = await options(label);
  fireEvent.click(list.getByRole("option", { name }));
}

async function chooseRoute() {
  await choosePort("Puerto de origen", "Origen Alfa, Prueba (XXALF)");
  await choosePort("Puerto de destino", "Destino Beta, Prueba (XXBET)");
  fireEvent.click(screen.getByLabelText("Tipo contenedor"));
  fireEvent.click(within(await screen.findByRole("listbox")).getByText(TIPO.name));
}

describe("CosteoBuscar — puertos de rutas registradas", () => {
  it("ofrece sólo orígenes y destinos registrados activos, sin duplicados ni invertir la ruta", async () => {
    render(<CosteoBuscar />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Puerto de destino")).toBeDisabled();
    const origenes = await options("Puerto de origen");
    expect(origenes.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Origen Alfa, Prueba (XXALF)", "Origen Gamma, Prueba (XXGAM)",
    ]);
    fireEvent.click(origenes.getByRole("option", { name: "Origen Alfa, Prueba (XXALF)" }));
    const destinos = await options("Puerto de destino");
    expect(destinos.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Destino Beta, Prueba (XXBET)", "Destino Delta, Prueba (XXDEL)",
    ]);
    fireEvent.click(destinos.getByRole("option", { name: "Destino Beta, Prueba (XXBET)" }));
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: A, puertoDestinoId: B }));
    expect(fixtures.requests).toEqual([]);
  });

  it("al cambiar origen limpia el destino y exige escoger uno de la nueva ruta", async () => {
    render(<CosteoBuscar />, { wrapper: createWrapper() });
    await chooseRoute();
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({
      puertoOrigenId: A, puertoDestinoId: B, tipoContenedorId: TIPO.id,
    }));
    await choosePort("Puerto de origen", "Origen Gamma, Prueba (XXGAM)");
    expect(screen.getByLabelText("Puerto de destino")).toHaveTextContent("Buscar puerto de destino…");
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: C, puertoDestinoId: "" }));
    const destinos = await options("Puerto de destino");
    expect(destinos.getAllByRole("option").map((option) => option.textContent)).toEqual(["Destino Delta, Prueba (XXDEL)"]);
    expect(fixtures.requests).toEqual([]);
  });

  it.each([
    { caso: "vacías", rutas: [] },
    { caso: "inactivas", rutas: [{ puerto_origen_id: A, puerto_destino_id: B, activa: false }] },
    { caso: "sin origen en catálogo", rutas: [{ puerto_origen_id: UNKNOWN, puerto_destino_id: B, activa: true }] },
  ])("sin rutas $caso expone el estado vacío y deshabilita los puertos", ({ rutas }) => {
    fixtures.rutas = rutas;
    render(<CosteoBuscar />, { wrapper: createWrapper() });
    expect(screen.getByRole("status")).toHaveTextContent("Aún no hay rutas marítimas dadas de alta.");
    expect(screen.getByLabelText("Puerto de origen")).toBeDisabled();
    expect(screen.getByLabelText("Puerto de destino")).toBeDisabled();
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: "", puertoDestinoId: "" }));
    expect(fixtures.requests).toEqual([]);
  });

  it("un destino retirado por refresco deja de consultar y oculta la tarifa retenida", async () => {
    const view = render(<CosteoBuscar />, { wrapper: createWrapper() });
    await chooseRoute();
    fixtures.tarifas = [{ id: "tarifa-anterior" }];
    view.rerender(<CosteoBuscar />);
    expect(screen.getByTestId("cached-rate")).toHaveTextContent("tarifa-anterior");
    fixtures.rutas = fixtures.rutas.map((ruta) => ruta.puerto_origen_id === A && ruta.puerto_destino_id === B
      ? { ...ruta, activa: false } : ruta);
    view.rerender(<CosteoBuscar />);
    expect(screen.getByLabelText("Puerto de destino")).toHaveTextContent("Buscar puerto de destino…");
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: A, puertoDestinoId: "" }));
    expect(fixtures.diagnostico).toHaveBeenLastCalledWith(expect.objectContaining({ puertoDestinoId: "", enabled: false }));
    expect(screen.queryByTestId("cached-rate")).not.toBeInTheDocument();
    expect(screen.getByText("Selecciona ruta y tipo de contenedor para ver las tarifas vigentes.")).toBeInTheDocument();
    expect(fixtures.requests).toEqual([]);
  });

  it("un origen retirado por refresco invalida ambos filtros efectivos y su resultado retenido", async () => {
    const view = render(<CosteoBuscar />, { wrapper: createWrapper() });
    await chooseRoute();
    fixtures.tarifas = [{ id: "tarifa-anterior" }];
    view.rerender(<CosteoBuscar />);
    expect(screen.getByTestId("cached-rate")).toBeInTheDocument();
    fixtures.rutas = [{ puerto_origen_id: C, puerto_destino_id: D, activa: true }];
    view.rerender(<CosteoBuscar />);
    expect(screen.getByLabelText("Puerto de origen")).toHaveTextContent("Buscar puerto de origen…");
    expect(screen.getByLabelText("Puerto de destino")).toBeDisabled();
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: "", puertoDestinoId: "" }));
    expect(fixtures.diagnostico).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: "", puertoDestinoId: "", enabled: false }));
    expect(screen.queryByTestId("cached-rate")).not.toBeInTheDocument();
    expect(fixtures.requests).toEqual([]);
  });
});
