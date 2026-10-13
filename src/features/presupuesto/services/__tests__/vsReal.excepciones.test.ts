import { describe, expect, it } from "vitest";
import { construirFila, construirFilaHuerfanos, mapPresupuestoPorCategoria } from "../vsRealDomain";
import { esExcepcionVsReal, etiquetaGastoSinPresupuesto, tieneGastoSinPresupuesto } from "../vsRealExcepciones";

const cat = { id: "fletes", nombre: "Fletes" };
const fila = (presupuesto: number | null, real: number) => construirFila(cat,
  presupuesto === null ? new Map() : new Map([[cat.id, presupuesto]]), new Map([[cat.id, real]]));

describe("EX08: gasto positivo sin base presupuestal", () => {
  it("distingue captura ausente de cero explícito sin inferir aprobación", () => {
    const presupuesto = mapPresupuestoPorCategoria([
      { categoria_id: "fletes", periodo: "2026-10", monto_mxn: "0" },
      { categoria_id: "otra", periodo: "2026-09", monto_mxn: 100 },
    ], "2026-10");
    expect(construirFila(cat, presupuesto, new Map()).presupuesto_capturado).toBe(true);
    expect(fila(null, 50).presupuesto_capturado).toBe(false);
    expect(etiquetaGastoSinPresupuesto(fila(0, 50))).toBe("Gasto con presupuesto cero");
    expect(etiquetaGastoSinPresupuesto(fila(null, 50))).toBe("Gasto sin captura de presupuesto");
  });

  it.each([null, 0])("con base %s hace visible gasto positivo sin convertirlo a porcentaje", (base) => {
    expect(esExcepcionVsReal(fila(base, 50))).toBe(true);
    expect(tieneGastoSinPresupuesto(fila(base, 50))).toBe(true);
    expect(fila(base, 50)).toMatchObject({ real_mxn: 50, variacion_mxn: 50, cumplimiento_pct: 0 });
  });

  it.each([0, -50])("conserva neto %s sin clasificarlo como gasto positivo sin base", (real) => {
    expect(esExcepcionVsReal(fila(0, real))).toBe(false);
    expect(fila(0, real).real_mxn).toBe(real);
  });

  it("preserva cero real=0%, netos negativos y umbral estrictamente >110%", () => {
    expect(fila(100, 0).cumplimiento_pct).toBe(0);
    expect(esExcepcionVsReal({ ...fila(100, 110), cumplimiento_pct: 110 })).toBe(false);
    expect(esExcepcionVsReal(fila(100, 110.01))).toBe(true);
    expect(fila(100, -30)).toMatchObject({ real_mxn: -30, variacion_mxn: -130, cumplimiento_pct: -30 });
    expect(esExcepcionVsReal(fila(100, -30))).toBe(false);
  });

  it("hace visible fila sin clasificar positiva, preserva neta negativa y no inventa captura", () => {
    const positiva = construirFilaHuerfanos(new Map([["inactiva", 50]]), new Set())!;
    expect(esExcepcionVsReal(positiva)).toBe(true);
    expect(etiquetaGastoSinPresupuesto(positiva)).toBe("Gasto sin presupuesto");
    expect(positiva.presupuesto_capturado).toBeUndefined();
    const negativa = construirFilaHuerfanos(new Map([["inactiva", -50]]), new Set())!;
    expect(esExcepcionVsReal(negativa)).toBe(false);
    expect(negativa.real_mxn).toBe(-50);
  });
});
