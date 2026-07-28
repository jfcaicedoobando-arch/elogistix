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
  assertEquals(r.ieps_trasladado, 0);
  assertEquals(r.moneda, "MXN");
  assertEquals(r.emisor.rfc, "ACM010101AAA");
  assertEquals(r.emisor.nombre, "ACME SA DE CV");
  assertEquals(r.conceptos.length, 1);
});

Deno.test("parseCfdi extrae IEPS (003) trasladado a nivel Comprobante", () => {
  const x = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="77" Fecha="2025-03-14T10:00:00" SubTotal="10000.00" Total="11832.00" Moneda="MXN">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="NAVIERA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="X"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Flete marítimo" Importe="10000.00">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="10000" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="1632.00"/>
          <cfdi:Traslado Base="10000" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.020000" Importe="200.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="1832.00" TotalImpuestosRetenidos="0.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="10000" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="1632.00"/>
      <cfdi:Traslado Base="10000" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.020000" Importe="200.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="dddddddd-eeee-ffff-0000-111111111111"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const r = parseCfdi(x);
  assertEquals(r.iva_trasladado, 1632);
  assertEquals(r.ieps_trasladado, 200);
  assertEquals(r.conceptos[0].iva, 1632);
  assertEquals(r.conceptos[0].ieps, 200);
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

Deno.test("parseCfdi ignora <Impuestos> de concepto y toma el del Comprobante", () => {
  const x = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="9" Fecha="2025-03-14T10:00:00" SubTotal="1000.00" Total="1160.00" Moneda="MXN">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="ACME" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="X"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Flete" Importe="1000.00">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00" TotalImpuestosRetenidos="0.00"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const r = parseCfdi(x);
  assertEquals(r.iva_trasladado, 160);
  assertEquals(r.retenciones, 0);
});

Deno.test("parseCfdi suma Traslado/Retencion cuando no hay totales en raíz", () => {
  const x = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="10" Fecha="2025-03-14T10:00:00" SubTotal="1000.00" Total="1060.00" Moneda="MXN">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="ACME" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="X"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Honorarios" Importe="1000.00">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
        <cfdi:Retenciones>
          <cfdi:Retencion Base="1000" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.100000" Importe="100.00"/>
        </cfdi:Retenciones>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="aaaaaaaa-bbbb-cccc-dddd-ffffffffffff"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const r = parseCfdi(x);
  assertEquals(r.iva_trasladado, 160);
  assertEquals(r.retenciones, 100);
});

Deno.test("parseCfdi rechaza XML vacío o no-CFDI", () => {
  assertThrows(() => parseCfdi(""), Error, "CFDI válido");
  assertThrows(() => parseCfdi("<foo/>"), Error, "CFDI válido");
});

Deno.test("parseCfdi limita conceptos a 200 (anti-DoS)", () => {
  const conceptos = Array.from({ length: 250 }, (_, i) =>
    `<cfdi:Concepto Descripcion="C${i}" Importe="10.00"/>`,
  ).join("\n");
  const x = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="50" Fecha="2025-03-14T10:00:00" SubTotal="2500.00" Total="2500.00" Moneda="MXN">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="ACME" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="X"/>
  <cfdi:Conceptos>${conceptos}</cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="bbbbbbbb-cccc-dddd-eeee-ffffffffffff"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const r = parseCfdi(x);
  assertEquals(r.conceptos.length, 200);
  assertEquals(r.conceptos[0].descripcion, "C0");
  assertEquals(r.conceptos[199].descripcion, "C199");
});

Deno.test("parseCfdi conserva los 11 conceptos de un CFDI real de flete", () => {
  const conceptos = Array.from({ length: 11 }, (_, i) =>
    `<cfdi:Concepto Descripcion="Linea ${i}" Importe="100.00"/>`,
  ).join("\n");
  const x = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="51" Fecha="2025-03-14T10:00:00" SubTotal="1100.00" Total="1100.00" Moneda="MXN">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="ACME" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="X"/>
  <cfdi:Conceptos>${conceptos}</cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="cccccccc-dddd-eeee-ffff-111111111111"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const r = parseCfdi(x);
  assertEquals(r.conceptos.length, 11);
});

Deno.test("parseCfdi default: tipo_cambio=1 y moneda=MXN cuando faltan atributos", () => {
  const x = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="60" Fecha="2025-03-14T10:00:00" SubTotal="100.00" Total="100.00">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="ACME" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="X"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="cccccccc-dddd-eeee-ffff-000000000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const r = parseCfdi(x);
  assertEquals(r.moneda, "MXN");
  // FIX-11: MXN sigue colapsando a 1; sólo USD/EUR sin TC devuelven null.
  assertEquals(r.tipo_cambio, 1);
});

Deno.test("parseCfdi: tipo_cambio=null cuando CFDI USD viene sin atributo TipoCambio", () => {
  const x = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="61" Fecha="2025-03-14T10:00:00" SubTotal="100.00" Total="100.00" Moneda="USD">
  <cfdi:Emisor Rfc="ACM010101AAA" Nombre="ACME" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="X"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="dddddddd-eeee-ffff-0000-111111111111"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const r = parseCfdi(x);
  assertEquals(r.moneda, "USD");
  assertEquals(r.tipo_cambio, null);
});


// ---------------------------------------------------------------------------
// v13.320.62 — entidades XML en atributos de texto.
// Bug real: RFC `AL&0807074L5` llegaba como `AL&amp;0807074L5` y rompía la
// consulta de estatus al SAT.
// ---------------------------------------------------------------------------
const SAMPLE_ENTIDADES = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="A&amp;B" Folio="7" Fecha="2025-03-14T10:22:01" SubTotal="100.00" Total="116.00" Moneda="MXN" TipoCambio="1">
  <cfdi:Emisor Rfc="AL&amp;0807074L5" Nombre="ALMACENES &amp; LOG&#205;STICA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="R &lt;TEST&gt;"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Flete &amp; maniobras" Importe="100.00"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="16.00" TotalImpuestosRetenidos="0.00"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="11111111-2222-3333-4444-555555555555"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

Deno.test("parseCfdi decodifica entidades XML en RFC, nombres y textos", () => {
  const r = parseCfdi(SAMPLE_ENTIDADES);
  assertEquals(r.emisor.rfc, "AL&0807074L5");
  assertEquals(r.emisor.nombre, "ALMACENES & LOGÍSTICA");
  assertEquals(r.receptor.nombre, "R <TEST>");
  assertEquals(r.serie, "A&B");
  assertEquals(r.conceptos[0].descripcion, "Flete & maniobras");
});

Deno.test("decodeXmlEntities no re-decodifica secuencias generadas", async () => {
  const { decodeXmlEntities } = await import("./parser.ts");
  assertEquals(decodeXmlEntities("&amp;lt;"), "&lt;");
  assertEquals(decodeXmlEntities("&#38;"), "&");
  assertEquals(decodeXmlEntities("sin entidades"), "sin entidades");
});
