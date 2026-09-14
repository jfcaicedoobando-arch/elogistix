/**
 * v13.823.396 · Q2/Q4/Q5/Q6 — reconocimiento y reemplazo de las filas de costo
 * auto-generadas por el wizard, conservando SIEMPRE las capturadas a mano.
 */
import { describe, it, expect } from "vitest";
import {
  NOTA_AUTO_TARIFA,
  NOTA_AUTO_FLETE_LCL,
  esCostoAutoTarifa,
  esCostoAutoFleteLcl,
  esCostoAutoGenerado,
  sinCostosAutoTarifa,
  sinCostosAutoFleteLcl,
  sinCostosAutoGenerados,
  reemplazarCostosAutoTarifa,
  reemplazarCostosAutoFleteLcl,
  desajusteCantidadTarifa,
  fleteLclDesactualizado,
} from "@/features/cotizacion/domain/costosAutoGenerados";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

function fila(over: Partial<FilaCostoLocal> = {}): FilaCostoLocal {
  return {
    concepto: "Flete marítimo",
    moneda: "USD",
    proveedor: "ACME",
    cantidad: 1,
    costo_unitario: 1000,
    precio_venta: 1150,
    notas: "",
    ...over,
  } as FilaCostoLocal;
}

const autoTarifa = (over: Partial<FilaCostoLocal> = {}) => fila({ notas: NOTA_AUTO_TARIFA, ...over });
const autoLcl = (over: Partial<FilaCostoLocal> = {}) =>
  fila({ notas: `${NOTA_AUTO_FLETE_LCL} — W/M facturable 3 @ $45`, ...over });
const manual = (over: Partial<FilaCostoLocal> = {}) =>
  fila({ concepto: "Maniobras destino", notas: "Capturado a mano", ...over });

describe("detección de filas auto-generadas", () => {
  it("distingue tarifa, flete LCL y manual", () => {
    expect(esCostoAutoTarifa(autoTarifa())).toBe(true);
    expect(esCostoAutoTarifa(autoLcl())).toBe(false);
    expect(esCostoAutoFleteLcl(autoLcl())).toBe(true);
    expect(esCostoAutoGenerado(manual())).toBe(false);
  });

  it("no confunde una nota manual parecida", () => {
    expect(esCostoAutoTarifa(fila({ notas: "Auto-cargado desde tarifa marítima vieja" }))).toBe(false);
  });
});

describe("Q4/Q5 · limpieza por servicio o incoterm", () => {
  it("FCL → LCL: quita sólo las filas de tarifa y conserva manuales", () => {
    const filas = [autoTarifa(), manual(), autoLcl()];
    expect(sinCostosAutoTarifa(filas)).toEqual([manual(), autoLcl()]);
  });

  it("LCL → FCL: quita sólo la fila del flete LCL y conserva manuales", () => {
    const filas = [autoLcl(), manual(), autoTarifa()];
    expect(sinCostosAutoFleteLcl(filas)).toEqual([manual(), autoTarifa()]);
  });

  it("deja únicamente las filas manuales cuando se descarta todo lo automático", () => {
    expect(sinCostosAutoGenerados([autoTarifa(), autoLcl(), manual()])).toEqual([manual()]);
  });
});

describe("Q2 · desajuste de cantidad de contenedores", () => {
  it("detecta 1 → 2", () => {
    expect(desajusteCantidadTarifa([autoTarifa({ cantidad: 1 }), manual()], 2)).toBe(true);
  });

  it("detecta 2 → 1", () => {
    expect(desajusteCantidadTarifa([autoTarifa({ cantidad: 2 })], 1)).toBe(true);
  });

  it("no marca desajuste cuando coincide, ni por filas manuales", () => {
    expect(desajusteCantidadTarifa([autoTarifa({ cantidad: 2 }), manual({ cantidad: 5 })], 2)).toBe(false);
  });

  it("sin filas de tarifa no hay desajuste", () => {
    expect(desajusteCantidadTarifa([manual()], 3)).toBe(false);
  });
});

describe("Q6 · flete LCL obsoleto", () => {
  it("marca obsoleto cuando cambia el costo calculado", () => {
    const actual = [autoLcl({ costo_unitario: 135 }), manual()];
    const esperado = [autoLcl({ costo_unitario: 180 })];
    expect(fleteLclDesactualizado(actual, esperado)).toBe(true);
  });

  it("marca obsoleto cuando cambia el consolidador", () => {
    expect(fleteLclDesactualizado([autoLcl()], [autoLcl({ proveedor: "OTRO" })])).toBe(true);
  });

  it("no marca obsoleto cuando la firma es idéntica", () => {
    expect(fleteLclDesactualizado([autoLcl(), manual()], [autoLcl()])).toBe(false);
  });

  it("sin fila automática LCL no hay obsolescencia", () => {
    expect(fleteLclDesactualizado([manual()], [autoLcl()])).toBe(false);
  });
});

describe("reemplazo quirúrgico", () => {
  it("reemplazarCostosAutoTarifa conserva manuales y LCL", () => {
    const resultado = reemplazarCostosAutoTarifa(
      [autoTarifa({ cantidad: 1 }), manual(), autoLcl()],
      [autoTarifa({ cantidad: 2 })],
    );
    expect(resultado.filter(esCostoAutoTarifa)).toHaveLength(1);
    expect(resultado.filter(esCostoAutoTarifa)[0].cantidad).toBe(2);
    expect(resultado.some((f) => f.concepto === "Maniobras destino")).toBe(true);
    expect(resultado.filter(esCostoAutoFleteLcl)).toHaveLength(1);
  });

  it("reemplazarCostosAutoFleteLcl sólo toca la fila LCL", () => {
    const resultado = reemplazarCostosAutoFleteLcl(
      [autoLcl({ costo_unitario: 135 }), manual(), autoTarifa()],
      [autoLcl({ costo_unitario: 180 })],
    );
    expect(resultado.filter(esCostoAutoFleteLcl)).toHaveLength(1);
    expect(resultado.filter(esCostoAutoFleteLcl)[0].costo_unitario).toBe(180);
    expect(resultado.filter(esCostoAutoTarifa)).toHaveLength(1);
    expect(resultado.some((f) => f.concepto === "Maniobras destino")).toBe(true);
  });
});
