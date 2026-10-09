/**
 * @vitest-environment jsdom
 *
 * Branches: timbrar y cancelar nota de crédito (onSuccess/onError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import React from "react";

const timbrarNotaCreditoFacturapi = vi.fn();
const cancelarNotaCreditoFacturapi = vi.fn();
const toastSuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));
vi.mock("@/features/facturacion/services/notasCreditoFacturapi", () => ({
  timbrarNotaCreditoFacturapi: (...a: unknown[]) => timbrarNotaCreditoFacturapi(...a),
  cancelarNotaCreditoFacturapi: (...a: unknown[]) => cancelarNotaCreditoFacturapi(...a),
}));
const notifyInfo = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: (_t: unknown, opts: { title: string }) => toastSuccess(opts?.title),
  notifyInfo: (...a: unknown[]) => notifyInfo(...a),
}));

import {
  useTimbrarNotaCredito,
  useCancelarNotaCredito,
} from "../useNotaCreditoFacturapi";
import { queryKeys } from "@/lib/query";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  timbrarNotaCreditoFacturapi.mockReset();
  cancelarNotaCreditoFacturapi.mockReset();
  toastSuccess.mockReset();
  notifyError.mockReset();
  notifyInfo.mockReset();
});

describe("useTimbrarNotaCredito", () => {
  it("onSuccess: muestra UUID truncado e invalida cache de notas de crédito", async () => {
    timbrarNotaCreditoFacturapi.mockResolvedValue({ uuid: "NCAAAAAA-rest" });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTimbrarNotaCredito("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate("nc-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(timbrarNotaCreditoFacturapi).toHaveBeenCalledWith("nc-1");
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("NCAAAAAA"));
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCredito("fac-1") });
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCreditoRecientes() });
    qc.clear();
  });

  it("timbrar NC onError: notifyError con mensaje", async () => {
    timbrarNotaCreditoFacturapi.mockRejectedValue(new Error("nc fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useTimbrarNotaCredito("fac-1"), { wrapper: wrapper(qc) });

    result.current.mutate("nc-2");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("nc fail");
    qc.clear();
  });
});

describe("useCancelarNotaCredito", () => {
  it("onSuccess: toast 'cancelada' e invalida caches", async () => {
    cancelarNotaCreditoFacturapi.mockResolvedValue({ ok: true });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarNotaCredito("fac-2"), { wrapper: wrapper(qc) });

    result.current.mutate({ notaCreditoId: "nc-9", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cancelarNotaCreditoFacturapi).toHaveBeenCalledWith("nc-9", "02", undefined);
    expect(toastSuccess).toHaveBeenCalledWith("Nota de crédito cancelada");
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCredito("fac-2") });
    qc.clear();
  });

  it("cancelar NC onError: notifyError", async () => {
    cancelarNotaCreditoFacturapi.mockRejectedValue(new Error("cancel fail"));
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useCancelarNotaCredito("fac-2"), { wrapper: wrapper(qc) });

    result.current.mutate({ notaCreditoId: "nc-10", motivo: "01", sustituyeUuid: "u-old" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(notifyError.mock.calls[0]![1].description).toContain("cancel fail");
    qc.clear();
  });

  it("uncertain: aviso informativo, invalida cache y no ofrece reintentar", async () => {
    cancelarNotaCreditoFacturapi.mockResolvedValue({
      ok: true,
      uncertain: true,
      pending: true,
      message: "FacturApi tardó en responder.",
    });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCancelarNotaCredito("fac-2"), { wrapper: wrapper(qc) });

    result.current.mutate({ notaCreditoId: "nc-11", motivo: "02" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: "Cancelación de la NC enviada · verificando",
      description: "FacturApi tardó en responder.",
    }));
    expect(notifyInfo.mock.calls[0]![1].description).not.toMatch(/reintent/i);
    expect(spy).toHaveBeenCalledWith({ queryKey: facturasKeys.notasCredito("fac-2") });
    qc.clear();
  });
});

describe("AUD141: notas de crédito refrescan contadores y cartera", () => {
  it.each(["timbrada", "cancelada", "pendiente", "incierta"] as const)(
    "%s invalida las consultas reales de conteos, listado y KPIs",
    async (estado) => {
      timbrarNotaCreditoFacturapi.mockResolvedValue({ uuid: "NC-AUD141" });
      cancelarNotaCreditoFacturapi.mockResolvedValue({
        ok: true,
        pending: estado === "pendiente" || estado === "incierta",
        uncertain: estado === "incierta",
      });
      const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
      const keys = [
        queryKeys.facturacion.bandejaConteos("org-audit141"),
        queryKeys.facturas.cobranza({ moneda: "EUR" }),
        queryKeys.facturas.cobranza({ kpis: true, moneda: "EUR" }),
      ];
      for (const key of keys) qc.setQueryData(key, { previo: true });
      qc.setQueryData(["aud141-unrelated"], { previo: true });
      const { result } = renderHook(() => ({
        timbrar: useTimbrarNotaCredito("fac-audit141"),
        cancelar: useCancelarNotaCredito("fac-audit141"),
      }), { wrapper: wrapper(qc) });

      if (estado === "timbrada") result.current.timbrar.mutate("nc-audit141");
      else result.current.cancelar.mutate({ notaCreditoId: "nc-audit141", motivo: "02" });
      await waitFor(() => expect(
        estado === "timbrada" ? result.current.timbrar.isSuccess : result.current.cancelar.isSuccess,
      ).toBe(true));

      for (const key of keys) {
        expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
        // Una cancelación pendiente o incierta no presupone otro saldo.
        expect(qc.getQueryData(key)).toEqual({ previo: true });
      }
      expect(qc.getQueryState(["aud141-unrelated"])?.isInvalidated).toBe(false);
      qc.clear();
    },
  );
});

describe("audit132 NC refresca P&L y espera consultas activas", () => {
  it.each(["timbrada", "cancelada", "pendiente", "incierta", "error"])("%s refresca ambos embarques y conserva resultado fiscal", async (estado) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const keys = [queryKeys.embarques.pnlFinanciero("e1"), queryKeys.embarques.pnlFinanciero("e2")];
    const readers = keys.map((key) => {
      qc.setQueryData(key, { utilidad_mxn: 100 });
      const read = vi.fn(async () => { await gate; return { utilidad_mxn: null, estado_ingresos: "incompleto" }; });
      const observer = new QueryObserver(qc, { queryKey: key, queryFn: read, staleTime: Infinity });
      return { read, unsubscribe: observer.subscribe(() => {}) };
    });
    const fiscalError = new Error("fallo posterior a persistencia");
    timbrarNotaCreditoFacturapi.mockResolvedValue({ uuid: "NC-132" });
    if (estado === "error") cancelarNotaCreditoFacturapi.mockRejectedValue(fiscalError);
    else cancelarNotaCreditoFacturapi.mockResolvedValue({ ok: true,
      pending: estado === "pendiente", uncertain: estado === "incierta" });
    const { result } = renderHook(() => ({
      timbrar: useTimbrarNotaCredito("factura-multi"), cancelar: useCancelarNotaCredito("factura-multi"),
    }), { wrapper: wrapper(qc) });
    if (estado === "timbrada") result.current.timbrar.mutate("nc-132");
    else result.current.cancelar.mutate({ notaCreditoId: "nc-132", motivo: "02" });
    const mutation = () => estado === "timbrada" ? result.current.timbrar : result.current.cancelar;
    await waitFor(() => readers.forEach(({ read }) => expect(read).toHaveBeenCalledTimes(1)));
    expect(mutation().isPending).toBe(true);
    finish();
    await waitFor(() => expect(mutation().isPending).toBe(false));
    expect(mutation().isError).toBe(estado === "error");
    if (estado === "error") expect(mutation().error).toBe(fiscalError);
    for (const key of keys) expect(qc.getQueryData(key)).toEqual({ utilidad_mxn: null, estado_ingresos: "incompleto" });
    for (const { unsubscribe } of readers) unsubscribe();
    expect(estado === "timbrada" ? timbrarNotaCreditoFacturapi : cancelarNotaCreditoFacturapi).toHaveBeenCalledTimes(1);
    qc.clear();
  });
});


it("audit132 el fallo de refetch no reemplaza ni oculta el error fiscal original", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const key = queryKeys.embarques.pnlFinanciero("e-error");
  qc.setQueryData(key, { utilidad_mxn: 100 });
  const fetchError = new Error("lectura temporalmente no disponible");
  const observer = new QueryObserver(qc, { queryKey: key,
    queryFn: vi.fn().mockRejectedValue(fetchError), staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  const fiscalError = new Error("no se pudo confirmar la cancelación");
  cancelarNotaCreditoFacturapi.mockRejectedValue(fiscalError);
  const { result } = renderHook(() => useCancelarNotaCredito("factura-error"), { wrapper: wrapper(qc) });
  result.current.mutate({ notaCreditoId: "nc-error", motivo: "02" });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBe(fiscalError);
  expect(qc.getQueryState(key)?.error).toBe(fetchError);
  expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({ error: fiscalError }));
  unsubscribe();
  qc.clear();
});
