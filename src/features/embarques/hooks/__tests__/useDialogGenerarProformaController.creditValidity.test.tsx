import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import type { Tables } from "@/integrations/supabase/types";
import { useDialogGenerarProformaController } from "../useDialogGenerarProformaController";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";

const mocks = vi.hoisted(() => ({ credit: vi.fn(), create: vi.fn(), pdf: vi.fn(), pdfClient: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("@/features/cliente/services", () => ({ fetchDiasCreditoCliente: mocks.credit }));
vi.mock("@/features/proformas/services", () => ({ fetchClienteParaPdf: mocks.pdfClient }));
vi.mock("@/generators/proformaPdf", () => ({ generarPdfProforma: mocks.pdf }));
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("../useProformas", () => ({ useCrearProforma: () => ({ mutateAsync: mocks.create }) }));
vi.mock("../useContenedoresEmbarque", () => ({ useContenedoresEmbarque: () => ({ data: [] }) }));
vi.mock("../useProformaTcRecovery", () => ({ esErrorTcRequerido: () => false,
  useProformaTcRecovery: () => ({ limpiar: vi.fn(), activar: vi.fn(), guardarTc: vi.fn() }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: mocks.warning, notifyError: mocks.error }));

const embarque = { id: "emb-sintetico", cliente_id: "cli-sintetico", cliente_nombre: "Cliente sintético", expediente: "MOCK" } as Tables<"embarques">;
const conceptos = [{ id: "concepto-A", descripcion: "Servicio sintético", cantidad: 1, precio_unitario: 100,
  moneda: "MXN", tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, aplica_iva: true }] as Tables<"conceptos_venta">[];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.credit.mockResolvedValue(30);
  mocks.create.mockResolvedValue({ id: "proforma-sintetica", numero: "MOCK-PF" });
  mocks.pdfClient.mockResolvedValue(null);
  mocks.pdf.mockResolvedValue(undefined);
});

function setup() {
  const close = vi.fn();
  const wrapper = createWrapper();
  const client = (globalThis as unknown as { __TEST_QUERY_CLIENT__: QueryClient }).__TEST_QUERY_CLIENT__;
  const key = queryKeys.clientes.diasCredito(embarque.cliente_id);
  // Un solo observer: la suscripción del controller debe captar error/fetching.
  const hook = renderHook(() => ({
    controller: useDialogGenerarProformaController(true, embarque, conceptos, close),
  }), { wrapper });
  const refetch = () => client.refetchQueries({ queryKey: key, exact: true });
  const credit = () => {
    const state = client.getQueryState<number | null>(key);
    return { data: state?.data, isSuccess: state?.status === "success", isError: state?.status === "error",
      isFetching: state?.fetchStatus === "fetching" };
  };
  return { ...hook, close, refetch, credit };
}

async function assertBlocked(hook: ReturnType<typeof setup>) {
  await act(async () => { await hook.result.current.controller.handleConfirmar(); });
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.pdf).not.toHaveBeenCalled();
  expect(mocks.pdfClient).not.toHaveBeenCalled();
  expect(hook.close).not.toHaveBeenCalled();
  expect(mocks.warning).toHaveBeenCalledOnce();
  expect(mocks.error).not.toHaveBeenCalled();
}

describe("proforma: vigencia de la consulta de crédito", () => {
  it("rechaza una consulta inicial fallida sin inventar días Contado", async () => {
    mocks.credit.mockRejectedValue(new Error("Cliente ausente o eliminado"));
    const hook = setup();
    await waitFor(() => expect(hook.credit().isError).toBe(true));
    expect(hook.credit().data).toBeUndefined();
    await assertBlocked(hook);
  });

  it("bloquea CREATE tras refetch fallido con 30 cacheado; una consulta válida permite crear", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.credit().isSuccess).toBe(true));
    mocks.credit.mockRejectedValueOnce(new Error("Cliente eliminado"));
    await act(async () => { await hook.refetch(); });
    await waitFor(() => expect(hook.credit().isError).toBe(true));
    expect(hook.credit().data).toBe(30);
    expect(hook.result.current.controller.diasCredito).toBe("30");
    await assertBlocked(hook);
    mocks.credit.mockResolvedValue(15);
    await act(async () => { await hook.refetch(); });
    await waitFor(() => expect(hook.result.current.controller.diasCredito).toBe("15"));
    await act(async () => { await hook.result.current.controller.handleConfirmar(); });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ diasCredito: 15 }));
    expect(hook.close).toHaveBeenCalledOnce();
  });

  it("bloquea CREATE mientras refetch conserva datos previos", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.credit().isSuccess).toBe(true));
    let resolve!: (value: number) => void;
    mocks.credit.mockReturnValue(new Promise<number>(done => { resolve = done; }));
    let pending!: ReturnType<typeof hook.refetch>;
    await act(async () => { pending = hook.refetch(); await new Promise(done => setTimeout(done, 0)); });
    await waitFor(() => expect(hook.credit().isFetching).toBe(true));
    expect(hook.credit().data).toBe(30);
    await assertBlocked(hook);
    await act(async () => { resolve(30); await pending; });
  });

  it.each([null, 0, 30])("preserva el flujo vivo con crédito %j", async dias => {
    mocks.credit.mockResolvedValue(dias);
    const hook = setup();
    await waitFor(() => expect(hook.credit().isSuccess).toBe(true));
    await act(async () => { await hook.result.current.controller.handleConfirmar(); });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ diasCredito: dias }));
    expect(mocks.pdf).toHaveBeenCalledOnce();
    expect(hook.close).toHaveBeenCalledOnce();
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it.each(["error", "fetching"])("reintenta sólo el PDF creado aunque crédito pase a %s", async state => {
    const hook = setup();
    await waitFor(() => expect(hook.credit().isSuccess).toBe(true));
    act(() => hook.result.current.controller.setNotas("Nota del documento A"));
    mocks.pdf.mockRejectedValueOnce(new Error("Fallo PDF sintético"));
    await act(async () => { await hook.result.current.controller.handleConfirmar(); });
    expect(hook.result.current.controller.creada?.proforma.id).toBe("proforma-sintetica");
    expect(hook.close).not.toHaveBeenCalled();
    let resolve: ((value: number) => void) | undefined;
    let pending: ReturnType<typeof hook.refetch> | undefined;
    if (state === "error") {
      mocks.credit.mockRejectedValueOnce(new Error("Cliente ahora eliminado"));
      await act(async () => { await hook.refetch(); });
      await waitFor(() => expect(hook.credit().isError).toBe(true));
    } else {
      mocks.credit.mockReturnValue(new Promise<number>(done => { resolve = done; }));
      await act(async () => { pending = hook.refetch(); await new Promise(done => setTimeout(done, 0)); });
      await waitFor(() => expect(hook.credit().isFetching).toBe(true));
    }
    const reads = mocks.credit.mock.calls.length;
    act(() => hook.result.current.controller.setNotas("Nota posterior"));
    await act(async () => { await hook.result.current.controller.handleConfirmar(); });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.credit).toHaveBeenCalledTimes(reads);
    expect(mocks.pdf).toHaveBeenCalledTimes(2);
    expect(mocks.pdf).toHaveBeenLastCalledWith(expect.objectContaining({
      proforma: expect.objectContaining({ id: "proforma-sintetica" }),
      conceptos: [expect.objectContaining({ id: "concepto-A" })], notas: "Nota del documento A",
    }));
    expect(hook.close).toHaveBeenCalledOnce();
    if (resolve) await act(async () => { resolve!(30); await pending; });
  });
});
