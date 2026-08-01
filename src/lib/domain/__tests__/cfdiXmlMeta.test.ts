// jsdom: usa document./DOMParser real para parsear XML de CFDI.
import { describe, it, expect } from "vitest";
import {
  extraerCfdiXmlMeta,
  extraerCfdiXmlMetaDeArchivo,
  fechaCfdiADia,
  metaCfdiUtil,
  CFDI_XML_META_VACIO,
} from "../cfdiXmlMeta";

const XML_VALIDO = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="A" Folio="123" Total="1160.00" Moneda="MXN" Fecha="2026-07-30T12:00:00">
  <cfdi:Emisor Rfc="ABC010101AAA" Nombre="Empresa SA" />
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="abcd1234-0000-0000-0000-000000000000" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

describe("fechaCfdiADia", () => {
  it("null devuelve null", () => {
    expect(fechaCfdiADia(null)).toBeNull();
  });

  it("extrae la fecha de un timestamp ISO completo", () => {
    expect(fechaCfdiADia("2026-07-30T12:00:00")).toBe("2026-07-30");
  });

  it("cadena sin formato de fecha devuelve null", () => {
    expect(fechaCfdiADia("no-es-fecha")).toBeNull();
  });

  it("recorta espacios antes de matchear", () => {
    expect(fechaCfdiADia("  2026-01-01T00:00:00 ")).toBe("2026-01-01");
  });
});

describe("extraerCfdiXmlMeta", () => {
  it("XML malformado (parsererror) devuelve meta vacía", () => {
    const out = extraerCfdiXmlMeta("<esto no es <xml valido");
    expect(out).toEqual(CFDI_XML_META_VACIO);
  });

  it("XML sin nodo Comprobante devuelve meta vacía", () => {
    const out = extraerCfdiXmlMeta("<otraCosa><Nada/></otraCosa>");
    expect(out).toEqual(CFDI_XML_META_VACIO);
  });

  it("parsea CFDI válido completo", () => {
    const out = extraerCfdiXmlMeta(XML_VALIDO);
    expect(out.uuid).toBe("ABCD1234-0000-0000-0000-000000000000");
    expect(out.rfcEmisor).toBe("ABC010101AAA");
    expect(out.nombreEmisor).toBe("Empresa SA");
    expect(out.folioSerie).toBe("A-123");
    expect(out.total).toBe(1160);
    expect(out.moneda).toBe("MXN");
    expect(out.fechaEmision).toBe("2026-07-30");
  });

  it("sin Serie usa sólo Folio", () => {
    const xml = XML_VALIDO.replace('Serie="A" ', "");
    const out = extraerCfdiXmlMeta(xml);
    expect(out.folioSerie).toBe("123");
  });

  it("sin Folio usa sólo Serie", () => {
    const xml = XML_VALIDO.replace('Folio="123" ', "");
    const out = extraerCfdiXmlMeta(xml);
    expect(out.folioSerie).toBe("A");
  });

  it("sin Serie ni Folio devuelve null", () => {
    const xml = XML_VALIDO.replace('Serie="A" ', "").replace('Folio="123" ', "");
    const out = extraerCfdiXmlMeta(xml);
    expect(out.folioSerie).toBeNull();
  });

  it("sin nodo Emisor deja rfcEmisor y nombreEmisor en null", () => {
    const xml = XML_VALIDO.replace(/<cfdi:Emisor[^/]*\/>/, "");
    const out = extraerCfdiXmlMeta(xml);
    expect(out.rfcEmisor).toBeNull();
    expect(out.nombreEmisor).toBeNull();
  });

  it("sin TimbreFiscalDigital deja uuid en null", () => {
    const xml = XML_VALIDO.replace(/<cfdi:Complemento>[\s\S]*<\/cfdi:Complemento>/, "");
    const out = extraerCfdiXmlMeta(xml);
    expect(out.uuid).toBeNull();
  });

  it("sin Total deja total en null", () => {
    const xml = XML_VALIDO.replace('Total="1160.00" ', "");
    const out = extraerCfdiXmlMeta(xml);
    expect(out.total).toBeNull();
  });

  it("sin Moneda deja moneda en null", () => {
    const xml = XML_VALIDO.replace('Moneda="MXN" ', "");
    const out = extraerCfdiXmlMeta(xml);
    expect(out.moneda).toBeNull();
  });

  it("acepta atributos en minúsculas (rfc, nombre, serie, folio, total, moneda, fecha)", () => {
    const xmlMin = `<Comprobante serie="B" folio="9" total="50.00" moneda="usd" fecha="2026-01-01T00:00:00">
      <Emisor rfc="xyz010101aaa" nombre="Otra Empresa" />
    </Comprobante>`;
    const out = extraerCfdiXmlMeta(xmlMin);
    expect(out.folioSerie).toBe("B-9");
    expect(out.total).toBe(50);
    expect(out.moneda).toBe("USD");
    expect(out.rfcEmisor).toBe("XYZ010101AAA");
    expect(out.nombreEmisor).toBe("Otra Empresa");
    expect(out.fechaEmision).toBe("2026-01-01");
  });

  it("atributos con espacios en blanco se tratan como ausentes", () => {
    const xml = `<Comprobante Serie="   " Folio="123" Total="10.00"><Emisor Rfc="ABC010101AAA" /></Comprobante>`;
    const out = extraerCfdiXmlMeta(xml);
    expect(out.folioSerie).toBe("123");
  });
});

describe("extraerCfdiXmlMetaDeArchivo", () => {
  it("lee el texto del archivo y extrae metadatos", async () => {
    const file = new File([XML_VALIDO], "factura.xml", { type: "application/xml" });
    const out = await extraerCfdiXmlMetaDeArchivo(file);
    expect(out.uuid).toBe("ABCD1234-0000-0000-0000-000000000000");
  });
});

describe("metaCfdiUtil", () => {
  it("true cuando uuid y rfcEmisor están presentes", () => {
    expect(metaCfdiUtil({ ...CFDI_XML_META_VACIO, uuid: "u", rfcEmisor: "r" })).toBe(true);
  });

  it("false cuando falta uuid", () => {
    expect(metaCfdiUtil({ ...CFDI_XML_META_VACIO, rfcEmisor: "r" })).toBe(false);
  });

  it("false cuando falta rfcEmisor", () => {
    expect(metaCfdiUtil({ ...CFDI_XML_META_VACIO, uuid: "u" })).toBe(false);
  });

  it("false con meta totalmente vacía", () => {
    expect(metaCfdiUtil(CFDI_XML_META_VACIO)).toBe(false);
  });
});
