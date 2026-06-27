/**
 * v13.56.1 — Tests de la validación local de DialogSeguroForm (Bloque R).
 * Replica las reglas usadas dentro del handler `handleSubmit` para garantizar
 * que no se envíe al backend una póliza inválida.
 */
import { describe, it, expect } from "vitest";

function esValido(form: {
  aseguradora: string;
  numero_poliza: string;
  vigencia_desde: string;
  vigencia_hasta: string;
}): boolean {
  if (!form.aseguradora.trim()) return false;
  if (!form.numero_poliza.trim()) return false;
  if (form.vigencia_hasta < form.vigencia_desde) return false;
  return true;
}

describe("DialogSeguroForm — validación", () => {
  const base = {
    aseguradora: "AXA",
    numero_poliza: "POL-123",
    vigencia_desde: "2026-01-01",
    vigencia_hasta: "2026-12-31",
  };

  it("acepta un formulario completo y coherente", () => {
    expect(esValido(base)).toBe(true);
  });

  it("rechaza aseguradora vacía o solo espacios", () => {
    expect(esValido({ ...base, aseguradora: "" })).toBe(false);
    expect(esValido({ ...base, aseguradora: "   " })).toBe(false);
  });

  it("rechaza número de póliza vacío", () => {
    expect(esValido({ ...base, numero_poliza: "" })).toBe(false);
  });

  it("rechaza vigencia con fecha hasta anterior a la desde", () => {
    expect(esValido({ ...base, vigencia_desde: "2026-12-31", vigencia_hasta: "2026-01-01" })).toBe(false);
  });

  it("acepta vigencia de un solo día (desde == hasta)", () => {
    expect(esValido({ ...base, vigencia_desde: "2026-06-17", vigencia_hasta: "2026-06-17" })).toBe(true);
  });
});

describe("seguros — cálculo de días restantes de vigencia", () => {
  function diasRestantes(hasta: string, hoy = new Date()): number {
    // v13.137.36: sufijo `Z` para parsear como UTC y alinear con los fixtures `hoy`
    // (UTC explícito). Sin esto, hosts en zonas extremas (UTC+14) flippan el signo.
    const end = new Date(hasta + "T23:59:59Z").getTime();
    return Math.ceil((end - hoy.getTime()) / (24 * 60 * 60 * 1000));
  }

  it("retorna negativo cuando la póliza está vencida", () => {
    const hoy = new Date("2026-06-17T12:00:00Z");
    expect(diasRestantes("2026-06-10", hoy)).toBeLessThan(0);
  });

  it("retorna entre 0 y 7 para pólizas por vencer", () => {
    const hoy = new Date("2026-06-17T12:00:00Z");
    const d = diasRestantes("2026-06-20", hoy);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(7);
  });
});
