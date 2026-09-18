/**
 * REP con renglones "No objeto de impuesto" (SAT ObjetoImp 01) — ruta de XML
 * manual del Complemento de Pagos 2.0.
 *
 * Cubre: ObjetoImpDR 01 sin nodo de impuestos, factura mixta 16% + no objeto,
 * retenciones, moneda distinta, y que el camino normal siga usando el bloque
 * estructurado de Facturapi.
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRepPayload, type PagoContext } from "./helpers.ts";
import { conComplementoXmlManual, requiereXmlManual } from "./repManual.ts";
import { fechaPagoSat } from "./pagoXml.ts";

type DrExtra = Partial<PagoContext["documento_relacionado"]>;

function ctxBase(dr: DrExtra, pago: Partial<PagoContext> = {}): PagoContext {
  return {
    receptor: {
      legal_name: "Cliente Demo SA de CV",
      tax_id: "ABC101010111",
      tax_system: "601",
      address: { zip: "85900" },
    },
    fecha_pago: "2026-09-18",
    forma_pago: "03",
    moneda: "MXN",
    tipo_cambio: 1,
    monto: 2160,
    documento_relacionado: {
      uuid: "39c85a3f-275b-4341-b259-e8971d9f8a94",
      folio: "101",
      serie: "A",
      moneda_dr: "MXN",
      tipo_cambio_dr: 1,
      num_parcialidad: 1,
      imp_saldo_ant: 2160,
      imp_pagado: 2160,
      imp_saldo_insoluto: 0,
      metodo_pago: "PPD",
      tasa_iva: 0.16,
      subtotal_factura: 2000,
      total_factura: 2160,
      ...dr,
    },
    ...pago,
  };
}

function xmlDe(ctx: PagoContext): string {
  const payload = buildRepPayload(ctx);
  const final = conComplementoXmlManual(payload, ctx);
  const complements = final.complements as Array<{ type: string; data: string }>;
  assertEquals(complements.length, 1);
  assertEquals(complements[0].type, "custom");
  return complements[0].data;
}

Deno.test("factura mixta 16% + no objeto: ObjetoImpDR 02 y sólo el IVA gravado", () => {
  const xml = xmlDe(ctxBase({
    hay_no_objeto: true,
    objeto_imp_dr: "02",
    importe_no_objeto: 1000,
    grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 1000 }],
  }));
  assertStringIncludes(xml, 'Version="2.0"');
  assertStringIncludes(xml, 'ObjetoImpDR="02"');
  assertStringIncludes(xml, 'BaseDR="1000.00"');
  assertStringIncludes(xml, 'TasaOCuotaDR="0.160000"');
  assertStringIncludes(xml, 'ImporteDR="160.00"');
  assertStringIncludes(xml, 'ImpuestoDR="002"');
  assertStringIncludes(xml, 'TotalTrasladosBaseIVA16="1000.00"');
  assertStringIncludes(xml, 'TotalTrasladosImpuestoIVA16="160.00"');
  assertStringIncludes(xml, 'MontoTotalPagos="2160.00"');
  // Un solo grupo de traslado: el renglón no objeto no aporta impuesto.
  assertEquals(xml.match(/TrasladoDR /g)?.length, 1);
});

Deno.test("todos los renglones no objeto: ObjetoImpDR 01 sin nodo de impuestos", () => {
  const xml = xmlDe(ctxBase({
    hay_no_objeto: true,
    objeto_imp_dr: "01",
    importe_no_objeto: 2000,
    grupos_iva: [],
    tasa_iva: 0,
    subtotal_factura: 2000,
    total_factura: 2000,
    imp_saldo_ant: 2000,
    imp_pagado: 2000,
  }, { monto: 2000 }));
  assertStringIncludes(xml, 'ObjetoImpDR="01"');
  assert(!xml.includes("ImpuestosDR"), "ObjetoImpDR=01 no debe llevar ImpuestosDR");
  assert(!xml.includes("TrasladoDR"), "ObjetoImpDR=01 no debe declarar traslados");
  assert(!xml.includes("TotalTrasladosBase"), "sin impuestos no se declaran totales de traslado");
  assertStringIncludes(xml, 'MontoTotalPagos="2000.00"');
});

Deno.test("nunca se traduce un renglón no objeto a Exento ni a tasa 0", () => {
  const xml = xmlDe(ctxBase({
    hay_no_objeto: true,
    objeto_imp_dr: "01",
    importe_no_objeto: 2000,
    grupos_iva: [],
    tasa_iva: 0,
  }));
  assert(!xml.includes('TipoFactorDR="Exento"'));
  assert(!xml.includes('TasaOCuotaDR="0.000000"'));
});

Deno.test("retenciones: RetencionesDR antes de TrasladosDR", () => {
  const xml = xmlDe(ctxBase({
    hay_no_objeto: true,
    objeto_imp_dr: "02",
    importe_no_objeto: 1000,
    grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 1000 }],
    retenciones: [{ tipo: "ISR", tasa: 0.1, importe: 1000 }],
  }));
  assertStringIncludes(xml, "<pago20:RetencionesDR>");
  assertStringIncludes(xml, 'ImpuestoDR="001"');
  assert(xml.indexOf("RetencionesDR") < xml.indexOf("TrasladosDR"));
  assertStringIncludes(xml, 'TotalRetencionesISR=');
});

Deno.test("pago en MXN de factura en USD: EquivalenciaDR y totales en pesos", () => {
  const xml = xmlDe(ctxBase({
    moneda_dr: "USD",
    tipo_cambio_dr: 17,
    imp_saldo_ant: 116,
    imp_pagado: 116,
    subtotal_factura: 100,
    total_factura: 116,
    hay_no_objeto: true,
    objeto_imp_dr: "02",
    importe_no_objeto: 0,
    grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 100 }],
  }, { moneda: "MXN", tipo_cambio: 1, monto: 1972 }));
  assertStringIncludes(xml, 'MonedaDR="USD"');
  assertStringIncludes(xml, "EquivalenciaDR=");
  assertStringIncludes(xml, 'BaseDR="100.00"');
  // 100 USD ÷ (1/17) = 1,700 MXN de base.
  assertStringIncludes(xml, 'TotalTrasladosBaseIVA16="1700.00"');
});

Deno.test("sin renglones no objeto se conserva el bloque estructurado", () => {
  const ctx = ctxBase({ grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 2000 }] });
  assertEquals(requiereXmlManual(ctx.documento_relacionado), false);
  const payload = buildRepPayload(ctx);
  assertEquals(payload.complements[0].type, "pago");
  assertEquals(payload.complements[0].data[0].related_documents[0].taxes.length, 1);
});

Deno.test("FechaPago se serializa como yyyy-MM-ddTHH:mm:ss", () => {
  assertEquals(fechaPagoSat("2026-09-18"), "2026-09-18T12:00:00");
  assertEquals(fechaPagoSat("2026-09-18T10:30"), "2026-09-18T10:30:00");
  assertEquals(fechaPagoSat("2026-09-18T10:30:45.123Z"), "2026-09-18T10:30:45");
});
