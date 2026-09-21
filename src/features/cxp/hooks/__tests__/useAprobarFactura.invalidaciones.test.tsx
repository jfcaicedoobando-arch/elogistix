/**
 * Paso 10 de la auditoría: al RECHAZAR una factura de proveedor, las
 * invalidaciones deben usar los prefijos vivos del árbol real
 * (`conceptos_costo` de embarques y `cxp/facturas-entrantes`), no los strings
 * muertos que antes se escribían a mano.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";

const aprobarSvc = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
vi.mock("@/features/cxp/services/aprobacionFactura", () => ({
  aprobarFacturaProveedor: (...a: unknown[]) => aprobarSvc(...a),
  AprobacionFacturaError: class extends Error {},
}));
vi.mock("@/features/profit/hooks/invalidateProfitDependencies", () => ({
  invalidateProfitDependencies: vi.fn(),
}));

import { useAprobarFactura } from "../useAprobarFactura";

function keysInvalidadas(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((c) =>
    JSON.stringify((c[0] as { queryKey: unknown }).queryKey),
  );
}

describe("useAprobarFactura · invalidaciones al rechazar", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    spy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
  });

  it("usa los prefijos vivos y ningún string muerto", async () => {
    aprobarSvc.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAprobarFactura(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "f-1", aprobar: false, motivo: "no aplica" });
    });

    const keys = keysInvalidadas(spy);
    expect(keys).toContain(JSON.stringify(queryKeys.embarques.conceptosCosto()));
    expect(keys).toContain(JSON.stringify(queryKeys.cxp.facturasEntrantes));
    // Strings muertos que ya no deben aparecer.
    expect(keys).not.toContain(JSON.stringify(["embarque_facturas_entrantes"]));
    expect(keys).not.toContain(JSON.stringify(queryKeys.conceptosCosto.all));
  });

  it("al aprobar no toca los prefijos de rechazo", async () => {
    aprobarSvc.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAprobarFactura(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "f-2", aprobar: true });
    });

    const keys = keysInvalidadas(spy);
    expect(keys).not.toContain(JSON.stringify(queryKeys.embarques.conceptosCosto()));
    expect(keys).not.toContain(JSON.stringify(queryKeys.cxp.facturasEntrantes));
  });
});
