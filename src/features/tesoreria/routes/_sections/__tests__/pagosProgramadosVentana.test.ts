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

  /** MNY-09: la ventana es "hoy y los próximos 30 días", no incluye vencidas. */
  it("incluye hoy (día 0) y excluye el día -1 ya vencido", () => {
    expect(filtrarProgramables([row(isoEnDias(0), "hoy")], "treinta_dias")).toHaveLength(1);
    expect(filtrarProgramables([row(isoEnDias(-1), "ayer")], "treinta_dias")).toHaveLength(0);
  });

  it("de -1, 0, 30 y 31 días sólo deja 0 y 30", () => {
    const res = filtrarProgramables(
      [row(isoEnDias(-1), "a"), row(isoEnDias(0), "b"), row(isoEnDias(30), "c"), row(isoEnDias(31), "d")],
      "treinta_dias",
    );
    expect(res.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("no filtra cuando el modo es 'todas'", () => {
    const res = filtrarProgramables([row(isoEnDias(90), "c"), row(null, "d")], "todas");
    expect(res).toHaveLength(2);
  });
});
