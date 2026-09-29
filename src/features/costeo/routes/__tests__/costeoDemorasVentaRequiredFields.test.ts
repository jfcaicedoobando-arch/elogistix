import { describe, expect, it } from "vitest";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";
import { camposRequeridosDemoraValidos } from "../costeoDemorasVentaValidacion";

const base: DemoraVentaTarifaInput = {
  tipo_contenedor_id: "",
  desde_dia: 1,
  hasta_dia: null,
  monto_por_dia_usd: 0,
  vigente_desde: "2026-09-28",
  vigente_hasta: null,
  notas: null,
};

describe("camposRequeridosDemoraValidos", () => {
  it("no habilita Guardar sin seleccionar el tipo de contenedor", () => {
    expect(camposRequeridosDemoraValidos(base)).toBe(false);
  });

  it("no acepta tipo vacío ni monto no finito o negativo", () => {
    expect(camposRequeridosDemoraValidos({ ...base, tipo_contenedor_id: "  " })).toBe(false);
    expect(camposRequeridosDemoraValidos({
      ...base, tipo_contenedor_id: "20", monto_por_dia_usd: Number.NaN,
    })).toBe(false);
    expect(camposRequeridosDemoraValidos({
      ...base, tipo_contenedor_id: "20", monto_por_dia_usd: -1,
    })).toBe(false);
  });

  it("permite una tarifa de cero si el usuario la captura intencionalmente", () => {
    expect(camposRequeridosDemoraValidos({
      ...base, tipo_contenedor_id: "20", monto_por_dia_usd: 0,
    })).toBe(true);
  });
});
