/**
 * Tests del builder `buildPaso1Data` — foco en CONTRATO (cliente/prospecto,
 * operador, default values, validaciones por moneda).
 * El archivo hermano `cotizacionPaso1.test.ts` cubre el cálculo de dimensiones
 * LCL/Aéreas (peso volumétrico, conteo de piezas). Mantenemos ambos por
 * separation of concerns.
 */
import { describe, it, expect } from "vitest";
import { buildPaso1Data } from "@/lib/mappers/cotizacion";
import { COTIZACION_FORM_DEFAULTS } from "@/features/cotizacion/types";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

const baseClientes = [{ id: "c1", nombre: "ACME SA" }];

function build(overrides: Partial<CotizacionFormValues> = {}): CotizacionFormValues {
  return { ...COTIZACION_FORM_DEFAULTS, ...overrides };
}

describe("buildPaso1Data", () => {
  it("resuelve nombre desde catálogo cuando no es prospecto", () => {
    const out = buildPaso1Data(build({ clienteId: "c1" }), baseClientes, "u@x.com");
    expect(out.cliente_id).toBe("c1");
    expect(out.cliente_nombre).toBe("ACME SA");
    expect(out.es_prospecto).toBe(false);
    expect(out.operador).toBe("u@x.com");
  });

  it("cuando es prospecto usa prospectoEmpresa y limpia cliente_id", () => {
    const out = buildPaso1Data(
      build({ esProspecto: true, prospectoEmpresa: "Nueva SA", prospectoEmail: "n@x.com" }),
      baseClientes,
      "u@x.com",
    );
    expect(out.cliente_id).toBeNull();
    expect(out.cliente_nombre).toBe("Nueva SA");
    expect(out.prospecto_email).toBe("n@x.com");
  });

  it("Marítimo FCL: no copia dimensiones LCL ni aéreas", () => {
    const out = buildPaso1Data(
      build({ modo: "Marítimo", tipoEmbarque: "FCL", tipoContenedor: "40HC", numContenedores: 2 }),
      baseClientes,
      "u@x.com",
    );
    expect(out.tipo_embarque).toBe("FCL");
    expect(out.tipo_contenedor).toBe("40HC");
    expect(out.dimensiones_lcl).toEqual([]);
    expect(out.dimensiones_aereas).toEqual([]);
    expect(out.peso_kg).toBe(0);
    expect(out.volumen_m3).toBe(0);
  });

  it("Marítimo LCL: suma volumen y piezas desde dimensionesLCL", () => {
    const out = buildPaso1Data(
      build({
        modo: "Marítimo",
        tipoEmbarque: "LCL",
        dimensionesLCL: [
          { piezas: 3, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 1.5 },
          { piezas: 2, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 2 },
        ],
      }),
      baseClientes,
      "u@x.com",
    );
    expect(out.volumen_m3).toBe(3.5);
    expect(out.piezas).toBe(5);
  });

  it("Aéreo: suma peso volumétrico y piezas", () => {
    const out = buildPaso1Data(
      build({
        modo: "Aéreo",
        dimensionesAereas: [
          { piezas: 1, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 100 },
          { piezas: 4, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 50 },
        ],
      }),
      baseClientes,
      "u@x.com",
    );
    expect(out.peso_kg).toBe(150);
    expect(out.piezas).toBe(5);
  });

  it("Terrestre: usa pesoKg/volumenM3/piezas directos y tipoUnidad", () => {
    const out = buildPaso1Data(
      build({ modo: "Terrestre", pesoKg: 500, volumenM3: 3, piezas: 10, tipoUnidad: "Caja seca" }),
      baseClientes,
      "u@x.com",
    );
    expect(out.peso_kg).toBe(500);
    expect(out.volumen_m3).toBe(3);
    expect(out.piezas).toBe(10);
    expect(out.tipo_unidad).toBe("Caja seca");
  });

  it("vigencia_dias default 15 sin validez", () => {
    const out = buildPaso1Data(build({ validezPropuesta: undefined }), baseClientes, "u@x.com");
    expect(out.vigencia_dias).toBe(15);
  });

  it("vigencia_dias se calcula desde validezPropuesta", () => {
    const futuro = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const out = buildPaso1Data(build({ validezPropuesta: futuro }), baseClientes, "u@x.com");
    expect(out.vigencia_dias).toBeGreaterThanOrEqual(9);
    expect(out.vigencia_dias).toBeLessThanOrEqual(11);
  });

  it("seguro=false fuerza valor_seguro_usd=0", () => {
    const out = buildPaso1Data(build({ seguro: false, valorSeguroUsd: 9999 }), baseClientes, "u@x.com");
    expect(out.valor_seguro_usd).toBe(0);
  });
});
