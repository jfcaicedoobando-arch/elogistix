import { useState } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("react-router", async (o) => ({ ...(await o<typeof import("react-router")>()), useNavigate: () => vi.fn() }));
import { SolicitudPricingCampos, type DatosSolicitud } from "../SolicitudPricingCampos";
import { OpcionesTarifario } from "../OpcionesTarifario";
import { useOpcionesTarifario } from "@/features/crm/hooks/useOpcionesTarifario";
import { crearSolicitud, obtenerSolicitud } from "@/features/crm/services/pricing/pricingCrm";
import type { SolicitudPricingInsert, SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import type { TarifaTarifario } from "@/features/costeo/services/tarifarioService";

const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), rpc: vi.fn(), tarifas: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/features/crm/hooks/usePricingCrm", () => ({ useUsuariosOrgCrm: () => ({ data: [] }) }));
vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({ data: [] }),
  useTiposContenedor: () => ({ data: [{ id: "hc", code: "40HC", name: "40' High Cube" }] }),
}));
vi.mock("@/features/costeo", async () => ({
  costeoQueryKeys: (await import("@/features/costeo/queryKeys")).costeo,
  listarTarifasTarifario: mocks.tarifas, listarCargos: async () => [],
  tarifasCoincidentes: (await import("@/features/costeo/tarifario/coincidencias")).tarifasCoincidentes,
  aplicarTarifaTarifario: (await import("@/features/costeo/services/cargosService")).aplicarTarifaTarifario,
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error }));
vi.mock("@/lib/date/mx", () => ({ hoyMx: () => "2026-10-08" }));

const inicial: SolicitudPricingRow = {
  id: "s1", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1", created_by: "u1",
  estado: "borrador", folio: "SP1", fecha: "2026-10-08", complejidad: "baja", created_at: "", updated_at: "",
  cantidad: null, cliente: null, commodity: null, container_size: null, deleted_at: null, delivery: null,
  destino: null, dimensiones: null, enviada_at: null, estibable: null, fecha_tentativa_carga: null,
  imo: null, incoterm: null, notas: null, origen: null, peso: null, pod: "Manzanillo", pol: "Shanghai",
  respondida_at: null, servicio: "Marítimo", tipo_carga: null, unidad_medida: null, vence_at: null, tarifa_tarifario_id: null,
};
const tarifas: TarifaTarifario[] = ["20GP", "40GP", "40HC"].map((code, i) => ({
  id: code, flete_base: 100 + i, moneda: "USD", dias_libres_demoras: 14,
  vigente_desde: "2026-10-01", vigente_hasta: "2026-10-31", notas: null, solicitud_pricing_id: null,
  agente: null, naviera: null, tipo: { code },
  ruta: { origen: { name: "Shanghai" }, destino: { name: "Manzanillo" } },
}));
let guardada: SolicitudPricingRow;
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  guardada = { ...inicial };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  mocks.tarifas.mockResolvedValue(tarifas);
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.insert.mockImplementation((input: SolicitudPricingInsert) => {
    // Simula la serialización/lectura de la fila; no completa container_size.
    guardada = JSON.parse(JSON.stringify({ ...inicial, ...input, folio: "SP1" }));
    return { select: () => ({ single: async () => ({ data: guardada, error: null }) }) };
  });
  mocks.from.mockReturnValue({
    insert: mocks.insert,
    select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: guardada, error: null }) }) }) }),
  });
});
afterEach(() => client.clear());

function Flujo() {
  const [datos, setDatos] = useState<DatosSolicitud>({ solicitante_id: "u1", servicio: "Marítimo", pol: "Shanghai", pod: "Manzanillo" });
  const [solicitud, setSolicitud] = useState<SolicitudPricingRow | null>(null);
  const guardar = async () => {
    const creada = await crearSolicitud({ ...datos, folio: "", organization_id: "org1", oportunidad_id: "o1" });
    setSolicitud(await obtenerSolicitud(creada.id));
  };
  return <>
    <SolicitudPricingCampos datos={datos} set={(campo, valor) => setDatos((prev) => ({ ...prev, [campo]: valor }))} />
    <button onClick={() => void guardar()}>Guardar borrador de prueba</button>
    {solicitud && <OpcionesTarifario solicitud={solicitud} puedeElegir />}
  </>;
}
const wrapper = ({ children }: { children: React.ReactNode }) =>
  <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe("formulario → persistencia → coincidencias → selección", () => {
  it("guarda el nombre en tipo_carga y sólo permite seleccionar 40HC con container_size nulo", async () => {
    render(<Flujo />, { wrapper });
    fireEvent.click(screen.getByLabelText("Tipo de contenedor"));
    fireEvent.click(await screen.findByRole("option", { name: "40' High Cube" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador de prueba" }));
    const elegir = await screen.findByRole("button", { name: "Usar esta opción" });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ tipo_carga: "40' High Cube" }));
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("container_size");
    expect(guardada.container_size).toBeNull();
    const resumenContenedor = screen.getByText("Tipo de contenedor:").parentElement;
    expect(resumenContenedor).toHaveTextContent(/^Tipo de contenedor:\s*40HC\s*Flete base:/);
    expect(screen.queryByText(/\b20GP\b/)).toBeNull();
    expect(screen.queryByText(/\b40GP\b/)).toBeNull();
    expect(screen.getAllByRole("button", { name: "Usar esta opción" })).toHaveLength(1);
    fireEvent.click(elegir);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("crm_aplicar_tarifa_tarifario", { p_solicitud_id: "s1", p_tarifa_id: "40HC" }));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("una solicitud sin tipo guardado no ofrece seleccionar ninguna tarifa", async () => {
    render(<Flujo />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador de prueba" }));
    await screen.findByText(/No hay tarifas vigentes/);
    expect(screen.queryByRole("button", { name: "Usar esta opción" })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("la selección directa del hook rechaza un id incompatible y permite el compatible", async () => {
    const { result } = renderHook(() => useOpcionesTarifario({ ...inicial, tipo_carga: "40HC" }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    for (const incompatible of ["20GP", "40GP"]) {
      await act(async () => result.current.elegir(incompatible));
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenLastCalledWith(undefined, expect.objectContaining({
        error: expect.objectContaining({ message: "LC_PRICING_TARIFA_INCOMPATIBLE" }),
      }));
    }
    expect(mocks.error).toHaveBeenCalledTimes(2);
    await act(async () => result.current.elegir("40HC"));
    expect(mocks.rpc).toHaveBeenCalledWith("crm_aplicar_tarifa_tarifario", { p_solicitud_id: "s1", p_tarifa_id: "40HC" });
  });
});
