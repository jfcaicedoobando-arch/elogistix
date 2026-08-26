import { describe, it, expect } from "vitest";
import { badgeVencimientoCartera } from "@/features/bandejas/routes/_sections/carteraDias";

/** Fecha ISO desplazada N días respecto a hoy (UTC). */
function enDias(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("badgeVencimientoCartera (B-25)", () => {
  it("marca vencidas con días positivos y variante destructiva", () => {
    expect(badgeVencimientoCartera(enDias(-5), 0)).toEqual({ texto: "Vencida 5d", variant: "destructive" });
  });

  it("dice 'Vence hoy' cuando vence hoy", () => {
    expect(badgeVencimientoCartera(enDias(0), 0)).toEqual({ texto: "Vence hoy", variant: "secondary" });
  });

  it("nunca muestra números negativos en facturas por vencer", () => {
    expect(badgeVencimientoCartera(enDias(5), 0).texto).toBe("Vence en 5d");
    expect(badgeVencimientoCartera(enDias(30), 0)).toEqual({ texto: "Vence en 30d", variant: "outline" });
  });

  it("cae al valor de la RPC cuando no hay fecha de vencimiento", () => {
    expect(badgeVencimientoCartera(null, 12).texto).toBe("Vencida 12d");
  });
});
