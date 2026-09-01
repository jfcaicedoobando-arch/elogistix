import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCotizacionUpdateGuard } from "../useCotizacionUpdateGuard";

const VARS = { id: "cot1", data: { notas: "hola" } };

describe("useCotizacionUpdateGuard", () => {
  it("envía el updated_at inicial en el primer guardado", async () => {
    const mutateAsync = vi.fn(async () => "2026-09-02T10:00:00Z");
    const { result } = renderHook(() =>
      useCotizacionUpdateGuard({ mutateAsync, isPending: false }, "2026-09-01T00:00:00Z"),
    );
    await result.current.mutateAsync(VARS);
    expect(mutateAsync).toHaveBeenCalledWith({
      ...VARS,
      expectedUpdatedAt: "2026-09-01T00:00:00Z",
    });
  });

  it("refresca el sello con el que devuelve el servicio para el siguiente paso", async () => {
    const mutateAsync = vi.fn(async () => "2026-09-02T10:00:00Z");
    const { result } = renderHook(() =>
      useCotizacionUpdateGuard({ mutateAsync, isPending: false }, "2026-09-01T00:00:00Z"),
    );
    await result.current.mutateAsync(VARS);
    await result.current.mutateAsync(VARS);
    expect((mutateAsync.mock.calls as unknown as [{ expectedUpdatedAt: string | null }][])[1]?.[0]).toMatchObject({
      expectedUpdatedAt: "2026-09-02T10:00:00Z",
    });
  });

  it("manda null cuando la cotización es nueva (sin sello inicial)", async () => {
    const mutateAsync = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useCotizacionUpdateGuard({ mutateAsync, isPending: false }, undefined),
    );
    await result.current.mutateAsync(VARS);
    expect((mutateAsync.mock.calls as unknown as [{ expectedUpdatedAt: string | null }][])[0]?.[0]).toMatchObject({ expectedUpdatedAt: null });
  });

  it("siembra el sello con el updated_at de la cotización recién creada", async () => {
    const mutateAsync = vi.fn(async () => undefined);
    const crear = vi.fn(async () => ({ id: "cot1", updated_at: "2026-09-01T20:07:23Z" }));
    const { result } = renderHook(() =>
      useCotizacionUpdateGuard({ mutateAsync, isPending: false }, undefined, {
        mutateAsync: crear,
        isPending: false,
      }),
    );
    // SAFE-CAST: el input real del insert no aporta a esta aserción.
    await result.current.crearCotizacion?.mutateAsync({} as never);
    await result.current.mutateAsync(VARS);
    expect((mutateAsync.mock.calls as unknown as [{ expectedUpdatedAt: string | null }][])[0]?.[0]).toMatchObject({
      expectedUpdatedAt: "2026-09-01T20:07:23Z",
    });
  });

  it("propaga isPending de la mutación subyacente", () => {
    const { result } = renderHook(() =>
      useCotizacionUpdateGuard({ mutateAsync: vi.fn(), isPending: true }, null),
    );
    expect(result.current.isPending).toBe(true);
  });
});
