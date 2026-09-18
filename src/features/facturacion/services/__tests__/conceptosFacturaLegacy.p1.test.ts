/**
 * P1 · Auditoría IVA — hallazgo 3: editar un renglón legacy (sin tratamiento
 * fiscal capturado) NO debe declarar 16% en silencio. Sin `tipo_iva` explícito
 * el guardado se bloquea con un mensaje accionable, y con tratamiento explícito
 * la tasa es la canónica del tipo (no la global).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  agregarConceptoFactura,
  actualizarConceptoFactura,
  MSG_TIPO_IVA_REQUERIDO,
} from "../conceptosFacturaCrud";
import { resolverTasaConcepto } from "@/lib/financial/financialUtils";

const baseInput = {
  descripcion: "Flete marítimo",
  cantidad: 1,
  precio_unitario: 1000,
  clave_sat: "78101800",
};

describe("P1 · renglones legacy sin tratamiento de IVA", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.tableCalls.length = 0;
  });

  it.each([
    ["tasa nula", null],
    ["tasa 0", 0],
    ["tasa 8%", 0.08],
  ])("editar descripción/precio de una fila legacy (%s) se bloquea sin tipo_iva", async (_caso, tasa) => {
    await expect(
      actualizarConceptoFactura({
        conceptoId: "c-legacy",
        facturaId: "f1",
        input: { ...baseInput, tasa_iva_aplicada: tasa } as never,
      }),
    ).rejects.toThrow(MSG_TIPO_IVA_REQUERIDO);
    expect(mock.tableCalls.filter((c) => c.table === "conceptos_factura")).toHaveLength(0);
  });

  it("alta de concepto sin tipo_iva tampoco supone 16%", async () => {
    await expect(
      agregarConceptoFactura({
        facturaId: "f1",
        organizationId: "org1",
        moneda: "MXN",
        input: { ...baseInput } as never,
      }),
    ).rejects.toThrow(MSG_TIPO_IVA_REQUERIDO);
  });
});

describe("P1 · tasa canónica por tipo_iva (hallazgo 2)", () => {
  it("8% y tasa 0 con tasa numérica nula no caen a la tasa global", () => {
    expect(resolverTasaConcepto({ tipo_iva: "gravado_8", tasa_iva_aplicada: null, aplica_iva: true }, 0.16)).toBe(0.08);
    expect(resolverTasaConcepto({ tipo_iva: "tasa_0", tasa_iva_aplicada: null, aplica_iva: true }, 0.16)).toBe(0);
    expect(resolverTasaConcepto({ tipo_iva: "exento", tasa_iva_aplicada: null, aplica_iva: true }, 0.16)).toBe(0);
    expect(resolverTasaConcepto({ tipo_iva: "no_objeto", tasa_iva_aplicada: null, aplica_iva: true }, 0.16)).toBe(0);
  });

  it("gravado_16 usa la tasa configurada de la organización", () => {
    expect(resolverTasaConcepto({ tipo_iva: "gravado_16", tasa_iva_aplicada: null, aplica_iva: true }, 0.16)).toBe(0.16);
    expect(resolverTasaConcepto({ tipo_iva: "gravado_16", tasa_iva_aplicada: null, aplica_iva: true }, 0.15)).toBe(0.15);
  });

  it("un tratamiento explícito gana sobre una tasa numérica contradictoria", () => {
    expect(resolverTasaConcepto({ tipo_iva: "gravado_8", tasa_iva_aplicada: 0.16, aplica_iva: true }, 0.16)).toBe(0.08);
  });

  it("sólo el renglón legacy sin tipo conserva el comportamiento anterior", () => {
    expect(resolverTasaConcepto({ tipo_iva: null, tasa_iva_aplicada: 0.08, aplica_iva: true }, 0.16)).toBe(0.08);
    expect(resolverTasaConcepto({ tipo_iva: null, tasa_iva_aplicada: null, aplica_iva: true }, 0.16)).toBe(0.16);
    expect(resolverTasaConcepto({ tipo_iva: null, tasa_iva_aplicada: null, aplica_iva: false }, 0.16)).toBe(0);
  });
});
