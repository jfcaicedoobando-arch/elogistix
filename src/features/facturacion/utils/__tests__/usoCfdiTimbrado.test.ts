import { describe, expect, it } from "vitest";
import { descripcionTimbradoExitoso, usoCfdiParaPreferencia } from "../usoCfdiTimbrado";
import { exitoWire, type TimbradoExitoWire } from "../../services/timbradoWire";
import { buildEstadoTimbrado } from "../estadoTimbrado";

const res: TimbradoExitoWire = { uuid: "uuid", folio: 1, serie: "A", facturapi_id: "id", pdf_url: "pdf", xml_url: "xml" };
const receptor = { rfc: "AAA010101AAA", regimen: "601", usoCfdi: "G03" };
const xml = { ...res, uso_cfdi_solicitado: "G03", uso_cfdi_efectivo: "S01", fuente_uso_cfdi: "xml" as const };
describe("resultado exitoso y preferencia de uso CFDI", () => {
  it("contrato anterior/REP sigue idéntico y no inventa uso efectivo", () => {
    expect(exitoWire(res)).toEqual(res);
    expect(usoCfdiParaPreferencia(res, receptor)).toBeUndefined();
    expect(descripcionTimbradoExitoso(res)).toBe("Serie A · Folio 1");
  });
  it("conserva metadatos y muestra solicitado/efectivo como éxito sin reemitir", () => {
    expect(exitoWire(xml)).toEqual(xml);
    expect(descripcionTimbradoExitoso(xml)).toContain("solicitado: G03; efectivo en el XML: S01");
    expect(descripcionTimbradoExitoso(xml)).not.toMatch(/fall[óo]|reintent|reemiti/i);
    expect(usoCfdiParaPreferencia(xml, receptor)).toBeUndefined();
  });
  it("aprende únicamente el uso solicitado, confirmado por XML y aún compatible", () => {
    const coincide = { ...xml, uso_cfdi_efectivo: "G03" };
    expect(usoCfdiParaPreferencia(coincide, receptor)).toBe("G03");
    expect(usoCfdiParaPreferencia(coincide, { ...receptor, regimen: "616" })).toBeUndefined();
  });
  it("extras malformados o sin fuente XML no convierten un timbre en fallo", () => {
    expect(exitoWire({ ...res, uso_cfdi_efectivo: "S01" })).toEqual(res);
    expect(exitoWire({ ...res, uso_cfdi_solicitado: {} } as never)).toEqual(res);
    expect(exitoWire({ ...res, uso_cfdi_efectivo: "INVALIDO", fuente_uso_cfdi: "xml" })).toEqual(res);
  });
  it("preflight usa RFC de factura, igual al payload, aunque cliente tenga otro", () => {
    const estado = buildEstadoTimbrado({ rfc_cliente: "XAXX010101000" },
      { rfc: receptor.rfc, regimen_fiscal: "601", codigo_postal: "64000" },
      { usoCfdi: "G03", metodoPago: "PUE", formaPago: "03" });
    expect(estado.puedeTimbrar).toBe(false);
    expect(estado.checks.some((c) => !c.ok && c.label.includes("requiere régimen fiscal 616"))).toBe(true);
  });
});
