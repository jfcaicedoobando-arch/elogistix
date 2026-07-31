/**
 * P2-6.8 — La ventana "Vencen en 30 días" de la bandeja debe coincidir con el
 * KPI de Tesorería: el día 30 se incluye, sin importar la hora del día.
 */
import { describe, it, expect } from "vitest";
import { filtrarProgramables } from "../pagosProgramadosColumns";

type Row = Parameters<typeof filtrarProgramables>[0][number];

function isoEnDias(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function row(fecha: string | null, id: string): Row {
  // SAFE-CAST: fixture mínimo, sólo se usan las fechas en el filtro.
  return {
    id,
    fecha_vencimiento: fecha,
    fecha_programada_pago: null,
  } as unknown as Row;
}

describe("filtrarProgramables — ventana de 30 días", () => {
  it("incluye el día 30 exacto", () => {
    const res = filtrarProgramables([row(isoEnDias(30), "a")], "treinta_dias");
    expect(res).toHaveLength(1);
  });

  it("excluye el día 31", () => {
    const res = filtrarProgramables([row(isoEnDias(31), "b")], "treinta_dias");
    expect(res).toHaveLength(0);
  });

  it("no filtra cuando el modo es 'todas'", () => {
    const res = filtrarProgramables([row(isoEnDias(90), "c"), row(null, "d")], "todas");
    expect(res).toHaveLength(2);
  });
});
