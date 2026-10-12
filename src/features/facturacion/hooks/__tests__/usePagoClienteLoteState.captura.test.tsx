/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";

// Ninguna consulta ni registro real: las salidas de red fallan si se invocan.
const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  obtenerFacturasConRep: vi.fn(),
  network: vi.fn(() => { throw new Error("Red no autorizada en prueba de captura"); }),
  isPending: false,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.network, rpc: mocks.network, functions: { invoke: mocks.network } },
}));
vi.mock("@/features/cxp/services", async () => {
  const { roundMoney } = await import("@/lib/financial/financialUtils");
  return { round2: roundMoney };
});
vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [{ id: "cuenta-mxn", moneda: "MXN" }] }),
}));
vi.mock("@/features/facturacion/hooks/pagoClienteLoteHelpers", () => ({
  useIdsConRep: () => [],
  useTcLote: () => ({ tcDof: null, tcAplicable: null }),
}));
vi.mock("@/features/facturacion/hooks/usePagoClienteLote", () => ({
  usePagoClienteLote: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }),
}));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-10-12" }));
vi.mock("@/features/facturacion/services/pagoClienteLote", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/facturacion/services/pagoClienteLote")>(),
  obtenerFacturasConRep: mocks.obtenerFacturasConRep,
  registrarPagoClienteLote: mocks.network,
}));

import { usePagoClienteLoteState } from "../usePagoClienteLoteState";

const facturas = (): FacturaCobroCandidata[] => [
  { factura_id: "A4", numero: "A4", fecha_vencimiento: "2026-10-01", saldo: 58 },
  { factura_id: "A6", numero: "A6", fecha_vencimiento: "2026-10-02", saldo: 215.50 },
];
const repartoInicial = [{ factura_id: "A4", monto: 58 }, { factura_id: "A6", monto: 215.50 }];
function args() {
  return {
    open: true, clienteId: "cliente-aud2", moneda: "MXN", facturas: facturas(),
    onOpenChange: vi.fn(), onDone: vi.fn(),
  };
}
function captura() {
  const props = args();
  return { ...renderHook((p) => usePagoClienteLoteState(p), { initialProps: props }), props };
}
type Estado = ReturnType<typeof usePagoClienteLoteState>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  mocks.isPending = false;
  mocks.mutateAsync.mockReset().mockResolvedValue(undefined);
  mocks.obtenerFacturasConRep.mockReset().mockResolvedValue([]);
  mocks.network.mockClear();
  vi.stubGlobal("fetch", mocks.network);
});
afterEach(() => {
  expect(mocks.network).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("usePagoClienteLoteState: protección de la captura AUD2", () => {
  it("abre limpio con FIFO de A4/A6 por 273.50 MXN", () => {
    const { result } = captura();
    expect(result.current).toMatchObject({
      fecha: "2026-10-12", total: "273.5", saldoTotal: 273.50, totalRepartido: 273.50,
      referencia: "", notas: "", formaPago: "03", cuentaId: "",
      renglones: repartoInicial, isDirty: false, guardando: false, error: null,
    });
    expect(mocks.obtenerFacturasConRep).not.toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  const editables: Array<[string, (s: Estado) => void, (s: Estado) => void]> = [
    ["fecha", (s) => s.setFecha("2026-10-11"), (s) => s.setFecha("2026-10-12")],
    ["total", (s) => s.recalcular(200), (s) => s.recalcular(273.50)],
    ["forma de pago", (s) => s.setFormaPago("01"), (s) => s.setFormaPago("03")],
    ["referencia", (s) => s.setReferencia("AUD2-REF"), (s) => s.setReferencia("")],
    ["cuenta", (s) => s.setCuentaId("cuenta-mxn"), (s) => s.setCuentaId("")],
    ["notas", (s) => s.setNotas("Captura pendiente AUD2"), (s) => s.setNotas("")],
    ["reparto", (s) => s.setMonto("A6", 200), (s) => s.setMonto("A6", 215.50)],
  ];
  it.each(editables)("detecta %s y vuelve a limpio al restaurarlo", (_, editar, restaurar) => {
    const { result } = captura();
    act(() => editar(result.current));
    expect(result.current.isDirty).toBe(true);
    act(() => restaurar(result.current));
    expect(result.current.isDirty).toBe(false);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("conserva referencia, notas y reparto ante refetch repetido", () => {
    const { result, rerender, props } = captura();
    act(() => {
      result.current.setReferencia("AUD2-REF");
      result.current.setNotas("Seguir capturando");
      result.current.recalcular(200);
    });
    for (let intento = 0; intento < 3; intento++) {
      rerender({ ...props, facturas: facturas().map((f) => ({ ...f })) });
      expect(result.current).toMatchObject({
        referencia: "AUD2-REF", notas: "Seguir capturando", total: "200", isDirty: true,
        renglones: [{ factura_id: "A4", monto: 58 }, { factura_id: "A6", monto: 142 }],
      });
    }
  });

  it("refetch de saldos no convierte una captura intacta en cambios del usuario", () => {
    const { result, rerender, props } = captura();
    rerender({ ...props, facturas: facturas().map((f) => ({ ...f, saldo: f.saldo + 10 })) });
    expect(result.current.total).toBe("273.5");
    expect(result.current.renglones).toEqual(repartoInicial);
    expect(result.current.isDirty).toBe(false);
  });

  it("descartar y reabrir repetidamente limpia todos los campos", () => {
    const { result, rerender, props } = captura();
    for (let apertura = 0; apertura < 3; apertura++) {
      act(() => {
        result.current.setFecha("2026-10-11");
        result.current.recalcular(200);
        result.current.setFormaPago("01");
        result.current.setReferencia("AUD2-REF");
        result.current.setCuentaId("cuenta-mxn");
        result.current.setNotas("Descartar esta captura");
      });
      expect(result.current.isDirty).toBe(true);
      rerender({ ...props, open: false });
      rerender({ ...props, facturas: facturas() });
      expect(result.current).toMatchObject({
        fecha: "2026-10-12", total: "273.5", formaPago: "03", referencia: "",
        cuentaId: "", notas: "", renglones: repartoInicial, isDirty: false, guardando: false,
      });
    }
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("mantiene busy de preflight REP a mutation y evita doble submit en ambas fases", async () => {
    const rep = deferred<string[]>();
    const pago = deferred<void>();
    mocks.obtenerFacturasConRep.mockReturnValueOnce(rep.promise);
    mocks.mutateAsync.mockImplementationOnce(() => {
      mocks.isPending = true;
      return pago.promise.finally(() => { mocks.isPending = false; });
    });
    const { result, props } = captura();
    act(() => { result.current.setReferencia("AUD2-REF"); result.current.setNotas("AUD2-NOTAS"); });
    let envio!: Promise<void>;
    act(() => { envio = result.current.submit(); });
    expect(result.current.guardando).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(mocks.obtenerFacturasConRep).toHaveBeenCalledExactlyOnceWith(["A4", "A6"]);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    await act(async () => { rep.resolve(["A6"]); await rep.promise; });
    expect(result.current.guardando).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      cliente_id: "cliente-aud2", fecha_pago: "2026-10-12", moneda: "MXN", forma_pago: "03",
      referencia: "AUD2-REF", cuenta_bancaria_id: null, tipo_cambio_usd: null,
      notas: "AUD2-NOTAS", importe_recibido: 273.50, renglones: repartoInicial,
      facturasConRep: ["A6"], request_id: expect.any(String),
    });
    expect(props.onOpenChange).not.toHaveBeenCalled();
    await act(async () => { pago.resolve(); await envio; });
    expect(result.current.guardando).toBe(false);
    expect(props.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(props.onDone).toHaveBeenCalledTimes(1);
  });

  it("el pending del mutation externo también mantiene busy e impide iniciar otro preflight", async () => {
    const { result, rerender, props } = captura();
    mocks.isPending = true;
    rerender({ ...props });
    expect(result.current.guardando).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(mocks.obtenerFacturasConRep).not.toHaveBeenCalled();
    mocks.isPending = false;
    rerender({ ...props });
    expect(result.current.guardando).toBe(false);
  });

  it.each(["preflight", "mutation"])("un fallo en %s libera busy y conserva la captura", async (fase) => {
    const fallo = deferred<never>();
    if (fase === "preflight") mocks.obtenerFacturasConRep.mockReturnValueOnce(fallo.promise);
    else mocks.mutateAsync.mockReturnValueOnce(fallo.promise);
    const { result, props } = captura();
    act(() => { result.current.setReferencia("AUD2-REF"); result.current.setNotas("Reintentar"); });
    let envio!: Promise<void>;
    act(() => { envio = result.current.submit(); });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.guardando).toBe(true);
    await act(async () => { fallo.reject(new Error("fallo simulado")); await envio; });
    expect(result.current).toMatchObject({
      guardando: false, isDirty: true, referencia: "AUD2-REF", notas: "Reintentar",
    });
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(props.onDone).not.toHaveBeenCalled();
    await act(async () => { await result.current.submit(); });
    expect(props.onDone).toHaveBeenCalledTimes(1);
  });

  it("el reintento tras fallo y refetch reutiliza request_id; la nueva apertura lo renueva", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error("timeout simulado"));
    const { result, rerender, props } = captura();
    act(() => result.current.setReferencia("AUD2-REINTENTO"));
    await act(async () => { await result.current.submit(); });
    const primerId = mocks.mutateAsync.mock.calls[0][0].request_id;
    rerender({ ...props, facturas: facturas() });
    await act(async () => { await result.current.submit(); });
    expect(mocks.mutateAsync.mock.calls[1][0].request_id).toBe(primerId);
    expect(mocks.mutateAsync.mock.calls[1][0].referencia).toBe("AUD2-REINTENTO");
    rerender({ ...props, open: false });
    rerender({ ...props, facturas: facturas() });
    await act(async () => { await result.current.submit(); });
    expect(mocks.mutateAsync.mock.calls[2][0].request_id).not.toBe(primerId);
    expect(mocks.mutateAsync.mock.calls[2][0].referencia).toBe("");
  });

  it.each(["cierre", "cartera PUE actualizada"])("el early return por %s libera busy sin registro", async (motivo) => {
    const rep = deferred<string[]>();
    mocks.obtenerFacturasConRep.mockReturnValueOnce(rep.promise);
    const { result, rerender, props } = captura();
    act(() => result.current.setNotas("Captura interrumpida"));
    let envio!: Promise<void>;
    act(() => { envio = result.current.submit(); });
    expect(result.current.guardando).toBe(true);
    if (motivo === "cierre") rerender({ ...props, open: false });
    else rerender({ ...props, facturas: facturas().map((f) => ({ ...f, metodo_pago: "PUE", pagado: 1 })) });
    await act(async () => { rep.resolve([]); await envio; });
    expect(result.current.guardando).toBe(false);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(props.onDone).not.toHaveBeenCalled();
    rerender({ ...props, facturas: facturas() });
    await act(async () => { await result.current.submit(); });
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("desmontar durante el preflight interrumpido no inicia registro", async () => {
    const rep = deferred<string[]>();
    mocks.obtenerFacturasConRep.mockReturnValueOnce(rep.promise);
    const { result, unmount, props } = captura();
    let envio!: Promise<void>;
    act(() => { envio = result.current.submit(); });
    unmount();
    await act(async () => { rep.resolve([]); await envio; });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(props.onDone).not.toHaveBeenCalled();
  });
});
