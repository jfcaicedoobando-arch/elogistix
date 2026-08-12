/**
 * UIA-07 — `diasVencidoCartera` recalcula los días desde `fecha_vencimiento`
 * en hora local y sólo usa el valor de la RPC como último recurso.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { diasVencidoCartera } from "../carteraDias";

function conHoy(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("diasVencidoCartera (UIA-07)", () => {
  it("una factura que vence en 10 días no dice 'vence hoy' aunque la RPC devuelva 0", () => {
    conHoy("2026-08-12T15:00:00-06:00");
    expect(diasVencidoCartera("2026-08-22", 0)).toBe(-10);
  });

  it("devuelve positivo cuando ya venció", () => {
    conHoy("2026-08-12T15:00:00-06:00");
    expect(diasVencidoCartera("2026-08-05", 0)).toBe(7);
  });

  it("devuelve 0 cuando vence hoy", () => {
    conHoy("2026-08-12T15:00:00-06:00");
    expect(diasVencidoCartera("2026-08-12", 99)).toBe(0);
  });

  it("cae al valor de la RPC si no hay fecha de vencimiento", () => {
    expect(diasVencidoCartera(null, 4)).toBe(4);
    expect(diasVencidoCartera(undefined, -2)).toBe(-2);
  });
});
