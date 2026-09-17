/**
 * MNY P1.3: normalización de signos del estado de cuenta BBVA.
 * Nunca deben entrar importes negativos (después se leen como magnitudes y se
 * volverían cero o no conciliables).
 */
import { describe, expect, it } from "vitest";
import { clasificarFila, type ColIdx } from "../bbva.filas";

const idx: ColIdx = { fecha: 0, conc: 1, ref: 2, cargo: 3, abono: 4, saldo: 5 };

const fila = (cargo: string, abono: string) =>
  ["01/05/2026", "MOVIMIENTO", "REF1", cargo, abono, "1000.00"];

describe("clasificarFila · signos", () => {
  it("convierte un cargo negativo en magnitud positiva", async () => {
    const r = await clasificarFila(fila("-1,234.50", ""), idx, 5);
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") {
      expect(r.movimiento.cargo).toBe(1234.5);
      expect(r.movimiento.abono).toBe(0);
    }
  });

  it("convierte un cargo entre paréntesis en magnitud positiva", async () => {
    const r = await clasificarFila(fila("(980.25)", ""), idx, 6);
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.movimiento.cargo).toBe(980.25);
  });

  it("descarta un depósito negativo con evidencia", async () => {
    const r = await clasificarFila(fila("", "-500.00"), idx, 7);
    expect(r.tipo).toBe("ilegible");
    if (r.tipo === "ilegible") expect(r.descarte.fila).toBe(7);
  });

  it("descarta una fila con cargo y abono a la vez", async () => {
    const r = await clasificarFila(fila("100.00", "200.00"), idx, 8);
    expect(r.tipo).toBe("ilegible");
  });

  it("conserva el abono positivo tal cual", async () => {
    const r = await clasificarFila(fila("", "5,000.00"), idx, 9);
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") {
      expect(r.movimiento.abono).toBe(5000);
      expect(r.movimiento.cargo).toBe(0);
    }
  });
});
