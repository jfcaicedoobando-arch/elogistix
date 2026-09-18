import { describe, it, expect } from "vitest";
import {
  clasificarCoherenciaIva,
  bloqueaTimbrado,
  mensajeCoherenciaIva,
} from "@/lib/financial/coherenciaIva";

describe("coherenciaIva — un solo tratamiento fiscal por renglón", () => {
  it("acepta gravado 16% y 8% con su tasa canónica", () => {
    expect(clasificarCoherenciaIva({ tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, aplica_iva: true }))
      .toMatchObject({ estado: "ok", tipo: "gravado_16", tasa: 0.16 });
    expect(clasificarCoherenciaIva({ tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08, aplica_iva: true }))
      .toMatchObject({ estado: "ok", tipo: "gravado_8", tasa: 0.08 });
  });

  it("rechaza 'tasa 0%' cobrando 16% (hallazgo 1)", () => {
    const r = clasificarCoherenciaIva({ tipo_iva: "tasa_0", tasa_iva_aplicada: 0.16, aplica_iva: true });
    expect(r.estado).toBe("incoherente");
    expect(bloqueaTimbrado(r)).toBe(true);
    expect(mensajeCoherenciaIva("Flete", r)).toContain("Flete");
  });

  it("acepta exento y no objeto sin tasa, y los distingue", () => {
    expect(clasificarCoherenciaIva({ tipo_iva: "exento", aplica_iva: false }))
      .toMatchObject({ estado: "ok", tipo: "exento", tasa: 0 });
    expect(clasificarCoherenciaIva({ tipo_iva: "no_objeto", tasa_iva_aplicada: null, aplica_iva: false }))
      .toMatchObject({ estado: "ok", tipo: "no_objeto", tasa: 0 });
    expect(clasificarCoherenciaIva({ tipo_iva: "no_objeto", tasa_iva_aplicada: 0.16 }).estado).toBe("incoherente");
  });

  it("bloquea gravado con el IVA apagado sin convertirlo en exento (hallazgo 2)", () => {
    const r = clasificarCoherenciaIva({ tipo_iva: "gravado_16", tasa_iva_aplicada: null, aplica_iva: false });
    expect(r.estado).toBe("incoherente");
    expect(r.motivo).toContain("desactivado");
  });

  it("bloquea gravado sin tasa registrada en lugar de rellenar 16%", () => {
    expect(clasificarCoherenciaIva({ tipo_iva: "gravado_16", tasa_iva_aplicada: null }).estado).toBe("incoherente");
  });

  it("marca ambiguo el legado sin tipo con IVA apagado y tasa heredada (hallazgo 3)", () => {
    const r = clasificarCoherenciaIva({ tipo_iva: null, aplica_iva: false, tasa_iva_aplicada: 0.16 });
    expect(r.estado).toBe("ambiguo");
    expect(r.tasa).toBe(0);
  });

  it("resuelve el legado coherente por tasa y flag, sin inventar no objeto", () => {
    expect(clasificarCoherenciaIva({ aplica_iva: true, tasa_iva_aplicada: 0.16 }))
      .toMatchObject({ estado: "ok", tipo: "gravado_16" });
    expect(clasificarCoherenciaIva({ aplica_iva: false, tasa_iva_aplicada: 0 }))
      .toMatchObject({ estado: "ok", tipo: "exento" });
    expect(clasificarCoherenciaIva({ aplica_iva: true, tasa_iva_aplicada: 0 }))
      .toMatchObject({ estado: "ok", tipo: "tasa_0" });
  });
});
