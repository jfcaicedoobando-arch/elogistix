// @ts-nocheck — Deno runtime
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCfdi } from "./parser.ts";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="A" Folio="123" Fecha="2025-03-14T10:22:01" SubTotal="1000.00" Total="1160.00" Moneda="MXN" TipoCambio="1">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="ACME SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="CLIENTE FINAL"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Servicio de flete" Importe="1000.00"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00" TotalImpuestosRetenidos="0.00"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="11111111-2222-3333-4444-555555555555"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

Deno.test("parseCfdi extrae campos clave", () => {
  const r = parseCfdi(SAMPLE);
  assertEquals(r.uuid, "11111111-2222-3333-4444-555555555555");
  assertEquals(r.folio, "123");
  assertEquals(r.fecha, "2025-03-14");
  assertEquals(r.total, 1160);
  assertEquals(r.subtotal, 1000);
  assertEquals(r.iva_trasladado, 160);
  assertEquals(r.moneda, "MXN");
  assertEquals(r.emisor.rfc, "ACM010101AAA");
  assertEquals(r.emisor.nombre, "ACME SA DE CV");
  assertEquals(r.conceptos.length, 1);
});

Deno.test("parseCfdi rechaza versión 3.3", () => {
  const x = SAMPLE.replace('Version="4.0"', 'Version="3.3"');
  assertThrows(() => parseCfdi(x), Error, "CFDI 4.0");
});

Deno.test("parseCfdi rechaza XML sin UUID", () => {
  const x = SAMPLE.replace(/<cfdi:Complemento>[\s\S]*<\/cfdi:Complemento>/, "");
  assertThrows(() => parseCfdi(x), Error, "timbre");
});

Deno.test("parseCfdi rechaza DOCTYPE (XXE)", () => {
  const x = `<!DOCTYPE foo>\n${SAMPLE}`;
  assertThrows(() => parseCfdi(x), Error, "DOCTYPE");
});
