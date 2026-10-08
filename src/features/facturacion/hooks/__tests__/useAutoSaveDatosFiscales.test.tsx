/** @vitest-environment jsdom */
import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { dehydrate, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { queryKeys } from "@/lib/query";
import { useAutoSaveDatosFiscales } from "../useAutoSaveDatosFiscales";

const mocks = vi.hoisted(() => ({ guardar: vi.fn(), error: vi.fn() }));
vi.mock("@/features/facturacion/services", () => ({ actualizarDatosTimbradoFactura: mocks.guardar }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.error }));
const values = { usoCfdi: "G03", formaPago: "03", metodoPago: "PUE", diasCredito: 0, tipoCambio: 1, notas: "original" };
const factura = { id: "f1", organization_id: "org1", uso_cfdi: "G03", notas: "original", estado: "Borrador", uuid_fiscal: null, facturapi_id: null };
const deferred = () => {
  let resolve!: () => void; let reject!: (e: Error) => void;
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
function setup(strict = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  qc.setQueryData(queryKeys.facturas.detail("f1"), factura);
  const hook = renderHook(({ id, org, state }) => useAutoSaveDatosFiscales(id, "MXN", state, org), {
    initialProps: { id: "f1", org: "org1", state: values },
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{strict ? <StrictMode>{children}</StrictMode> : children}</QueryClientProvider>,
  });
  return { ...hook, qc, editar: (usoCfdi: string) => hook.rerender({ id: "f1", org: "org1", state: { ...values, usoCfdi } }) };
}
const pause = () => act(() => new Promise((resolve) => setTimeout(resolve, 650)));
function usuario(userId = "u1") {
  setAuthSnapshot({ userId, organizationId: "org1", role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId, organizationId: "org1" });
}
beforeEach(() => { usuario(); vi.clearAllMocks(); mocks.guardar.mockResolvedValue(undefined); });

describe("autosave fiscal: destino, cola y respuestas tardías", () => {
  it("hidratar incluso en StrictMode no dispara guardados", async () => {
    setup(true); await pause(); expect(mocks.guardar).not.toHaveBeenCalled();
  });
  it("serializa elecciones sucesivas y una respuesta vieja no marca la última como guardada", async () => {
    const a = deferred(); const b = deferred();
    mocks.guardar.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { editar, result, qc } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    editar("G01"); await pause(); expect(mocks.guardar).toHaveBeenCalledOnce();
    expect(dehydrate(qc).mutations).toEqual([]);
    await act(async () => { a.resolve(); await a.promise; });
    expect(result.current.estado).toBe("saving");
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledTimes(2));
    expect(mocks.guardar.mock.calls.map((c) => c[1].uso_cfdi)).toEqual(["S01", "G01"]);
    await act(async () => { b.resolve(); await b.promise; });
    await waitFor(() => expect(result.current.estado).toBe("saved"));
    expect(qc.getQueryData<typeof factura>(queryKeys.facturas.detail("f1"))?.uso_cfdi).toBe("G01");
  });
  it("respuesta tardía del destino anterior no cambia campos ni indicador de otra factura/empresa", async () => {
    const pendiente = deferred(); mocks.guardar.mockReturnValueOnce(pendiente.promise);
    const { editar, rerender, result, qc } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    const otra = { ...factura, id: "f2", organization_id: "org2", uso_cfdi: "G01", notas: "otra" };
    qc.setQueryData(queryKeys.facturas.detail("f2"), otra);
    rerender({ id: "f2", org: "org2", state: { ...values, usoCfdi: "G01", notas: "otra" } });
    await act(async () => { pendiente.resolve(); await pendiente.promise; });
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(qc.getQueryData(queryKeys.facturas.detail("f2"))).toEqual(otra);
    expect(result.current.estado).toBe("idle"); expect(result.current.ultimoGuardado).toBeNull();
    expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith("f1", expect.objectContaining({ uso_cfdi: "S01", notas: "original" }), undefined, expect.objectContaining({ organizationId: "org1", borrador: true, authScope: expect.any(Object) }));
  });
  it("no aplica una respuesta vieja a una fila de otra empresa en la misma key", async () => {
    const pendiente = deferred(); mocks.guardar.mockReturnValueOnce(pendiente.promise);
    const { editar, rerender, qc } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    const otra = { ...factura, organization_id: "org2", uso_cfdi: "G01" };
    qc.setQueryData(queryKeys.facturas.detail("f1"), otra);
    rerender({ id: "f1", org: "org2", state: { ...values, usoCfdi: "G01" } });
    await act(async () => { pendiente.resolve(); await pendiente.promise; });
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(qc.getQueryData(queryKeys.facturas.detail("f1"))).toEqual(otra);
  });
  it("un fallo tardío identifica la factura original y no pone en error el formulario nuevo", async () => {
    const pendiente = deferred(); mocks.guardar.mockReturnValueOnce(pendiente.promise);
    const { editar, rerender, result } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    rerender({ id: "f2", org: "org2", state: { ...values, usoCfdi: "G01" } });
    await act(async () => { pendiente.reject(new Error("rechazado")); });
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(result.current.estado).toBe("idle");
    expect(mocks.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ context: { facturaId: "f1", organizationId: "org1" } }));
  });
  it("desmontar después de enviar no finge abortar: reconcilia sólo la escritura confirmada", async () => {
    const pendiente = deferred(); mocks.guardar.mockReturnValueOnce(pendiente.promise);
    const { editar, unmount, qc } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce()); unmount();
    expect(qc.isMutating()).toBe(1);
    await act(async () => { pendiente.resolve(); await pendiente.promise; });
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(qc.getQueryData<typeof factura>(queryKeys.facturas.detail("f1"))?.uso_cfdi).toBe("S01");
    expect(mocks.guardar).toHaveBeenCalledOnce(); expect(mocks.error).not.toHaveBeenCalled();
  });
  it("una selección en cola cancelada al salir no se envía tras la escritura anterior", async () => {
    const pendiente = deferred(); mocks.guardar.mockReturnValueOnce(pendiente.promise);
    const { editar, unmount, qc } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    editar("G01"); await pause(); unmount();
    await act(async () => { pendiente.resolve(); await pendiente.promise; });
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(mocks.guardar).toHaveBeenCalledOnce();
    expect(qc.getQueryData<typeof factura>(queryKeys.facturas.detail("f1"))?.uso_cfdi).toBe("S01");
  });

  it("A→B misma empresa/factura sin desmontar cancela antes de enviar el debounce", async () => {
    const { editar, qc } = setup();
    editar("S01"); usuario("u2"); await pause();
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(mocks.guardar).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
    // El nuevo usuario no hereda ni revive el formulario anterior.
    editar("G01"); await pause(); expect(mocks.guardar).not.toHaveBeenCalled();
  });
  it("A→B en la cola impide el segundo envío y descarta respuesta/caché de A", async () => {
    const pendiente = deferred(); mocks.guardar.mockReturnValueOnce(pendiente.promise);
    const { editar, qc } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    editar("G01"); await pause(); usuario("u2");
    await act(async () => { pendiente.resolve(); await pendiente.promise; });
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(mocks.guardar).toHaveBeenCalledOnce(); expect(mocks.error).not.toHaveBeenCalled();
    expect(qc.getQueryData(queryKeys.facturas.detail("f1"))).toEqual(factura);
  });
  it("A→B→A no revive la captura ni muestra el fallo tardío de otra generación", async () => {
    const pendiente = deferred(); mocks.guardar.mockReturnValueOnce(pendiente.promise);
    const { editar, qc } = setup();
    editar("S01"); await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    usuario("u2"); usuario("u1");
    await act(async () => { pendiente.reject(new Error("fallo de A anterior")); });
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(mocks.error).not.toHaveBeenCalled();
    expect(qc.getQueryData(queryKeys.facturas.detail("f1"))).toEqual(factura);
  });

  it("normalizar un espacio no aborta el único debounce pendiente ni duplica el guardado", async () => {
    const { rerender, result } = setup();
    rerender({ id: "f1", org: "org1", state: { ...values, notas: "texto" } });
    rerender({ id: "f1", org: "org1", state: { ...values, notas: "texto " } });
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledOnce());
    expect(mocks.guardar.mock.calls[0][1].notas).toBe("texto");
    await waitFor(() => expect(result.current.estado).toBe("saved"));
  });

});
