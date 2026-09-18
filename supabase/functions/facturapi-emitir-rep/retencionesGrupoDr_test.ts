/**
 * P1 · Auditoría IVA — RetencionesDR con base por renglón.
 *
 * Caso de la auditoría: renglón A $1,000 con IVA 16% y retención de IVA 4%;
 * renglón B $500 sin retención. La base de la retención es la del renglón A,
 * no la suma de ambos. Además, dos tasas de IVA retenido ya no bloquean el REP.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTaxesDr } from "./helpers.ts";
import { resolverGruposRetencionDr, MSG_RETENCIONES_SIN_IMPORTES } from "./retencionesDr.ts";
import { resolverGruposTrasladoDr, type GrupoTrasladoDr } from "./trasladoDr.ts";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Renglón A: 1,000 gravado 16% con retención de IVA 4%. Renglón B: 500 al 16%. */
const CONCEPTOS = [
  { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 1000, tasa_ret_iva: 0.04 },
  { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 500 },
];

// Subtotal 1,500 + IVA 240 − retención IVA 40 (4% de 1,000) = 1,700.
const SUBTOTAL = 1500;
const TOTAL = 1700;

function taxes(impPagado: number, conceptos = CONCEPTOS) {
  const grupos = resolverGruposTrasladoDr(conceptos) as GrupoTrasladoDr[];
  const retenciones = resolverGruposRetencionDr(conceptos) as Array<
    { tipo: "IVA" | "ISR"; tasa: number; importe: number }
  >;
  return buildTaxesDr({
    tasa_iva: grupos[0].tasa,
    factor_iva: grupos[0].factor,
    imp_pagado: impPagado,
    subtotal_factura: SUBTOTAL,
    total_factura: TOTAL,
    grupos_iva: grupos,
    retenciones,
  });
}

Deno.test("pago completo: la retención se calcula sobre el renglón A, no sobre los 1,500", () => {
  const lista = taxes(TOTAL);
  const traslado = lista.filter((t) => !t.withholding);
  const retencion = lista.filter((t) => t.withholding);
  assertEquals(traslado.length, 1);
  assertEquals(traslado[0].base, SUBTOTAL);
  assertEquals(retencion.length, 1);
  assertEquals(retencion[0].type, "IVA");
  assertEquals(retencion[0].rate, 0.04);
  assertEquals(retencion[0].base, 1000);
});

Deno.test("pago parcial: base de traslado y de retención se prorratean con el mismo factor", () => {
  const impPagado = 850; // la mitad del documento
  const lista = taxes(impPagado);
  const traslado = lista.find((t) => !t.withholding)!;
  const retencion = lista.find((t) => t.withholding)!;
  assertEquals(traslado.base, round2((impPagado * SUBTOTAL) / TOTAL)); // 750
  assertEquals(retencion.base, round2((impPagado * 1000) / TOTAL)); // 500
});

Deno.test("dos tasas de IVA retenido ya no bloquean el REP y cada una lleva su base", () => {
  const conceptos = [
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 1000, tasa_ret_iva: 0.04 },
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 600, tasa_ret_iva: 0.106667 },
  ];
  const grupos = resolverGruposRetencionDr(conceptos);
  assertEquals(grupos, [
    { tipo: "IVA", tasa: 0.04, importe: 1000 },
    { tipo: "IVA", tasa: 0.106667, importe: 600 },
  ]);
});

Deno.test("ISR e IVA se declaran por separado con la base de sus renglones", () => {
  const conceptos = [
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 1000, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04 },
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 400, tasa_ret_isr: 0.1 },
  ];
  assertEquals(resolverGruposRetencionDr(conceptos), [
    { tipo: "ISR", tasa: 0.1, importe: 1400 },
    { tipo: "IVA", tasa: 0.04, importe: 1000 },
  ]);
});

Deno.test("retención en renglón sin importe se bloquea antes del claim", () => {
  assertEquals(resolverGruposRetencionDr([{ tasa_ret_iva: 0.04 }]), "sin_importes");
  assertEquals(MSG_RETENCIONES_SIN_IMPORTES.startsWith("LC_REP_RETENCIONES_SIN_IMPORTES"), true);
});

Deno.test("cuadratura: traslados + retenciones prorrateados suman el pago", () => {
  const impPagado = 1700;
  const lista = taxes(impPagado);
  const baseTraslados = round2(lista.filter((t) => !t.withholding).reduce((a, t) => a + t.base, 0));
  const ivaTrasladado = round2(
    lista.filter((t) => !t.withholding).reduce((a, t) => a + t.base * t.rate, 0),
  );
  const ivaRetenido = round2(
    lista.filter((t) => t.withholding).reduce((a, t) => a + t.base * t.rate, 0),
  );
  assertEquals(baseTraslados, SUBTOTAL);
  assertEquals(round2(baseTraslados + ivaTrasladado - ivaRetenido), impPagado);
});
