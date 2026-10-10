import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crmPricingKeys } from "@/features/crm/queryKeys.performance";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import type { TarifaRespuestaRow } from "@/features/crm/services/pricing/tarifasRespuesta";

const mocks = vi.hoisted(() => ({ read: vi.fn(), role: "ejecutivo_pricing" }));
vi.mock("@/features/crm/services/pricing/tarifasRespuesta", () => ({ listarTarifasRespuesta: mocks.read }));
vi.mock("@/features/crm/hooks/usePricingCrm", () => ({ useOpcionesPricing: () => ({ data: [] }) }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ effectiveRole: mocks.role, user: { id: "u1" } }) }));
vi.mock("../AccionesSolicitudPricing", () => ({
  AccionesSolicitudPricing: ({ numOpciones, puedeResponder }: { numOpciones: number; puedeResponder: boolean }) =>
    <div data-testid="acciones">{numOpciones} / {String(puedeResponder)}</div>,
}));
vi.mock("../ResumenSolicitudPricing", () => ({ ResumenSolicitudPricing: () => null }));
vi.mock("../AdjuntosSolicitudPricing", () => ({ AdjuntosSolicitudPricing: () => null }));
vi.mock("../OpcionesTarifario", () => ({ OpcionesTarifario: () => null }));
vi.mock("../OpcionPricingEditor", () => ({ OpcionPricingEditor: () => null }));
vi.mock("@/features/costeo", () => ({
  TarifaForm: ({ onOpenChange, onSaved }: { onOpenChange: (value: boolean) => void; onSaved: () => void }) => (
    <div role="dialog">
      <button onClick={() => onOpenChange(false)}>Cancelar formulario</button>
      <button onClick={() => { onSaved(); onOpenChange(false); }}>Guardar tarifa</button>
      <button onClick={onSaved}>Guardar parte del lote</button>
    </div>
  ),
}));
import { SolicitudPricingDetalle } from "../SolicitudPricingDetalle";

const solicitud: SolicitudPricingRow = {
  id: "s1", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1", created_by: "u1",
  estado: "enviada", folio: "SP1", fecha: "2026-10-06", complejidad: "baja", created_at: "", updated_at: "",
  cantidad: null, cliente: null, commodity: null, container_size: null, deleted_at: null, delivery: null,
  destino: null, dimensiones: null, enviada_at: null, estibable: null, fecha_tentativa_carga: null,
  imo: null, incoterm: null, notas: null, origen: null, peso: null, pod: null, pol: null,
  respondida_at: null, servicio: null, tipo_carga: null, unidad_medida: null, vence_at: null, tarifa_tarifario_id: null,
};
const tarifa: TarifaRespuestaRow = {
  id: "t1", flete_base: 100, moneda: "USD", unidad_flete: null, carta_garantia: null,
  transit_time_dias: null, vigente_hasta: null, agente: { nombre: "Agente nuevo" }, naviera: null, tipo: null, ruta: null,
};
let client: QueryClient;
const view = (estado = "enviada") => (
  <MemoryRouter>
    <QueryClientProvider client={client}><SolicitudPricingDetalle solicitud={{ ...solicitud, estado }} /></QueryClientProvider>
  </MemoryRouter>
);
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(1); }); }

beforeEach(() => {
  vi.useFakeTimers();
  mocks.read.mockReset().mockResolvedValue([]);
  mocks.role = "ejecutivo_pricing";
  focusManager.setFocused(true);
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false, gcTime: Infinity, refetchOnWindowFocus: false } } });
});
afterEach(() => { cleanup(); client.clear(); focusManager.setFocused(undefined); vi.useRealTimers(); });

describe("respuesta Pricing con un único observador", () => {
  it("abrir/cancelar dos veces no relee; guardar refresca y actualiza también el contador", async () => {
    render(view());
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(1);
    const query = client.getQueryCache().find({ queryKey: crmPricingKeys.tarifasRespuesta("s1"), exact: true });
    expect(query?.getObserversCount()).toBe(1);
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Agregar tarifa" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancelar formulario" }));
    }
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(1);
    mocks.read.mockResolvedValue([tarifa]);
    fireEvent.click(screen.getByRole("button", { name: "Agregar tarifa" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar tarifa" }));
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Agente nuevo")).toBeInTheDocument();
    expect(screen.getByTestId("acciones")).toHaveTextContent("1 / true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("el lote parcial actualiza la respuesta manteniendo abierto el formulario", async () => {
    render(view());
    await flush();
    mocks.read.mockResolvedValue([tarifa]);
    fireEvent.click(screen.getByRole("button", { name: "Agregar tarifa" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar parte del lote" }));
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Agente nuevo")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar formulario" }));
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it("cada intervalo tiene una lectura; una respuesta nueva llega y deja de sondear al responder", async () => {
    const { rerender } = render(view());
    await flush();
    mocks.read.mockResolvedValue([tarifa]);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Agente nuevo")).toBeInTheDocument();
    expect(screen.getByTestId("acciones")).toHaveTextContent("1 / true");
    rerender(view("respondida"));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Agregar tarifa" })).not.toBeInTheDocument();
  });

  it("mantiene la pausa en segundo plano y reanuda las lecturas al volver", async () => {
    render(view());
    await flush();
    focusManager.setFocused(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.read).toHaveBeenCalledTimes(1);
    mocks.read.mockResolvedValue([tarifa]);
    focusManager.setFocused(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await flush();
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Agente nuevo")).toBeInTheDocument();
  });

  it.each(["vendedor"])("%s conserva su restricción para agregar tarifas", async (role) => {
    mocks.role = role;
    render(view());
    await flush();
    expect(screen.queryByRole("button", { name: "Agregar tarifa" })).not.toBeInTheDocument();
    expect(client.getQueryCache().find({ queryKey: crmPricingKeys.tarifasRespuesta("s1"), exact: true })?.getObserversCount()).toBe(1);
  });

  it("muestra el error de lectura sin confundirlo con una respuesta vacía", async () => {
    mocks.role = "vendedor";
    mocks.read.mockRejectedValue(new Error("sin conexión"));
    render(view());
    await flush();
    expect(screen.getByText("No se pudieron cargar las tarifas de respuesta.")).toBeInTheDocument();
    expect(screen.queryByText("Pricing aún no agrega tarifas.")).not.toBeInTheDocument();
  });
});
