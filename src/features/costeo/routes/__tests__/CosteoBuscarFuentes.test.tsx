import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import type { PuertoOption } from "@/features/catalogos";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { RutaPuertos } from "@/features/costeo/utils/puertosDeRutas";
import { createWrapper } from "@/test/utils/queryWrapper";

const fixtures = vi.hoisted(() => ({
  rutas: vi.fn<() => Promise<RutaPuertos[]>>(),
  puertos: vi.fn<() => Promise<PuertoOption[]>>(),
  top: vi.fn(),
  diagnostico: vi.fn(),
  network: vi.fn(),
}));

// Preserve QueryObserver transitions, including retained data after a failed
// refetch. Only these two data sources are replaced by in-memory fetchers.
vi.mock("@/features/costeo/hooks/useCosteoRutas", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return { useCosteoRutas: () => useQuery({
    queryKey: ["fuentes-test", "rutas"], queryFn: fixtures.rutas, staleTime: Infinity,
  }) };
});
vi.mock("@/features/catalogos/hooks", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    usePuertos: () => useQuery({
      queryKey: ["fuentes-test", "puertos"], queryFn: fixtures.puertos, staleTime: Infinity,
    }),
    useTiposContenedor: () => ({ data: [TIPO] }),
  };
});
vi.mock("@/features/costeo/hooks/useTopTarifas", () => ({
  useTopTarifas: (params: unknown) => fixtures.top(params),
}));
vi.mock("@/features/costeo/hooks/useDiagnosticoTarifas", () => ({
  useDiagnosticoTarifas: (params: unknown) => fixtures.diagnostico(params),
}));
vi.mock("@/features/costeo/hooks/useRecargosDeTarifa", () => ({
  useRecargosDeTarifa: () => ({ data: [] }),
}));

import CosteoBuscar from "../CosteoBuscar";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const TIPO = { id: "10000000-0000-4000-8000-000000000001", name: "Contenedor de prueba", code: "20DV" };
const PUERTOS: PuertoOption[] = [
  { id: A, name: "Origen Alfa", code: "XXALF", country: "Prueba", activo: true },
  { id: B, name: "Destino Beta", code: "XXBET", country: "Prueba", activo: true },
];
const RUTAS: RutaPuertos[] = [{ puerto_origen_id: A, puerto_destino_id: B, activa: true }];
const TARIFA: TopTarifaRow = {
  id: "tarifa-ficticia", organization_id: "organizacion-ficticia", agente_id: "agente-ficticio",
  agente_nombre: "Agente de prueba retenido", dias_credito: 15, naviera_id: "naviera-ficticia",
  naviera_nombre: "Naviera de prueba", ruta_id: "ruta-ficticia", puerto_origen_id: A,
  puerto_destino_id: B, puerto_origen_nombre: "Origen Alfa", puerto_destino_nombre: "Destino Beta",
  puerto_origen_code: "XXALF", puerto_origen_country: "Prueba", puerto_destino_code: "XXBET",
  puerto_destino_country: "Prueba", tipo_contenedor_id: TIPO.id, tipo_contenedor_nombre: TIPO.name,
  moneda: "USD", flete_base: 1000, recargos_total: 50, total_comparable: 1050,
  dias_libres_demoras: 7, transit_time_dias: 20, vigente_desde: "2026-01-01",
  vigente_hasta: "2099-12-31", estado: "vigente", naviera_condicion_id: null,
  naviera_tiene_carta_garantia: false, naviera_carta_garantia_vigente_hasta: null,
  naviera_carta_garantia_activa: false, naviera_dias_libres_default: null, naviera_demora_dia_6: null,
  dias_libres_almacenaje_lcl: null, frecuencia_resuelta: null, naviera_frecuencia: null,
  tarifa_frecuencia_override: null,
};
const EMPTY = "Aún no hay rutas marítimas dadas de alta.";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  const wrapper = createWrapper();
  const client = (globalThis as unknown as { __TEST_QUERY_CLIENT__: QueryClient }).__TEST_QUERY_CLIENT__;
  return { ...render(<CosteoBuscar />, { wrapper }), client };
}

function expectQueriesBlocked() {
  expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: "", puertoDestinoId: "" }));
  expect(fixtures.diagnostico).toHaveBeenLastCalledWith(expect.objectContaining({
    puertoOrigenId: "", puertoDestinoId: "", enabled: false,
  }));
  expect(screen.queryByText(TARIFA.agente_nombre)).not.toBeInTheDocument();
}

async function chooseRoute() {
  const origen = screen.getByRole("combobox", { name: "Puerto de origen" });
  await waitFor(() => expect(origen).not.toBeDisabled());
  fireEvent.click(origen);
  fireEvent.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "Origen Alfa, Prueba (XXALF)" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Puerto de destino" }));
  fireEvent.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "Destino Beta, Prueba (XXBET)" }));
  fireEvent.click(screen.getByLabelText("Tipo contenedor"));
  fireEvent.click(within(await screen.findByRole("listbox")).getByText(TIPO.name));
  expect(await screen.findByText(TARIFA.agente_nombre)).toBeInTheDocument();
  expect(screen.getByText("Costo total estimado")).toBeInTheDocument();
}

beforeEach(() => {
  fixtures.rutas.mockReset().mockResolvedValue(RUTAS);
  fixtures.puertos.mockReset().mockResolvedValue(PUERTOS);
  fixtures.top.mockReset().mockReturnValue({
    data: [TARIFA], isFetching: false, isError: false, isSuccess: true,
    refetch: vi.fn(), tipoContenedorIds: [TIPO.id],
  });
  fixtures.diagnostico.mockReset().mockReturnValue({ diagnostico: undefined });
  fixtures.network.mockReset().mockImplementation(async (input: RequestInfo | URL) => {
    throw new Error(`Unexpected network request: ${String(input)}`);
  });
  vi.stubGlobal("fetch", fixtures.network);
});

afterEach(() => expect(fixtures.network).not.toHaveBeenCalled());

describe("CosteoBuscar — estado de rutas y catálogo", () => {
  it.each(["rutas", "puertos"] as const)("espera la carga inicial de %s sin anunciar rutas vacías", async (fuente) => {
    const pending = deferred<never>();
    fixtures[fuente].mockReturnValueOnce(pending.promise);
    const { client } = renderPage();
    const otra = fuente === "rutas" ? "puertos" : "rutas";
    await waitFor(() => expect(client.getQueryState(["fuentes-test", otra])?.status).toBe("success"));
    expect(screen.getByRole("status")).toHaveTextContent(/Cargando/i);
    expect(screen.queryByText(EMPTY, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Puerto de origen")).toBeDisabled();
    expect(screen.getByLabelText("Puerto de destino")).toBeDisabled();
    expectQueriesBlocked();
  });

  it.each(["rutas", "puertos"] as const)("un error inicial de %s permite reintentar sólo esa fuente", async (fuente) => {
    fixtures[fuente].mockRejectedValueOnce(new Error(`Fallo ficticio de ${fuente}`));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(screen.queryByText(EMPTY, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Puerto de origen")).toBeDisabled();
    expectQueriesBlocked();
    const otra = fuente === "rutas" ? "puertos" : "rutas";
    await waitFor(() => expect(fixtures[otra]).toHaveBeenCalledTimes(1));
    fireEvent.click(within(alert).getByRole("button", { name: /Reintentar/ }));
    await waitFor(() => expect(screen.getByLabelText("Puerto de origen")).not.toBeDisabled());
    expect(fixtures[fuente]).toHaveBeenCalledTimes(2);
    expect(fixtures[otra]).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await chooseRoute();
  });

  it("anuncia vacío sólo después de que ambas fuentes terminan bien", async () => {
    fixtures.rutas.mockResolvedValue([]);
    const pending = deferred<PuertoOption[]>();
    fixtures.puertos.mockReturnValueOnce(pending.promise);
    const { client } = renderPage();
    await waitFor(() => expect(client.getQueryState(["fuentes-test", "rutas"])?.status).toBe("success"));
    expect(screen.queryByText(EMPTY, { exact: false })).not.toBeInTheDocument();
    await act(async () => pending.resolve(PUERTOS));
    expect(await screen.findByText(EMPTY, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Puerto de origen")).toBeDisabled();
    expect(screen.getByLabelText("Puerto de destino")).toBeDisabled();
    expectQueriesBlocked();
  });

  it.each(["rutas", "puertos"] as const)("un refresco de %s conserva la tarifa mientras carga y la oculta si falla, sin perder la selección", async (fuente) => {
    const { client } = renderPage();
    await chooseRoute();
    const pending = deferred<never>();
    fixtures[fuente].mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = client.invalidateQueries({ queryKey: ["fuentes-test", fuente] }); });
    expect(await screen.findByText(/Actualizando/i)).toBeInTheDocument();
    expect(screen.getByText(TARIFA.agente_nombre)).toBeInTheDocument();
    expect(screen.getByLabelText("Puerto de origen")).toHaveTextContent("Origen Alfa");
    expect(screen.getByLabelText("Puerto de destino")).toHaveTextContent("Destino Beta");
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: A, puertoDestinoId: B }));

    await act(async () => { pending.reject(new Error(`Refresco fallido de ${fuente}`)); await refresh; });
    const alert = await screen.findByRole("alert");
    // Query retains the previous rows on refetchError. The UI must still block them.
    expect(client.getQueryData(["fuentes-test", fuente])).toEqual(fuente === "rutas" ? RUTAS : PUERTOS);
    expect(screen.queryByText(EMPTY, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(/Actualizando/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Puerto de origen")).toBeDisabled();
    expect(screen.getByLabelText("Puerto de destino")).toBeDisabled();
    expectQueriesBlocked();

    const otra = fuente === "rutas" ? "puertos" : "rutas";
    const recoveryRutas = deferred<RutaPuertos[]>();
    const recoveryPuertos = deferred<PuertoOption[]>();
    if (fuente === "rutas") fixtures.rutas.mockReturnValueOnce(recoveryRutas.promise);
    else fixtures.puertos.mockReturnValueOnce(recoveryPuertos.promise);
    fireEvent.click(within(alert).getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByRole("button", { name: "Reintentando…" })).toBeDisabled();
    expectQueriesBlocked();
    await act(async () => {
      recoveryRutas.resolve(RUTAS);
      recoveryPuertos.resolve(PUERTOS);
    });
    expect(await screen.findByText(TARIFA.agente_nombre)).toBeInTheDocument();
    expect(screen.getByLabelText("Puerto de origen")).toHaveTextContent("Origen Alfa");
    expect(screen.getByLabelText("Puerto de destino")).toHaveTextContent("Destino Beta");
    expect(screen.getByLabelText("Tipo contenedor")).toHaveTextContent(TIPO.name);
    expect(fixtures.top).toHaveBeenLastCalledWith(expect.objectContaining({ puertoOrigenId: A, puertoDestinoId: B }));
    expect(fixtures[fuente]).toHaveBeenCalledTimes(3);
    expect(fixtures[otra]).toHaveBeenCalledTimes(1);
  });
});
