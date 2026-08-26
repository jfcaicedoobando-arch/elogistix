import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vincularCotizacionConReintentos } from "@/features/embarques/hooks/useEmbarqueSubmitOrchestrator.helpers";

describe("vincularCotizacionConReintentos (B-05)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve null si el primer intento tiene éxito", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await expect(vincularCotizacionConReintentos(fn)).resolves.toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reintenta con backoff y devuelve null si el segundo intento funciona", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("red")).mockResolvedValue(undefined);
    const p = vincularCotizacionConReintentos(fn);
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBeNull();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("devuelve el último error tras agotar los reintentos", async () => {
    const err = new Error("falló siempre");
    const fn = vi.fn().mockRejectedValue(err);
    const p = vincularCotizacionConReintentos(fn);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
