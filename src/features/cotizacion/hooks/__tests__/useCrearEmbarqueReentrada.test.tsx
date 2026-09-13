/**
 * v13.823.347 — Regresión de concurrencia: dos clics rápidos en las decisiones
 * del modal de revalidación (Mantener / Refrescar / Sustituir / Re-aprobada) o
 * en "Solicitar re-aprobación" no deben lanzar dos operaciones concurrentes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mutateAsync = vi.fn();
const mutate = vi.fn();

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/cotizacion/services/revalidacion", () => ({
  revalidarTarifa: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
vi.mock("@/features/cotizacion/hooks/useRevalidacionTarifa", () => ({
  useCrearEmbarqueBorradorConDecision: () => ({ mutateAsync, isPending: false }),
  useSolicitarReaprobacion: () => ({ mutate, isPending: false }),
}));

import { useCrearEmbarqueConRevalidacion } from "@/features/cotizacion/hooks/useCrearEmbarqueConRevalidacion";

describe("useCrearEmbarqueConRevalidacion — guard de reentrada", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutate.mockReset();
  });

  it("una segunda decisión durante el vuelo no crea otro embarque", async () => {
    let resolver: (v: string) => void = () => {};
    mutateAsync.mockImplementation(
      () => new Promise<string>((res) => { resolver = res; }),
    );
    const { result } = renderHook(() => useCrearEmbarqueConRevalidacion("cot-1"));

    const p1 = result.current.handleMantener();
    const p2 = result.current.handleRefrescar();
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    resolver("emb-1");
    await Promise.all([p1, p2]);

    // Liberado el guard, una nueva decisión sí procede.
    mutateAsync.mockResolvedValueOnce("emb-2");
    await result.current.handleMantener();
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });

  it("el doble clic en 'Solicitar re-aprobación' sólo envía una solicitud", () => {
    mutate.mockImplementation(() => {});
    const { result } = renderHook(() => useCrearEmbarqueConRevalidacion("cot-1"));

    result.current.handleSolicitarReaprobacion();
    result.current.handleSolicitarReaprobacion();

    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
