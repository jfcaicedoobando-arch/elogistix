import { describe, it, expect } from "vitest";
import { evaluarDesajusteEmbarque } from "../domain/avisoEmbarqueAnticipo";

describe("evaluarDesajusteEmbarque", () => {
  it("no avisa cuando el anticipo no tiene embarque", () => {
    const r = evaluarDesajusteEmbarque({ anticipoEmbarqueId: null, facturaEmbarqueId: "e1" });
    expect(r.hayDesajuste).toBe(false);
    expect(r.mensaje).toBeNull();
  });

  it("no avisa cuando coinciden", () => {
    const r = evaluarDesajusteEmbarque({ anticipoEmbarqueId: "e1", facturaEmbarqueId: "e1" });
    expect(r.hayDesajuste).toBe(false);
  });

  it("avisa cuando la factura no tiene embarque", () => {
    const r = evaluarDesajusteEmbarque({
      anticipoEmbarqueId: "e1",
      anticipoExpediente: "IMP-001",
      facturaEmbarqueId: null,
    });
    expect(r.hayDesajuste).toBe(true);
    expect(r.mensaje).toContain("IMP-001");
    expect(r.mensaje).toContain("no está vinculada");
  });

  it("avisa con ambos expedientes cuando difieren", () => {
    const r = evaluarDesajusteEmbarque({
      anticipoEmbarqueId: "e1",
      anticipoExpediente: "IMP-001",
      facturaEmbarqueId: "e2",
      facturaExpediente: "IMP-002",
    });
    expect(r.hayDesajuste).toBe(true);
    expect(r.mensaje).toContain("IMP-001");
    expect(r.mensaje).toContain("IMP-002");
  });
});
