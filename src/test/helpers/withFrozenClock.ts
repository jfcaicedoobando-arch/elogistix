/**
 * 13.117.0 (Sprint Robustez) — Helper compartido para congelar el reloj en tests.
 *
 * Reemplaza el patrón ad-hoc `vi.useFakeTimers() / vi.setSystemTime(...) /
 * vi.useRealTimers()` repetido en cada `beforeEach`/`afterEach`. Antes,
 * tests con `new Date()` fallaban intermitentes a las 23:59 cuando el día
 * cambiaba a mitad de ejecución.
 *
 * Uso:
 *   describe("mi feature", () => {
 *     withFrozenClock("2026-06-15T12:00:00Z");
 *     it("usa el reloj fijo", () => { ... });
 *   });
 *
 * O para un bloque específico:
 *   await runWithFrozenClock("2026-06-15", async () => { ... });
 */
import { vi, beforeEach, afterEach } from "vitest";

/** Suite-level: aplica un reloj fijo a TODOS los tests del describe actual. */
export function withFrozenClock(isoDate: string): void {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(isoDate));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** Función ad-hoc: ejecuta `fn` con reloj fijo y restaura al terminar (aunque falle). */
export async function runWithFrozenClock<T>(isoDate: string, fn: () => Promise<T> | T): Promise<T> {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoDate));
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}
