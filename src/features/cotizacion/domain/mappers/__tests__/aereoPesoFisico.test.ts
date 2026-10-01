import { describe, it, expect } from "vitest";
import { buildPaso1Data } from "../cotizacion";
import { buildCotizacionDefaultValues } from "../cotizacionForm";
import { buildCotizacionInsertPayload } from "@/features/cotizacion/services/mutations/payloadBuilders";
import { buildMercanciaUpdates } from "@/features/embarques/domain/mappers/embarqueCotizacion";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
import { COTIZACION_FORM_DEFAULTS, type CreateCotizacionInput } from "@/features/cotizacion/types";
import { cotizacionUpdateSchema } from "@/lib/validation/mutationSchemas";

const dimensiones = [{ piezas: 2, alto_cm: 80, largo_cm: 120, ancho_cm: 100, peso_volumetrico_kg: 320 }];
const cot = (peso: number | null = 600) => makeCotizacionRow({
  modo: "Aéreo", peso_kg: 320, peso_fisico_kg: peso,
  dimensiones_aereas: dimensiones, volumen_m3: 0, piezas: 2,
});

describe("N01 · peso físico aéreo", () => {
  it("captura 600 físicos, conserva 320 volumétricos y calcula 1.92 m³ sin cambiar precios", () => {
    const payload = buildPaso1Data({ ...COTIZACION_FORM_DEFAULTS, modo: "Aéreo", pesoKg: 600, dimensionesAereas: dimensiones }, [], "");
    expect(payload).toMatchObject({ peso_kg: 320, peso_fisico_kg: 600, volumen_m3: 1.92, piezas: 2 });
    const insert = buildCotizacionInsertPayload(payload as unknown as CreateCotizacionInput, "COT-MOCK", "2026-10-15");
    expect(insert.peso_fisico_kg).toBe(600);
    expect(insert.volumen_m3).toBe(1.92);
  });
  it("reabrir una cotización restaura el peso físico, no el volumétrico", () => {
    expect(buildCotizacionDefaultValues(cot()).pesoKg).toBe(600);
    expect(buildCotizacionDefaultValues(cot(null)).pesoKg).toBe(0);
  });
  it("la vinculación al embarque usa peso físico y volumen geométrico, también con volumen legacy 0", () => {
    const updates = Object.fromEntries(buildMercanciaUpdates(cot()));
    expect(updates).toMatchObject({ pesoKg: "600", volumenM3: "1.92", piezas: "2" });
    expect(Object.fromEntries(buildMercanciaUpdates(cot(null))).pesoKg).toBe("");
  });
  it("no confunde medidas en terrestre ni LCL", () => {
    for (const modo of ["Terrestre", "Marítimo"] as const) {
      const terrestre = makeCotizacionRow({ modo, peso_kg: 600, volumen_m3: 1.92, peso_fisico_kg: null });
      expect(Object.fromEntries(buildMercanciaUpdates(terrestre))).toMatchObject({ pesoKg: "600", volumenM3: "1.92" });
    }
  });
  it("no persiste el peso físico si queda pendiente; rechaza negativos y no finitos", () => {
    const payload = buildPaso1Data({ ...COTIZACION_FORM_DEFAULTS, modo: "Aéreo", pesoKg: 0, dimensionesAereas: dimensiones }, [], "");
    expect(payload.peso_fisico_kg).toBeNull();
    for (const valor of [-1, NaN, Infinity]) expect(cotizacionUpdateSchema.safeParse({ peso_fisico_kg: valor }).success).toBe(false);
  });
});
