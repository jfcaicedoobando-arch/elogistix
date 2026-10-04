import { describe, expect, it } from "vitest";
import { contarPartidasHuerfanas, type PartidaParaHuerfanas } from "../reconciliacionCostos.huerfanas";
const fiscal = (id = "f1"): PartidaParaHuerfanas => ({ proveedor_factura_id: id, concepto_costo_id: null, conceptos_costo: null });
const vinculo = (id = "f1", embarque = "e1", deleted_at: string | null = null): PartidaParaHuerfanas => ({
  proveedor_factura_id: id, concepto_costo_id: "c1", conceptos_costo: { embarque_id: embarque, deleted_at },
});
describe("63: partidas fiscales y asociaciones operativas", () => {
  it("una línea fiscal NULL con vínculo completo no es huérfana ni duplica el costo", () => {
    expect(contarPartidasHuerfanas([fiscal(), vinculo()], "e1")).toBe(0);
  });
  it("una línea fiscal sin vínculo de su propia factura sí sigue pendiente de asociación", () => {
    expect(contarPartidasHuerfanas([fiscal("f2"), vinculo("f1")], "e1")).toBe(1);
  });
  it("un vínculo válido no oculta vínculos a otro embarque", () => {
    expect(contarPartidasHuerfanas([fiscal(), vinculo(), vinculo("f1", "e2")], "e1")).toBe(1);
  });
  it("costos eliminados o invisibles no validan la asociación de la factura", () => {
    expect(contarPartidasHuerfanas([fiscal(), vinculo("f1", "e1", "2026-01-01")], "e1")).toBe(2);
    expect(contarPartidasHuerfanas([fiscal(), { ...vinculo(), conceptos_costo: null }], "e1")).toBe(2);
  });
  it("no cuenta importes ni líneas repetidas legítimas como cargos adicionales", () => {
    expect(contarPartidasHuerfanas([fiscal(), fiscal(), vinculo()], "e1")).toBe(0);
  });
});
