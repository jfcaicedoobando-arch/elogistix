import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("react-router", async (o) => ({ ...(await o<typeof import("react-router")>()), useNavigate: () => vi.fn() }));
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import type { TarifaTarifario } from "@/features/costeo";
import { costeo } from "@/features/costeo/queryKeys";
import { OpcionesTarifario } from "../OpcionesTarifario";

const mocks = vi.hoisted(() => ({ tarifas: vi.fn(), cargos: vi.fn(), aplicar: vi.fn(), coincidencias: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/features/costeo", async () => ({
  costeoQueryKeys: (await import("@/features/costeo/queryKeys")).costeo,
  listarTarifasTarifario: mocks.tarifas, listarCargos: mocks.cargos,
  aplicarTarifaTarifario: mocks.aplicar, tarifasCoincidentes: mocks.coincidencias,
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error }));

const solicitud: SolicitudPricingRow = {
  id: "s1", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1", created_by: "u1",
  estado: "enviada", folio: "SP1", fecha: "2026-10-06", complejidad: "baja", created_at: "", updated_at: "",
  cantidad: null, cliente: null, commodity: null, container_size: null, deleted_at: null, delivery: null,
  destino: null, dimensiones: null, enviada_at: null, estibable: null, fecha_tentativa_carga: null,
  imo: null, incoterm: null, notas: null, origen: null, peso: null, pod: null, pol: null,
  respondida_at: null, servicio: null, tipo_carga: null, unidad_medida: null, vence_at: null, tarifa_tarifario_id: null,
};

const tarifa: TarifaTarifario = {
  id: "t1", flete_base: 100, moneda: "USD", dias_libres_demoras: null,
  vigente_desde: "2026-01-01", vigente_hasta: "2026-12-31", notas: null, solicitud_pricing_id: null,
  agente: { id: "a1", nombre: "Agente" }, naviera: { id: "n1", name: "Naviera" }, tipo: { code: "20" },
  ruta: { origen: { name: "Shanghai" }, destino: { name: "Manzanillo" } },
};
let client: QueryClient;
function montar(overrides: Partial<SolicitudPricingRow> = {}, puedeElegir = true) {
  return render(<QueryClientProvider client={client}>
    <OpcionesTarifario solicitud={{ ...solicitud, ...overrides }} puedeElegir={puedeElegir} />
  </QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  mocks.tarifas.mockResolvedValue([tarifa]); mocks.cargos.mockResolvedValue([]);
  mocks.aplicar.mockResolvedValue(undefined);
  mocks.coincidencias.mockImplementation((_s: unknown, tarifas: TarifaTarifario[]) => tarifas);
});
afterEach(() => { cleanup(); client.clear(); });

describe("OpcionesTarifario", () => {
  it("comparte las claves de Costeo y omite cargos FOB si el incoterm no aplica", async () => {
    montar();
    await screen.findByRole("button", { name: "Usar esta opción" });
    expect(client.getQueryData(costeo.tarifario.tarifas("vigentes"))).toEqual([tarifa]);
    expect(mocks.cargos).toHaveBeenCalledWith("locales");
    expect(mocks.cargos).not.toHaveBeenCalledWith("fob");
  });
  it("muestra sólo cargos del agente y la naviera de la opción", async () => {
    mocks.cargos.mockImplementation(async (tipo: string) => [
      { id: tipo, concepto: tipo === "fob" ? "Cargo FOB" : "Revalidación", monto: 10, moneda: "USD", unidad: null, entidad_id: tipo === "fob" ? "a1" : "n1", entidad: null },
      { id: `${tipo}-ajeno`, concepto: "Ajeno", monto: 20, moneda: "USD", unidad: null, entidad_id: "otra", entidad: null },
    ]);
    montar({ incoterm: "FOB" });
    expect(await screen.findByText(/Cargo FOB/)).toBeInTheDocument();
    expect(await screen.findByText(/Revalidación/)).toBeInTheDocument();
    expect(screen.queryByText(/Ajeno/)).toBeNull();
  });
  it("informa éxito e invalida los datos tras aplicar la opción", async () => {
    const invalidar = vi.spyOn(client, "invalidateQueries");
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Usar esta opción" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(mocks.aplicar).toHaveBeenCalledWith("s1", "t1");
    expect(invalidar).toHaveBeenCalled();
  });
  it("preserva la excepción en el diagnóstico y permite reintentar", async () => {
    const error = new Error("tarifa vencida");
    mocks.aplicar.mockRejectedValueOnce(error);
    montar();
    const boton = await screen.findByRole("button", { name: "Usar esta opción" });
    await act(async () => { fireEvent.click(boton); });
    expect(mocks.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ error, method: "CRM_APLICAR_TARIFA_TARIFARIO" }));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
  });
  it("mantiene la elegida visible sin ofrecer otra selección", async () => {
    montar({ estado: "respondida", tarifa_tarifario_id: "t1" });
    expect(await screen.findByText(/Shanghai/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opción elegida del tarifario" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar esta opción" })).toBeNull();
  });
  it("muestra el vacío canónico y respeta permisos de selección", async () => {
    mocks.tarifas.mockResolvedValue([]);
    montar({}, false);
    expect(await screen.findByText(/No hay tarifas vigentes/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar esta opción" })).toBeNull();
  });
});
