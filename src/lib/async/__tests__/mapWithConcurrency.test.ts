/**
 * Tests del helper de concurrencia limitada (M12).
 */
import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "../mapWithConcurrency";

function deferredDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency", () => {
  it("nunca supera la concurrencia máxima", async () => {
    let activas = 0;
    let pico = 0;
    const items = Array.from({ length: 11 }, (_, i) => i);

    await mapWithConcurrency(items, 4, async (n) => {
      activas++;
      pico = Math.max(pico, activas);
      await deferredDelay(n % 3);
      activas--;
      return n;
    });

    expect(pico).toBeLessThanOrEqual(4);
  });

  it("reporta progreso monótono hasta el total", async () => {
    const progreso: number[] = [];
    const items = ["a", "b", "c", "d", "e"];

    await mapWithConcurrency(items, 2, async (s) => s, (hechas, total) => {
      expect(total).toBe(items.length);
      progreso.push(hechas);
    });

    expect(progreso).toEqual([2, 4, 5]);
  });

  it("aísla errores sin abortar la tanda ni el resto", async () => {
    const items = [1, 2, 3, 4];

    const res = await mapWithConcurrency(items, 2, async (n) => {
      if (n % 2 === 0) throw new Error(`falla ${n}`);
      return n * 10;
    });

    expect(res.ok.map((r) => r.value)).toEqual([10, 30]);
    expect(res.errores.map((e) => e.item)).toEqual([2, 4]);
    expect((res.errores[0].error as Error).message).toBe("falla 2");
  });

  it("devuelve resultados vacíos con lista vacía y no llama progreso", async () => {
    let llamadas = 0;
    const res = await mapWithConcurrency([], 4, async (x) => x, () => { llamadas++; });
    expect(res.ok).toEqual([]);
    expect(res.errores).toEqual([]);
    expect(llamadas).toBe(0);
  });
});
