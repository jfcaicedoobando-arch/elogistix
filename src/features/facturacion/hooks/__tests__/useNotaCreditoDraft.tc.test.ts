/**
 * FIX-11 (auditoría): la NC nunca debe emitirse con TC=1 silencioso.
 * Cubre la rama defensiva de `useNotaCreditoDraft.handleSubmit`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mocks = vi.hoisted(() => ({
  crearNotaCredito: vi.fn(),
  timbrarMutate: vi.fn(),
  notifyError: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/features/facturacion/services/notasCredito", () => ({
  crearNotaCredito: mocks.crearNotaCredito,
}));
vi.mock("@/features/facturacion/hooks/useNotaCreditoFacturapi", () => ({
  useTimbrarNotaCredito: () => ({ mutateAsync: mocks.timbrarMutate }),
}));
vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: mocks.notifyError,
}));

import { useNotaCreditoDraft } from "../useNotaCreditoDraft";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const baseParams = {
  open: true,
  onOpenChange: vi.fn(),
  facturaId: "fact-1",
  saldoFactura: 10000,
  uuidFacturaOriginal: "UUID-1",
};

beforeEach(() => {
  mocks.crearNotaCredito.mockReset().mockResolvedValue({ id: "nc-1" });
  mocks.timbrarMutate.mockReset();
  mocks.notifyError.mockReset();
  mocks.toast.mockReset();
});

describe("useNotaCreditoDraft · FIX-11 TC guard", () => {
  it("bloquea la emisión de NC en USD si el tipo de cambio es 0", async () => {
    const { result } = renderHook(
      () => useNotaCreditoDraft({ ...baseParams, monedaFactura: "USD", tipoCambioFactura: 0 }),
      { wrapper },
    );
    act(() => {
      result.current.setDescripcion("desc");
      result.current.setConceptos([{
        descripcion: "x", cantidad: 1, precio_unitario: 100,
        clave_sat: "84111506", clave_unidad: "E48", unidad: "u", tasa_iva: 0.16,
      }]);
    });

    await act(async () => { await result.current.handleSubmit(false); });
    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());

    expect(mocks.crearNotaCredito).not.toHaveBeenCalled();
    const call = mocks.notifyError.mock.calls[0][1];
    // YG-05: el usuario ve el mensaje en español del catálogo, nunca el código
    // interno `LC_*` (que sigue registrado en el logger para diagnóstico).
    const descripcion = String(call.description ?? "");
    expect(descripcion).toContain("tipo de cambio de la factura no está disponible");
    expect(descripcion).not.toContain("LC_TC_NO_DISPONIBLE");

  });

  it("MXN no requiere TC (usa 1 implícito) y sí llama a crearNotaCredito", async () => {
    const { result } = renderHook(
      () => useNotaCreditoDraft({ ...baseParams, monedaFactura: "MXN", tipoCambioFactura: 0 }),
      { wrapper },
    );
    act(() => {
      result.current.setDescripcion("desc");
      result.current.setConceptos([{
        descripcion: "x", cantidad: 1, precio_unitario: 100,
        clave_sat: "84111506", clave_unidad: "E48", unidad: "u", tasa_iva: 0.16,
      }]);
    });

    await act(async () => { await result.current.handleSubmit(false); });
    await waitFor(() => expect(mocks.crearNotaCredito).toHaveBeenCalledTimes(1));

    const payload = mocks.crearNotaCredito.mock.calls[0][0];
    expect(payload.tipo_cambio).toBe(1);
    expect(payload.moneda).toBe("MXN");
  });
});
