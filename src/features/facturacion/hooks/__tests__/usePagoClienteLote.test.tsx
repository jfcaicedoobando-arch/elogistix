/**
 * @vitest-environment jsdom
 *
 * Ola 6 · RG5-5: el cobro en lote debe emitir UN SOLO aviso al usuario,
 * incluso cuando además se timbran REPs (antes salían dos toasts a la vez).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const registrarPagoClienteLote = vi.fn();
const timbrarRepsSecuencial = vi.fn();
const notifySuccess = vi.fn();
const notifyWarning = vi.fn();
const notifyError = vi.fn();

vi.mock("@/features/facturacion/services/pagoClienteLote", () => ({
  registrarPagoClienteLote: (...a: unknown[]) => registrarPagoClienteLote(...a),
  traducirErrorCobroLote: (e: Error) => e.message,
}));
vi.mock("@/features/facturacion/services/repLote", () => ({
  timbrarRepsSecuencial: (...a: unknown[]) => timbrarRepsSecuencial(...a),
  resumenRepLote: (r: { ok: string[]; fallos: unknown[] }) =>
    `REP: ${r.ok.length} timbrados, ${r.fallos.length} con error`,
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
  notifyWarning: (...a: unknown[]) => notifyWarning(...a),
  notifyError: (...a: unknown[]) => notifyError(...a),
}));

import { usePagoClienteLote } from "../usePagoClienteLote";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const vars = {
  cliente_id: "cli-1",
  fecha_pago: "2026-08-11",
  monto_total: 1000,
  moneda: "MXN",
  renglones: [
    { factura_id: "f1", monto: 600 },
    { factura_id: "f2", monto: 400 },
  ],
  facturasConRep: ["f1"],
};

function nuevoCliente() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  registrarPagoClienteLote.mockReset();
  timbrarRepsSecuencial.mockReset();
  notifySuccess.mockReset();
  notifyWarning.mockReset();
  notifyError.mockReset();
  registrarPagoClienteLote.mockResolvedValue({
    pagos: [
      { factura_id: "f1", pago_id: "p1" },
      { factura_id: "f2", pago_id: "p2" },
    ],
  });
});

describe("usePagoClienteLote (RG5-5)", () => {
  it("emite un solo aviso de éxito que incluye el resumen de REP", async () => {
    timbrarRepsSecuencial.mockResolvedValue({ ok: ["p1"], fallos: [] });
    const { result } = renderHook(() => usePagoClienteLote(), {
      wrapper: wrapper(nuevoCliente()),
    });

    result.current.mutate(vars as never);

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledTimes(1));
    expect(notifyWarning).not.toHaveBeenCalled();
    expect(notifySuccess.mock.calls[0][1].title).toMatch(/Cobro aplicado a 2 facturas — REP/);
  });

  it("cuando un REP falla emite una sola advertencia (sin toast de éxito)", async () => {
    timbrarRepsSecuencial.mockResolvedValue({
      ok: [],
      fallos: [{ pagoId: "p1", mensaje: "sin certificado" }],
    });
    const { result } = renderHook(() => usePagoClienteLote(), {
      wrapper: wrapper(nuevoCliente()),
    });

    result.current.mutate(vars as never);

    await waitFor(() => expect(notifyWarning).toHaveBeenCalledTimes(1));
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyWarning.mock.calls[0][1].description).toMatch(/sin certificado/);
  });

  it("sin facturas PPD no timbra REP y avisa sólo del cobro", async () => {
    const { result } = renderHook(() => usePagoClienteLote(), {
      wrapper: wrapper(nuevoCliente()),
    });

    result.current.mutate({ ...vars, facturasConRep: [] } as never);

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledTimes(1));
    expect(timbrarRepsSecuencial).not.toHaveBeenCalled();
    expect(notifySuccess.mock.calls[0][1].title).toBe("Cobro aplicado a 2 facturas");
  });
});
