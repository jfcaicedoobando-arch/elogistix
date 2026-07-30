import { describe, it, expect } from "vitest";
import { agruparChecksPorFase } from "../cierreCheckOrden";

describe("agruparChecksPorFase", () => {
  it("ordena las fases según el ciclo de vida del embarque", () => {
    const grupos = agruparChecksPorFase([
      { regla: "margen_minimo", ok: true },
      { regla: "cxc_cobrada", ok: false },
      { regla: "contenedores_datos_completos", ok: true },
      { regla: "documentos_completos", ok: true },
      { regla: "venta_conceptos_facturados", ok: false },
      { regla: "facturas_entrantes_capturadas", ok: true },
    ]);

    expect(grupos.map((g) => g.fase.id)).toEqual([
      "operacion",
      "documentos",
      "costos",
      "facturacion",
      "cobranza",
      "rentabilidad",
    ]);
  });

  it("ordena los checks dentro de la fase por su orden", () => {
    const [grupo] = agruparChecksPorFase([
      { regla: "contenedores_fechas_completas", ok: false },
      { regla: "contenedores_datos_completos", ok: true },
    ]);
    expect(grupo.checks.map((c) => c.regla)).toEqual([
      "contenedores_datos_completos",
      "contenedores_fechas_completas",
    ]);
  });

  it("calcula el conteo ok/total por fase", () => {
    const [grupo] = agruparChecksPorFase([
      { regla: "cxc_cobrada", ok: true },
      { regla: "cxp_pagada", ok: false },
    ]);
    expect(grupo.fase.id).toBe("cobranza");
    expect(grupo.okCount).toBe(1);
    expect(grupo.total).toBe(2);
  });

  it("omite fases sin reglas y manda reglas desconocidas a 'otros'", () => {
    const grupos = agruparChecksPorFase([{ regla: "regla_nueva_xyz", ok: false }]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fase.id).toBe("otros");
  });

  it("sin checks devuelve lista vacía", () => {
    expect(agruparChecksPorFase([])).toEqual([]);
  });
});
