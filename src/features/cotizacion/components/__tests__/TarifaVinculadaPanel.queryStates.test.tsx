import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TarifaVinculadaPanel from "../TarifaVinculadaPanel";
import { fetchTarifaVinculada } from "@/features/cotizacion/services/tarifaVinculada";
import { desvincularTarifa } from "../seccionRuta/rutaPuertoHandlers";
import { queryKeys } from "@/lib/query";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";

vi.mock("@/features/cotizacion/services/tarifaVinculada", () => ({ fetchTarifaVinculada: vi.fn() }));
vi.mock("@/features/catalogos/hooks", () => ({ useTiposContenedor: () => ({ data: [] }) }));
vi.mock("@/features/costeo", () => ({ destinoDe: vi.fn(), origenDe: vi.fn(), etiquetaRutaCompleta: () => "Ruta ficticia" }));
vi.mock("@/features/costeo/components/BuscarTarifaDialog", () => ({ BuscarTarifaDialog: () => null }));
vi.mock("@/features/catalogos", () => ({ claveIdentidadCatalogo: vi.fn() }));
vi.mock("../TarifaResumenHeredado", () => ({ default: () => null }));
vi.mock("../seccionRuta/SugerenciasTarifaInline", () => ({ default: () => <p>Elegir tarifa</p> }));
vi.mock("../seccionRuta/rutaPuertoHandlers", () => ({ desvincularTarifa: vi.fn() }));
vi.mock("../seccionRuta/aplicarTarifa", () => ({ aplicarTarifaAlForm: vi.fn() }));

const tarifa = { id: "tarifa-ficticia", naviera_nombre: "Naviera ficticia", agente_nombre: "Agente ficticio",
  tipo_contenedor_nombre: "40HC", flete_base: 100, recargos_total: 20, vigente_hasta: "2099-12-31" } as TopTarifaRow;
const consulta = vi.mocked(fetchTarifaVinculada);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
function Fixture({ client, tarifaId = tarifa.id }: { client: QueryClient; tarifaId?: string | null }) {
  const form = useForm<CotizacionFormValues>({ defaultValues: { ...COTIZACION_FORM_DEFAULTS, modo: "Marítimo", tarifaId } });
  return <QueryClientProvider client={client}><FormProvider {...form}>
    <TarifaVinculadaPanel /><output aria-label="Vínculo conservado">{form.watch("tarifaId")}</output>
  </FormProvider></QueryClientProvider>;
}
function setup(tarifaId?: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<Fixture client={client} tarifaId={tarifaId} />);
  return client;
}
function conservaVinculo() {
  expect(screen.getByLabelText("Vínculo conservado")).toHaveTextContent(tarifa.id);
  expect(desvincularTarifa).not.toHaveBeenCalled();
  expect(screen.queryByText(/ya no está vigente o fue eliminada/)).not.toBeInTheDocument();
}
beforeEach(() => vi.clearAllMocks());

describe("H09 · consulta real y estados de tarifa vinculada", () => {
  it("espera la carga sin declarar ausencia ni ofrecer quitar", () => {
    consulta.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByText("Cargando tarifa…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/no está disponible entre/)).not.toBeInTheDocument();
    conservaVinculo();
  });

  it("un fallo inicial no declara ausencia y permite reintentar hasta recuperar datos", async () => {
    const reintento = deferred<TopTarifaRow | null>();
    consulta.mockRejectedValueOnce(new Error("Red ficticia")).mockReturnValueOnce(reintento.promise);
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos consultar la tarifa vinculada.");
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
    conservaVinculo();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Cargando tarifa…");
    expect(consulta).toHaveBeenCalledTimes(2);
    await act(async () => reintento.resolve(tarifa));
    expect(await screen.findByText("Naviera ficticia")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    conservaVinculo();
  });

  it("sólo una consulta exitosa sin fila permite quitar el vínculo", async () => {
    consulta.mockResolvedValue(null);
    setup();
    expect(await screen.findByText(/no está disponible entre las tarifas vigentes/)).toBeInTheDocument();
    conservaVinculo();
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(desvincularTarifa).toHaveBeenCalledTimes(1);
  });

  it("conserva datos en caché durante actualización, fallo y reintento", async () => {
    const refresco = deferred<TopTarifaRow | null>();
    const reintento = deferred<TopTarifaRow | null>();
    consulta.mockResolvedValueOnce(tarifa).mockReturnValueOnce(refresco.promise).mockReturnValueOnce(reintento.promise);
    const client = setup();
    await screen.findByText("Naviera ficticia");
    void client.invalidateQueries({ queryKey: queryKeys.cotizaciones.tarifaVinculada(tarifa.id) });
    expect(await screen.findByText(/Actualizando tarifa/)).toBeInTheDocument();
    expect(screen.getByText("Naviera ficticia")).toBeInTheDocument();
    await act(async () => refresco.reject(new Error("Refresco ficticio fallido")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mostramos los últimos datos consultados.");
    expect(screen.getByText("Naviera ficticia")).toBeInTheDocument();
    expect(screen.queryByText(/no está disponible entre/)).not.toBeInTheDocument();
    conservaVinculo();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    const boton = await screen.findByRole("button", { name: "Reintentando…" });
    expect(boton).toBeDisabled();
    fireEvent.click(boton);
    expect(consulta).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Naviera ficticia")).toBeInTheDocument();
    await act(async () => reintento.resolve({ ...tarifa, naviera_nombre: "Naviera actualizada" }));
    expect(await screen.findByText("Naviera actualizada")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    conservaVinculo();
  });

  it("si falla el refresco de una ausencia anterior deja de afirmarla", async () => {
    consulta.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Red ficticia"));
    const client = setup();
    await screen.findByText(/no está disponible entre/);
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.cotizaciones.tarifaVinculada(tarifa.id) }); });
    await screen.findByRole("alert");
    expect(screen.queryByText(/no está disponible entre/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
    conservaVinculo();
  });

  it("sin vínculo no consulta ni anuncia carga, error o ausencia", async () => {
    setup(null);
    await waitFor(() => expect(screen.getByText("Elegir tarifa")).toBeInTheDocument());
    expect(consulta).not.toHaveBeenCalled();
    expect(screen.queryByText("Cargando tarifa…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/no está disponible entre/)).not.toBeInTheDocument();
  });
});
