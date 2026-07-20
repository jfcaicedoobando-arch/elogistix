import { describe, it, expect, vi, afterEach } from "vitest";
import { todayLocalISO, todayLocalISOPlus } from "@/lib/date/today";

afterEach(() => vi.useRealTimers());

describe("todayLocalISO", () => {
  it("devuelve fecha local, no UTC (regresión bug 6 pm)", () => {
    // Sim: 20 julio 2026 23:30 hora local México (UTC-6) = 21 julio 05:30 UTC.
    // Simulamos ejecutando en TZ local del runner: usamos Date local con horas.
    const d = new Date(2026, 6, 20, 23, 30, 0); // 20 jul 23:30 local
    expect(todayLocalISO(d)).toBe("2026-07-20");
  });
  it("acepta default sin argumento", () => {
    expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("todayLocalISOPlus suma días", () => {
    const hoy = new Date();
    const iso = todayLocalISOPlus(0);
    expect(iso).toBe(todayLocalISO(hoy));
    expect(todayLocalISOPlus(1)).not.toBe(iso);
  });
});
