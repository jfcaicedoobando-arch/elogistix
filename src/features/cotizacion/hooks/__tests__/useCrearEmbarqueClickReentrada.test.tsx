/**
 * B17 (v13.823.379) — Concurrencia: dos clics rápidos en "Crear embarque" no
 * deben lanzar dos revalidaciones/creaciones. El guard se toma ANTES del await
 * del candado de costos; si el candado bloquea, se libera para reintentar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mutateAsync = vi.fn();
const revalidarTarifa = vi.fn();
const verificarCostosOAvisar = vi.fn();
const navigate = vi.fn();

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/features/cotizacion/services/revalidacion", () => ({
  revalidarTarifa: (...a: unknown[]) => revalidarTarifa(...a),
}));
vi.mock("@/features/cotizacion/services/candadoCostosAviso", () => ({
  verificarCostosOAvisar: (...a: unknown[]) => verificarCostosOAvisar(...a),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
vi.mock("@/features/cotizacion/hooks/useRevalidacionTarifa", () => ({
  useCrearEmbarqueBorradorConDecision: () => ({ mutateAsync, isPending: false }),
  useSolicitarReaprobacion: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { useCrearEmbarqueConRevalidacion } from "@/features/cotizacion/hooks/useCrearEmbarqueConRevalidacion";

describe("useCrearEmbarqueConRevalidacion — doble clic en Crear embarque", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    revalidarTarifa.mockReset();
    verificarCostosOAvisar.mockReset();
  });

  it("con el candado de costos diferido, sólo se revalida y crea una vez", async () => {
    let liberar: (v: boolean) => void = () => {};
    verificarCostosOAvisar.mockImplementation(
      () => new Promise<boolean>((res) => { liberar = res; }),
    );
    revalidarTarifa.mockResolvedValue({ severidad: "sin_cambios", cambios: [], tarifa_id_vigente: "t-1" });
    mutateAsync.mockResolvedValue("emb-1");

    const { result } = renderHook(() => useCrearEmbarqueConRevalidacion("cot-1"));

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.handleClick();
      p2 = result.current.handleClick();
    });
    expect(verificarCostosOAvisar).toHaveBeenCalledTimes(1);

    await act(async () => {
      liberar(true);
      await Promise.all([p1, p2]);
    });

    expect(revalidarTarifa).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("si el candado de costos bloquea, el guard se libera y se puede reintentar", async () => {
    verificarCostosOAvisar.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useCrearEmbarqueConRevalidacion("cot-2"));

    await act(async () => { await result.current.handleClick(); });
    expect(revalidarTarifa).not.toHaveBeenCalled();

    verificarCostosOAvisar.mockResolvedValueOnce(true);
    revalidarTarifa.mockResolvedValue({ severidad: "sin_cambios", cambios: [], tarifa_id_vigente: null });
    mutateAsync.mockResolvedValue("emb-2");
    await act(async () => { await result.current.handleClick(); });

    expect(revalidarTarifa).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
});
