import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueries } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { useConvertirProformaDirecto } from "../useConvertirProformaDirecto";
import { useAprobarProformaInterna } from "../useAprobarProformaInterna";
import { RespuestaClienteManualDialog } from "../../components/RespuestaClienteManualDialog";

// Only the I/O services are doubled. QueryClient, observers, mutations,
// notifications and the manual dialog run their real implementations.
const services = vi.hoisted(() => ({
  serie: vi.fn(), convertir: vi.fn(), aprobar: vi.fn(), responder: vi.fn(),
  read: vi.fn<(name: string) => Promise<string>>(),
}));
vi.mock("@/features/proformas/services/convertirAFactura", () => ({
  fetchPrimeraSerieActiva: services.serie,
  convertirProformaAFactura: services.convertir,
}));
vi.mock("@/features/proformas/services/respuestaCliente", () => ({
  aceptarProformaSinAutorizacion: services.aprobar,
  actualizarEstadoClienteProforma: services.responder,
}));

// Synthetic read-service projections identify visible data from each canonical
// consumer key. They deliberately avoid reproducing backend business rules.
const org = "synthetic-org";
const entries = [
  { name: "proforma", key: queryKeys.proformas.detalle("synthetic-proforma") },
  { name: "facturas", key: queryKeys.facturas.byOrg(org) },
  { name: "full", key: queryKeys.embarques.full("synthetic-embarque") },
  { name: "conceptos", key: queryKeys.embarques.conceptosVenta("synthetic-embarque") },
  { name: "porTimbrar", key: queryKeys.facturacion.bandejaPorTimbrar(org) },
  { name: "conteos", key: queryKeys.facturacion.bandejaConteos(org) },
  { name: "listas", key: queryKeys.facturacion.bandejaProformasListas(org) },
  { name: "listasCount", key: queryKeys.facturacion.bandejaProformasListasCount(org) },
];
type Projection = Record<string, string>;
const before: Projection = {
  proforma: "aceptada", facturas: "[]", full: "sin borrador",
  conceptos: "proformado", porTimbrar: "[]", conteos: "porTimbrar=0",
  listas: "synthetic-proforma", listasCount: "1",
};
const converted: Projection = {
  proforma: "facturada", facturas: "synthetic-borrador", full: "synthetic-borrador",
  conceptos: "facturado:synthetic-borrador", porTimbrar: "synthetic-borrador",
  conteos: "porTimbrar=1", listas: "[]", listasCount: "0",
};
const accepted: Projection = { ...before, proforma: "aceptada", listas: "synthetic-proforma", listasCount: "1" };
const awaiting: Projection = { ...before, proforma: "pendiente", listas: "[]", listasCount: "0" };
const rejected: Projection = {
  ...awaiting, proforma: "rechazada", full: "conceptos pendientes", conceptos: "pendiente",
};
const clients: QueryClient[] = [];

function setup(initial: Projection, next: Projection) {
  const client = new QueryClient({ defaultOptions: {
    queries: { staleTime: 60_000, gcTime: Infinity, retry: false,
      refetchOnWindowFocus: false, refetchOnReconnect: false },
    mutations: { retry: false },
  } });
  clients.push(client);
  for (const entry of entries) client.setQueryData(entry.key, initial[entry.name]);
  services.read.mockImplementation(async (name) => next[name]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  function useConsumers() {
    const results = useQueries({ queries: entries.map((entry) => ({
      queryKey: entry.key, queryFn: () => services.read(entry.name), staleTime: 60_000,
    })) });
    return {
      data: Object.fromEntries(results.map((result, i) => [entries[i].name, result.data])),
      results,
    };
  }
  function assertFreshAndObserved() {
    expect(services.read).not.toHaveBeenCalled();
    for (const entry of entries) {
      const query = client.getQueryCache().find({ queryKey: entry.key, exact: true });
      expect(query?.getObserversCount()).toBeGreaterThan(0);
      expect(query?.isStale()).toBe(false);
    }
  }
  return { client, wrapper, useConsumers, assertFreshAndObserved };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function convert(run: ReturnType<typeof useConvertirProformaDirecto>["convertir"]) {
  run({ proformaIds: ["synthetic-proforma"], organizationId: org });
}

function mountManual(initial: Projection, next: Projection, modo: "aceptada" | "rechazada") {
  const harness = setup(initial, next);
  const consumer = renderHook(harness.useConsumers, { wrapper: harness.wrapper });
  let closes = 0;
  render(<RespuestaClienteManualDialog open proformaId="synthetic-proforma" numero="SYN-1"
    modo={modo} onOpenChange={(open) => { if (!open) closes++; }} />, { wrapper: harness.wrapper });
  harness.assertFreshAndObserved();
  const button = screen.getByRole("button", { name: modo === "aceptada" ? "Confirmar aceptación" : "Confirmar rechazo" });
  if (modo === "rechazada") fireEvent.change(screen.getByLabelText("Motivo de rechazo *"), { target: { value: "Motivo sintético" } });
  return { ...harness, consumer, button, closed: () => closes };
}

beforeEach(() => {
  vi.resetAllMocks();
  services.serie.mockResolvedValue({ id: "synthetic-serie", prefijo: "SYN" });
  services.convertir.mockResolvedValue([{ facturaId: "synthetic-borrador", facturaNumero: "BORRADOR-SYN", moneda: "MXN" }]);
  services.aprobar.mockResolvedValue({ proforma_id: "synthetic-proforma", estado_cliente: "aceptada", sin_cambios: false });
  services.responder.mockResolvedValue({ id: "synthetic-proforma", estado_cliente: "aceptada" });
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

describe("proforma mutations refresh mounted consumers with fresh caches", () => {
  it("shows the new draft in shipment/invoices, updated concepts and billing trays without remount", async () => {
    const h = setup(before, converted);
    const { result } = renderHook(() => ({ mutation: useConvertirProformaDirecto(), views: h.useConsumers() }), { wrapper: h.wrapper });
    h.assertFreshAndObserved();
    act(() => convert(result.current.mutation.convertir));
    await waitFor(() => expect(services.convertir).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.mutation.isPending).toBe(false));
    expect(result.current.views.data).toEqual(converted);
    expect(services.convertir).toHaveBeenCalledWith({
      proformaIds: ["synthetic-proforma"], serieId: "synthetic-serie", metodoPago: "PPD",
      formaPago: "99", usoCfdi: "G03", diasCredito: null, notas: null, requestId: expect.any(String),
    });
  });

  it("keeps conversion pending until the slow observed shipment refetch settles", async () => {
    const h = setup(before, converted);
    const slow = deferred<string>();
    services.read.mockImplementation(async (name) => name === "full" ? slow.promise : converted[name]);
    const { result } = renderHook(() => ({ mutation: useConvertirProformaDirecto(), views: h.useConsumers() }), { wrapper: h.wrapper });
    act(() => convert(result.current.mutation.convertir));
    await waitFor(() => expect(services.read).toHaveBeenCalledWith("full"));
    await waitFor(() => expect(result.current.views.data.porTimbrar).toBe("synthetic-borrador"));
    expect(result.current.mutation.isPending).toBe(true);
    expect(result.current.views.data.full).toBe(before.full);
    await act(async () => slow.resolve(converted.full));
    await waitFor(() => expect(result.current.mutation.isPending).toBe(false));
    expect(result.current.views.data).toEqual(converted);
  });

  it("releases conversion pending after a refetch error and exposes the observer error with retained data", async () => {
    const h = setup(before, converted);
    const error = new Error("synthetic read failure");
    services.read.mockImplementation(async (name) => { if (name === "conceptos") throw error; return converted[name]; });
    const { result } = renderHook(() => ({ mutation: useConvertirProformaDirecto(), views: h.useConsumers() }), { wrapper: h.wrapper });
    act(() => convert(result.current.mutation.convertir));
    await waitFor(() => expect(services.read).toHaveBeenCalledWith("conceptos"));
    await waitFor(() => expect(result.current.mutation.isPending).toBe(false));
    const conceptos = result.current.views.results[3];
    expect(conceptos.isRefetchError).toBe(true);
    expect(conceptos.error).toBe(error);
    expect(conceptos.data).toBe(before.conceptos);
    expect(result.current.views.data.porTimbrar).toBe(converted.porTimbrar);
    expect(h.client.getQueryState(entries[3].key)?.isInvalidated).toBe(true);
  });

  it("does not refresh successful caches when conversion service rejects", async () => {
    const h = setup(before, converted);
    const slow = deferred<never>();
    services.convertir.mockReturnValue(slow.promise);
    const { result } = renderHook(useConvertirProformaDirecto, { wrapper: h.wrapper });
    const consumer = renderHook(h.useConsumers, { wrapper: h.wrapper });
    act(() => convert(result.current.convertir));
    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => slow.reject(new Error("synthetic denied")));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(services.read).not.toHaveBeenCalled();
    expect(consumer.result.current.data).toEqual(before);
  });

  it("refreshes Proformas listas and count after internal acceptance", async () => {
    const h = setup(awaiting, accepted);
    const { result } = renderHook(() => ({ mutation: useAprobarProformaInterna(), views: h.useConsumers() }), { wrapper: h.wrapper });
    h.assertFreshAndObserved();
    act(() => result.current.mutation.aprobar("synthetic-proforma"));
    await waitFor(() => expect(services.aprobar).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.mutation.isPending).toBe(false));
    expect(result.current.views.data).toEqual(accepted);
  });

  it("keeps internal approval pending for a deferred count refetch", async () => {
    const h = setup(awaiting, accepted);
    const slow = deferred<string>();
    services.read.mockImplementation(async (name) => name === "listasCount" ? slow.promise : accepted[name]);
    const { result } = renderHook(() => ({ mutation: useAprobarProformaInterna(), views: h.useConsumers() }), { wrapper: h.wrapper });
    act(() => result.current.mutation.aprobar("synthetic-proforma"));
    await waitFor(() => expect(services.read).toHaveBeenCalledWith("listasCount"));
    expect(result.current.mutation.isPending).toBe(true);
    await act(async () => slow.resolve("1"));
    await waitFor(() => expect(result.current.mutation.isPending).toBe(false));
    expect(result.current.views.data.listasCount).toBe("1");
  });

  it("does not refresh caches when internal approval fails", async () => {
    const h = setup(awaiting, accepted);
    services.aprobar.mockRejectedValue(new Error("synthetic approval failure"));
    const { result } = renderHook(() => ({ mutation: useAprobarProformaInterna(), views: h.useConsumers() }), { wrapper: h.wrapper });
    act(() => result.current.mutation.aprobar("synthetic-proforma"));
    await waitFor(() => expect(services.aprobar).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.mutation.isPending).toBe(false));
    expect(services.read).not.toHaveBeenCalled();
    expect(result.current.views.data).toEqual(awaiting);
  });

  it("refreshes Proformas listas/count after manual acceptance before closing", async () => {
    const h = mountManual(awaiting, accepted, "aceptada");
    fireEvent.click(h.button);
    await waitFor(() => expect(h.closed()).toBe(1));
    expect(h.consumer.result.current.data).toEqual(accepted);
    expect(services.responder).toHaveBeenCalledWith("synthetic-proforma", "aceptada", "");
  });

  it.each(["aceptada", "rechazada"] as const)("keeps manual %s busy through a deferred refetch", async (modo) => {
    const next = modo === "aceptada" ? accepted : rejected;
    const h = mountManual(modo === "aceptada" ? awaiting : before, next, modo);
    const slow = deferred<string>();
    const name = modo === "aceptada" ? "listasCount" : "conceptos";
    services.read.mockImplementation(async (key) => key === name ? slow.promise : next[key]);
    fireEvent.click(h.button);
    await waitFor(() => expect(services.read).toHaveBeenCalledWith(name));
    expect(h.button).toBeDisabled();
    expect(h.closed()).toBe(0);
    await act(async () => slow.resolve(next[name]));
    await waitFor(() => expect(h.closed()).toBe(1));
    expect(h.consumer.result.current.data).toEqual(next);
    expect(h.button).toBeEnabled();
  });

  it("refreshes released concepts and shipment after manual rejection", async () => {
    const h = mountManual(before, rejected, "rechazada");
    fireEvent.click(h.button);
    await waitFor(() => expect(h.closed()).toBe(1));
    expect(h.consumer.result.current.data).toEqual(rejected);
    expect(services.responder).toHaveBeenCalledWith("synthetic-proforma", "rechazada", "Motivo sintético");
  });

  it("keeps the manual dialog open and releases loading when its service rejects", async () => {
    const h = mountManual(awaiting, accepted, "aceptada");
    services.responder.mockRejectedValue(new Error("synthetic permission denied"));
    fireEvent.click(h.button);
    await waitFor(() => expect(services.responder).toHaveBeenCalledOnce());
    await waitFor(() => expect(h.button).toBeEnabled());
    expect(h.closed()).toBe(0);
    expect(services.read).not.toHaveBeenCalled();
    expect(h.consumer.result.current.data).toEqual(awaiting);
  });

  it("settles manual loading on a count refetch error while the observer retains data and exposes the error", async () => {
    const h = mountManual(awaiting, accepted, "aceptada");
    const error = new Error("synthetic count read failure");
    services.read.mockImplementation(async (name) => { if (name === "listasCount") throw error; return accepted[name]; });
    fireEvent.click(h.button);
    await waitFor(() => expect(services.read).toHaveBeenCalledWith("listasCount"));
    await waitFor(() => expect(h.closed()).toBe(1));
    expect(h.button).toBeEnabled();
    expect(h.consumer.result.current.results[7].isRefetchError).toBe(true);
    expect(h.consumer.result.current.results[7].error).toBe(error);
    expect(h.consumer.result.current.data.listasCount).toBe("0");
    expect(h.client.getQueryState(entries[7].key)?.isInvalidated).toBe(true);
  });
});
