import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { useDialogGenerarProformaController } from "../useDialogGenerarProformaController";

const mocks = vi.hoisted(() => ({ credit: vi.fn(), create: vi.fn(), pdf: vi.fn(), pdfClient: vi.fn(),
  saveTc: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("@/features/cliente/services", () => ({ fetchDiasCreditoCliente: mocks.credit }));
vi.mock("@/features/proformas/services", () => ({ fetchClienteParaPdf: mocks.pdfClient }));
vi.mock("@/generators/proformaPdf", () => ({ generarPdfProforma: mocks.pdf }));
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("../useProformas", () => ({ useCrearProforma: () => ({ mutateAsync: mocks.create }) }));
vi.mock("../useContenedoresEmbarque", () => ({ useContenedoresEmbarque: () => ({ data: [] }) }));
vi.mock("../useProformaTcRecovery", () => ({ esErrorTcRequerido: () => false,
  useProformaTcRecovery: () => ({ limpiar: vi.fn(), activar: vi.fn(), guardarTc: mocks.saveTc }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: mocks.warning, notifyError: mocks.error }));

const embarque = { id: "emb-sintetico", cliente_id: "cli-sintetico", organization_id: "org-A",
  cliente_nombre: "Cliente sintético", expediente: "MOCK" } as Tables<"embarques">;
const conceptos = [{ id: "concepto-A", descripcion: "Servicio sintético", cantidad: 1, precio_unitario: 100,
  moneda: "MXN", tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, aplica_iva: true }] as Tables<"conceptos_venta">[];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  setAuthSnapshot({ userId: "usuario-sintetico", email: null, organizationId: null,
    organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "usuario-sintetico", organizationId: "org-A" });
  mocks.credit.mockResolvedValue(30);
  mocks.create.mockResolvedValue({ id: "proforma-A", numero: "MOCK-PF" });
  mocks.pdfClient.mockResolvedValue(null);
  mocks.pdf.mockResolvedValue(undefined);
  mocks.saveTc.mockResolvedValue(true);
});

async function setup() {
  const close = vi.fn();
  const wrapper = createWrapper();
  const client = (globalThis as unknown as { __TEST_QUERY_CLIENT__: QueryClient }).__TEST_QUERY_CLIENT__;
  const key = queryKeys.clientes.diasCredito(embarque.cliente_id);
  // Sin otro observer: los flags y el plazo deben actualizar el controller real.
  const hook = renderHook(({ open, row }) => useDialogGenerarProformaController(open, row, conceptos, close),
    { wrapper, initialProps: { open: true, row: embarque } });
  await waitFor(() => expect(hook.result.current.diasCredito).toBe("30"));
  const refetch = () => client.refetchQueries({ queryKey: key, exact: true });
  const credit = () => client.getQueryState<number | null>(key);
  return { ...hook, close, refetch, credit };
}

async function startSave(hook: Awaited<ReturnType<typeof setup>>) {
  const save = deferred<boolean>();
  mocks.saveTc.mockReturnValueOnce(save.promise);
  let continuation!: Promise<void>;
  await act(async () => { continuation = hook.result.current.handleGuardarTcYReintentar(18.25); await Promise.resolve(); });
  expect(mocks.saveTc).toHaveBeenCalledOnce();
  expect(mocks.create).not.toHaveBeenCalled();
  return { save, continuation };
}

async function changeCredit(hook: Awaited<ReturnType<typeof setup>>, state: string) {
  const pending = deferred<number>();
  if (state === "error") {
    mocks.credit.mockRejectedValueOnce(new Error("Cliente ahora eliminado"));
    await act(async () => { await hook.refetch(); });
    await waitFor(() => expect(hook.credit()?.status).toBe("error"));
  } else {
    mocks.credit.mockReturnValueOnce(pending.promise);
    let fetch!: ReturnType<typeof hook.refetch>;
    await act(async () => { fetch = hook.refetch(); await new Promise(done => setTimeout(done, 0)); });
    await waitFor(() => expect(hook.credit()?.fetchStatus).toBe("fetching"));
    return async () => { await act(async () => { pending.resolve(30); await fetch; }); };
  }
  return async () => {};
}

async function finish(save: Awaited<ReturnType<typeof startSave>>, ok = true) {
  await act(async () => { save.save.resolve(ok); await save.continuation; });
}

describe("guardar TC: estado vigente después del await", () => {
  it.each(["error", "fetching"])("bloquea CREATE si el crédito cambia a %s con 30 cacheado durante la espera", async state => {
    const hook = await setup();
    const save = await startSave(hook);
    const cleanup = await changeCredit(hook, state);
    expect(hook.credit()?.data).toBe(30);
    await finish(save);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.pdfClient).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(hook.close).not.toHaveBeenCalled();
    expect(mocks.warning).toHaveBeenCalledOnce();
    await cleanup();
  });

  it("crea con el plazo actual 15 y las notas actuales, nunca con los 30 capturados", async () => {
    const hook = await setup();
    const save = await startSave(hook);
    mocks.credit.mockResolvedValueOnce(15);
    await act(async () => { await hook.refetch(); });
    await waitFor(() => expect(hook.result.current.diasCredito).toBe("15"));
    act(() => hook.result.current.setNotas("Nota actual"));
    await finish(save);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ diasCredito: 15, notas: "Nota actual" }));
    expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ embarque: expect.objectContaining({ tipo_cambio_usd: 18.25 }) }));
    expect(hook.close).toHaveBeenCalledOnce();
  });

  it("conserva el reintento legítimo si TC y crédito siguen válidos", async () => {
    const hook = await setup();
    const save = await startSave(hook);
    await finish(save);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ diasCredito: 30 }));
    expect(mocks.pdf).toHaveBeenCalledOnce();
    expect(hook.close).toHaveBeenCalledOnce();
  });

  it.each(["error", "fetching"])("la proforma creada reintenta sólo su PDF aunque crédito cambie a %s durante TC", async state => {
    const hook = await setup();
    act(() => hook.result.current.setNotas("Nota del documento A"));
    mocks.pdf.mockRejectedValueOnce(new Error("Fallo PDF sintético"));
    await act(async () => { await hook.result.current.handleConfirmar(); });
    expect(hook.result.current.creada?.proforma.id).toBe("proforma-A");
    const save = deferred<boolean>();
    mocks.saveTc.mockReturnValueOnce(save.promise);
    let continuation!: Promise<void>;
    await act(async () => { continuation = hook.result.current.handleGuardarTcYReintentar(18.25); await Promise.resolve(); });
    const cleanup = await changeCredit(hook, state);
    const reads = mocks.credit.mock.calls.length;
    act(() => hook.result.current.setNotas("Nota posterior"));
    await finish({ save, continuation });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.credit).toHaveBeenCalledTimes(reads);
    expect(mocks.pdf).toHaveBeenCalledTimes(2);
    expect(mocks.pdf).toHaveBeenLastCalledWith(expect.objectContaining({ proforma: expect.objectContaining({ id: "proforma-A" }),
      notas: "Nota del documento A", conceptos: [expect.objectContaining({ id: "concepto-A" })] }));
    expect(hook.close).toHaveBeenCalledOnce();
    await cleanup();
  });

  it.each(["cliente_id", "organization_id", "id"] as const)("cancela si cambia %s del embarque durante TC", async field => {
    const hook = await setup();
    const save = await startSave(hook);
    hook.rerender({ open: true, row: { ...embarque, [field]: "contexto-B" } });
    await finish(save);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(hook.close).not.toHaveBeenCalled();
  });

  it.each([false, true])("cancela al cambiar organización activa, incluso al volver a A: %s", async returnToA => {
    const hook = await setup();
    const save = await startSave(hook);
    // Cambio en memoria sin rerender: el ámbito canónico revoca la continuación.
    syncActiveOrganizationScope({ userId: "usuario-sintetico", organizationId: "org-B" });
    if (returnToA) syncActiveOrganizationScope({ userId: "usuario-sintetico", organizationId: "org-A" });
    await finish(save);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it.each(["unmount", "reopen"])("cancela la confirmación anterior tras %s", async transition => {
    const hook = await setup();
    const save = await startSave(hook);
    if (transition === "unmount") hook.unmount();
    else {
      hook.rerender({ open: false, row: embarque });
      hook.rerender({ open: true, row: embarque });
    }
    await finish(save);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("no confirma si guardar TC devuelve false", async () => {
    const hook = await setup();
    const save = await startSave(hook);
    await finish(save, false);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
