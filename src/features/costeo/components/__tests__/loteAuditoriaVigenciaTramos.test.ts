/** P2-3 fechas de vigencia · P2-4 tramos sin guardar. */
import { describe, it, expect } from "vitest";
import { esFormValido, mensajeVigencia, calcularErrores } from "../TarifaForm.helpers";
import { tramosSucios } from "@/features/costeo/utils/demorasTramos";

const form = {
  agente_id: "ag", naviera_id: "nv", ruta_id: "ru", tipo_contenedor_id: "tc",
  flete_base: 3200, dias_libres_demoras: 0, vigente_desde: "", vigente_hasta: "", recargos: [],
};

describe("P2-3 · vigencia", () => {
  it("fechas vacías ya no pasan", () => {
    expect(esFormValido(form)).toBe(false);
    expect(mensajeVigencia("", "")).toMatch(/Captura las fechas/);
  });
  it("rango invertido marca 'hasta' con mensaje", () => {
    const f = { ...form, vigente_desde: "2026-09-30", vigente_hasta: "2026-09-01" };
    expect(esFormValido(f)).toBe(false);
    expect(calcularErrores(f, 1, false).vigente_hasta).toBe(true);
    expect(mensajeVigencia(f.vigente_desde, f.vigente_hasta)).toMatch(/posterior/);
  });
  it("rango válido pasa", () => {
    expect(esFormValido({ ...form, vigente_desde: "2026-09-01", vigente_hasta: "2026-09-30" })).toBe(true);
  });
});

describe("P2-4 · tramos sin guardar", () => {
  const g = [{ desde_dia: 1, hasta_dia: 5, monto_por_dia: 80, moneda: "USD" }];
  it("detecta cambios y agregados", () => {
    expect(tramosSucios(g, g)).toBe(false);
    expect(tramosSucios([{ ...g[0], monto_por_dia: 90 }], g)).toBe(true);
    expect(tramosSucios([...g, { desde_dia: 6, hasta_dia: null, monto_por_dia: 120, moneda: "USD" }], g)).toBe(true);
  });
});
