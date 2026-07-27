/**
 * Tests para `useEditarFacturaProveedorForm`: precarga desde la fila,
 * detección de cambios, recálculo de vencimiento, validación y submit
 * que delega en `useActualizarFacturaProveedor`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mutateAsync = vi.fn();
const fetchFacturaParaEdicion = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
}));
vi.mock("@/features/cxp/services", () => ({
  fetchFacturaParaEdicion: (...a: unknown[]) => fetchFacturaParaEdicion(...a),
}));
vi.mock("@/features/cxp/hooks", () => ({
  useActualizarFacturaProveedor: () => ({ mutateAsync, isPending: false }),
}));

import { useEditarFacturaProveedorForm } from "../useEditarFacturaProveedorForm";

const row = {
  id: "f-1",
  proveedor_id: "p-1",
  proveedor_nombre: "ACME",
  folio_proveedor: "F-001",
  fecha_emision: "2026-01-01",
  fecha_vencimiento: "2026-01-31",
  dias_credito: 30,
  moneda: "MXN" as const,
  tipo_cambio_usd: 0,
  subtotal: 1000,
  iva: 160,
  retenciones: 0,
  total: 1160,
  categoria_presupuesto_id: "cat-1",
  notas: "n",
  estado_aprobacion: "pendiente" as const,
};

const factura = { id: "f-1" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  fetchFacturaParaEdicion.mockResolvedValue(row);
  mutateAsync.mockResolvedValue(undefined);
});

describe("useEditarFacturaProveedorForm", () => {
  it("precarga values desde la fila y total = subtotal + iva - retenciones", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useEditarFacturaProveedorForm({ factura, onDone }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.values).not.toBeNull());
    expect(result.current.values!.folio).toBe("F-001");
    expect(result.current.total).toBe(1160);
    expect(result.current.hayCambios).toBe(false);
  });

  it("handleProveedor es no-op (proveedor read-only)", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useEditarFacturaProveedorForm({ factura, onDone }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.values).not.toBeNull());
    act(() => (result.current.handleProveedor as () => void)());
    expect(result.current.values!.provId).toBe("p-1");
  });

  it("cambiar diasCredito recalcula vencimiento y marca hayCambios", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useEditarFacturaProveedorForm({ factura, onDone }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.values).not.toBeNull());
    act(() => result.current.handleChange("diasCredito", 15));
    expect(result.current.values!.vencimiento).toBe("2026-01-16");
    expect(result.current.hayCambios).toBe(true);
  });

  it("submit con folio vacío no llama mutateAsync y notifica", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useEditarFacturaProveedorForm({ factura, onDone }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.values).not.toBeNull());
    act(() => result.current.handleChange("folio", "  "));
    await act(async () => { await result.current.submit(); });
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: expect.stringMatching(/campos/i),
    }));
    expect(result.current.errors.folio).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("submit happy path manda payload normalizado y llama onDone", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useEditarFacturaProveedorForm({ factura, onDone }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.values).not.toBeNull());
    act(() => {
      result.current.handleChange("notas", "actualizada");
      result.current.handleChange("subtotal", "2000");
    });
    await act(async () => { await result.current.submit(); });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const arg = mutateAsync.mock.calls[0][0] as { id: string; payload: Record<string, unknown> };
    expect(arg.id).toBe("f-1");
    expect(arg.payload).toMatchObject({
      folio_proveedor: "F-001",
      subtotal: 2000,
      iva: 160,
      categoria_presupuesto_id: "cat-1",
      notas: "actualizada",
      moneda: "MXN",
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("si el mutateAsync rechaza, no propaga ni llama onDone", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("boom"));
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useEditarFacturaProveedorForm({ factura, onDone }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.values).not.toBeNull());
    await act(async () => { await result.current.submit(); });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("sin factura, values queda null y submit no hace nada", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(
      () => useEditarFacturaProveedorForm({ factura: null, onDone }),
      { wrapper: createWrapper() },
    );
    expect(result.current.values).toBeNull();
    await act(async () => { await result.current.submit(); });
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
