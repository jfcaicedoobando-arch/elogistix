/**
 * Hallazgo P1 (captura de factura de proveedor desde el buzón):
 * si "marcar como capturado" falla DESPUÉS de crear la factura, el id creado
 * debe conservarse, el diálogo no debe cerrarse y el reintento debe reutilizar
 * la factura existente (UPDATE idempotente, sin volver a insertar).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const capturarMutateAsync = vi.fn();
vi.mock("@/features/cxp/hooks/useFacturasEntrantes", () => ({
  useCapturarFacturaEntrante: () => ({ mutateAsync: capturarMutateAsync }),
}));
vi.mock("@/features/cxp/services/copiarArchivosEntrante", () => ({
  copiarArchivosEntranteAFactura: vi.fn(async () => undefined),
}));
vi.mock("@/hooks/shared/useOrgActiva", () => ({
  useOrgActiva: () => ({ organizationId: "org-1" }),
}));
const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: vi.fn(),
}));

import { useCapturaEntranteWiring } from "@/features/cxp/hooks/useCapturaEntranteWiring";
import type { EntranteParaCaptura } from "@/features/cxp/types";

const ENTRANTE = {
  id: "doc-1",
  embarqueId: "emb-1",
  expediente: "ELIMP00302",
  archivoPath: null,
  nombreArchivo: null,
  xmlPath: null,
  xmlNombre: null,
  montoDeclarado: null,
  monedaDeclarada: null,
} as unknown as EntranteParaCaptura;

beforeEach(() => {
  capturarMutateAsync.mockReset();
  notifyError.mockReset();
});

describe("useCapturaEntranteWiring — fallo al marcar como capturado", () => {
  it("conserva el id, no cierra el diálogo y avisa con reintento", async () => {
    capturarMutateAsync.mockRejectedValueOnce(new Error("red caída"));
    const onCerrar = vi.fn();
    const { result } = renderHook(() =>
      useCapturaEntranteWiring({ entrante: ENTRANTE, onCerrar, onCapturada: vi.fn() }),
    );

    let cerrado: boolean | undefined;
    await act(async () => {
      cerrado = await result.current.onDone("fac-1");
    });

    expect(cerrado).toBe(false);
    expect(onCerrar).not.toHaveBeenCalled();
    expect(result.current.facturaIdPendiente).toBe("fac-1");
    expect(notifyError).toHaveBeenCalled();
  });

  it("el reintento reutiliza la misma factura y cierra al tener éxito", async () => {
    capturarMutateAsync
      .mockRejectedValueOnce(new Error("red caída"))
      .mockResolvedValueOnce(undefined);
    const onCerrar = vi.fn();
    const { result } = renderHook(() =>
      useCapturaEntranteWiring({ entrante: ENTRANTE, onCerrar }),
    );

    await act(async () => {
      await result.current.onDone("fac-1");
    });
    await act(async () => {
      result.current.reintentar();
    });

    expect(capturarMutateAsync).toHaveBeenCalledTimes(2);
    expect(capturarMutateAsync.mock.calls.every(([arg]) =>
      (arg as { facturaId: string }).facturaId === "fac-1")).toBe(true);
    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(result.current.facturaIdPendiente).toBeNull();
  });
});
