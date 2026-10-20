import { describe, it, expect } from "vitest";
import { buildPaso1Data } from "@/features/cotizacion/domain/mappers/cotizacion";
import { buildCotizacionDefaultValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { buildCotizacionInsertPayload } from "@/features/cotizacion/services/mutations/payloadBuilders";
import { COTIZACION_FORM_DEFAULTS } from "@/features/cotizacion/types";
import type { CotizacionInitialData, CreateCotizacionInput } from "@/features/cotizacion/types";

describe("cotizacion · campo Comercial", () => {
  it("el paso 1 envía el comercial elegido", () => {
    const out = buildPaso1Data({ ...COTIZACION_FORM_DEFAULTS, vendedorId: "u-7" }, [], "op@x");
    expect(out.vendedor_id).toBe("u-7");
  });

  it("sin comercial se guarda como sin asignar (null)", () => {
    const out = buildPaso1Data(COTIZACION_FORM_DEFAULTS, [], "op@x");
    expect(out.vendedor_id).toBeNull();
  });

  it("al editar se restaura el comercial guardado", () => {
    // SAFE-CAST: sólo se ejercita el campo del comercial.
    const v = buildCotizacionDefaultValues({ vendedor_id: "u-9" } as CotizacionInitialData);
    expect(v.vendedorId).toBe("u-9");
  });

  it("el alta incluye el comercial en el payload", () => {
    // SAFE-CAST: input mínimo para el builder puro.
    const p = buildCotizacionInsertPayload({ vendedor_id: "u-3", conceptos_venta: [] } as unknown as CreateCotizacionInput, "COT-1", "2026-10-20");
    expect(p.vendedor_id).toBe("u-3");
  });
});
