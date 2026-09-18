/**
 * P2-IVA — el XML del proveedor conserva el desglose fiscal por línea
 * (base, factor, tasa/cuota y ObjetoImp) sin alterar importes ni totales.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCfdi } from "./cfdiParser.ts";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" Fecha="2026-03-14T10:22:01" Moneda="MXN" SubTotal="3000" Total="3160" TipoDeComprobante="I">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Proveedor" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Cliente"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Flete gravado" Cantidad="1" ClaveUnidad="E48" ValorUnitario="1000" Importe="1000" ObjetoImp="02">
      <cfdi:Impuestos><cfdi:Traslados>
        <cfdi:Traslado Base="1000" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160"/>
      </cfdi:Traslados></cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto Descripcion="Exportacion tasa 0" Cantidad="1" ClaveUnidad="E48" ValorUnitario="1000" Importe="1000" ObjetoImp="02">
      <cfdi:Impuestos><cfdi:Traslados>
        <cfdi:Traslado Base="1000" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="0"/>
      </cfdi:Traslados></cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto Descripcion="Servicio no objeto" Cantidad="1" ClaveUnidad="E48" ValorUnitario="1000" Importe="1000" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160">
    <cfdi:Traslados><cfdi:Traslado Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160"/></cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital UUID="11111111-2222-3333-4444-555555555555"/></cfdi:Complemento>
</cfdi:Comprobante>`;

Deno.test("CFDI mixto: 16%, tasa 0% y no objeto conservan su desglose por línea", () => {
  const cfdi = parseCfdi(xml);
  assertEquals(cfdi.conceptos.length, 3);

  const [gravado, tasaCero, noObjeto] = cfdi.conceptos;

  assertEquals(gravado.objeto_imp, "02");
  assertEquals(gravado.traslados, [
    { impuesto: "002", base: 1000, tipo_factor: "Tasa", tasa_o_cuota: 0.16, importe: 160 },
  ]);

  assertEquals(tasaCero.objeto_imp, "02");
  assertEquals(tasaCero.traslados[0].tasa_o_cuota, 0);
  assertEquals(tasaCero.traslados[0].tipo_factor, "Tasa");

  // No objeto (SAT 01) no lleva traslados y no se convierte en exento ni tasa 0.
  assertEquals(noObjeto.objeto_imp, "01");
  assertEquals(noObjeto.traslados, []);

  // Los totales y los importes no cambian con el desglose añadido.
  assertEquals(cfdi.subtotal, 3000);
  assertEquals(cfdi.total, 3160);
  assertEquals(cfdi.iva_trasladado, 160);
  assertEquals(cfdi.conceptos.map((c) => c.importe), [1000, 1000, 1000]);
  assertEquals(cfdi.conceptos.map((c) => c.iva), [160, 0, 0]);
});
