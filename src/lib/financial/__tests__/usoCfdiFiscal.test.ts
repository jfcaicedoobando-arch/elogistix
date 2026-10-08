import { describe, expect, it } from "vitest";
import { USOS_CFDI_INGRESO, validarUsoCfdiIngreso, rfcReceptorFactura } from "../usoCfdiFiscal";
import { validarUsoCfdiIngreso as validarEdge } from "../../../../supabase/functions/_shared/usoCfdiFiscal";

const moral = "AAA010101AAA";
const fisica = "AAAA010101AAA";
describe("preflight Uso CFDI de ingreso", () => {
  it("frontend reexporta exactamente la implementación del servidor", () => {
    expect(validarUsoCfdiIngreso).toBe(validarEdge);
  });
  it.each(["XAXX010101000", "XEXX010101000", fisica])("616/G03 bloqueado para %s", (rfc) => {
    expect(validarUsoCfdiIngreso({ rfc, regimen: "616", usoCfdi: "G03" })).toEqual([
      expect.objectContaining({ code: "uso_regimen", message: expect.stringContaining("616") }),
    ]);
  });
  it.each([
    ["XAXX010101000", "616", "S01"], ["XEXX010101000", "616", "S01"],
    [moral, "601", "G03"], [fisica, "605", "D01"], [fisica, "616", "S01"],
  ])("acepta %s / %s / %s", (rfc, regimen, usoCfdi) => {
    expect(validarUsoCfdiIngreso({ rfc, regimen, usoCfdi })).toEqual([]);
  });
  it("separa persona, régimen/uso y RFC genérico", () => {
    expect(validarUsoCfdiIngreso({ rfc: moral, regimen: "605", usoCfdi: "D01" })).toEqual([expect.objectContaining({ code: "uso_persona" })]);
    expect(validarUsoCfdiIngreso({ rfc: "XAXX010101000", regimen: "601", usoCfdi: "G03" })).toEqual([expect.objectContaining({ code: "regimen_generico" })]);
  });
  it.each(["P01", "CP01", "CN01", "INVALIDO", "g03", " G03 "])("no ofrece ni acepta %s para ingreso", (usoCfdi) => {
    expect(USOS_CFDI_INGRESO).not.toContain(usoCfdi);
    expect(validarUsoCfdiIngreso({ rfc: moral, regimen: "601", usoCfdi })).toEqual([expect.objectContaining({ code: "uso_tipo" })]);
  });
  it("RFC snapshot tiene prioridad incluso vacío; sólo nullish usa cliente", () => {
    expect(rfcReceptorFactura("XAXX010101000", moral)).toBe("XAXX010101000");
    expect(rfcReceptorFactura("", moral)).toBe("");
    expect(rfcReceptorFactura(null, moral)).toBe(moral);
  });
});
