import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  usd,
  formatVigencia,
  vigenciaHint,
  buildInitialFromTarifa,
} from "../CosteoTarifas.helpers";

describe("usd", () => {
  it("formatea a USD", () => {
    expect(usd(1500)).toMatch(/1,500/);
  });
});

describe("formatVigencia", () => {
  it("formatea vigencia DD/mes → DD/mes", () => {
    expect(formatVigencia("2026-07-01", "2026-08-15")).toBe("01/jul → 15/ago");
  });
  it("devuelve raw si el ISO es inválido", () => {
    expect(formatVigencia("bad", "2026-08-15")).toContain("bad");
  });
});

describe("vigenciaHint", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('detecta "vencida"', () => {
    const r = vigenciaHint("2026-07-01");
    expect(r.tone).toBe("danger");
    expect(r.text).toContain("vencida");
  });
  it('detecta "vence hoy"', () => {
    const r = vigenciaHint("2026-07-06");
    expect(r.tone).toBe("danger");
    expect(r.text).toBe("vence hoy");
  });
  it('marca warn dentro de 7 días', () => {
    const r = vigenciaHint("2026-07-10");
    expect(r.tone).toBe("warn");
  });
  it('marca muted más de 7 días', () => {
    const r = vigenciaHint("2026-08-30");
    expect(r.tone).toBe("muted");
  });
});

describe("buildInitialFromTarifa", () => {
  it("mapea campos y recargos", () => {
    const out = buildInitialFromTarifa({
      agente_id: "a", naviera_id: "n", ruta_id: "r", tipo_contenedor_id: "t",
      flete_base: "1000", dias_libres_demoras: 5,
      vigente_desde: "2026-07-01", vigente_hasta: "2026-08-01",
      transit_time_dias: 12, notas: "x",
      recargos: [
        { concepto: "BAF", lado: "origen", monto: "50", moneda: "USD", incluido_en_total: true },
        { concepto: "OTRO", lado: "raro", monto: 10, moneda: null, incluido_en_total: null },
      ],
    });
    expect(out.flete_base).toBe(1000);
    expect(out.transit_time_dias).toBe(12);
    expect(out.recargos).toHaveLength(2);
    expect(out.recargos![0]).toMatchObject({ concepto: "BAF", lado: "origen", monto: 50, moneda: "USD" });
    expect(out.recargos![1].lado).toBeUndefined();
    expect(out.recargos![1].moneda).toBe("USD");
    expect(out.recargos![1].incluido_en_total).toBe(true);
  });

  it("recargos omitidos → arreglo vacío", () => {
    const out = buildInitialFromTarifa({
      agente_id: "a", naviera_id: "n", ruta_id: "r", tipo_contenedor_id: "t",
      flete_base: 100, dias_libres_demoras: 0,
      vigente_desde: "2026-01-01", vigente_hasta: "2026-01-31",
      transit_time_dias: null, notas: null,
    });
    expect(out.recargos).toEqual([]);
    expect(out.transit_time_dias).toBe(0);
  });
});
