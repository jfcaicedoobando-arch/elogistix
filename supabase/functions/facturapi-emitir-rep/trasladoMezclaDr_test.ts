/**
 * P1 · Auditoría IVA — Una factura PPD con varios tratamientos SÍ puede cobrarse:
 * el complemento de pago admite un arreglo de impuestos por documento
 * relacionado, así que se declara un grupo por tratamiento con la base
 * prorrateada. Antes cualquier mezcla bloqueaba el REP (facturas válidas sin
 * flujo de cobro) y antes de eso se declaraba una tasa promedio (dato falso).
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolverGruposTrasladoDr } from "./trasladoDr.ts";
import { buildTaxesDr } from "./helpers.ts";

const linea = (tipo: string, tasa: number | null, total: number) => ({
  tipo_iva: tipo,
  tasa_iva_aplicada: tasa,
  total,
});

Deno.test("16% + tasa 0% conserva los dos grupos con su importe", () => {
  assertEquals(
    resolverGruposTrasladoDr([
      linea("gravado_16", 0.16, 1000),
      linea("tasa_0", 0, 500),
    ]),
    [
      { tasa: 0.16, factor: "Tasa", importe: 1000 },
      { tasa: 0, factor: "Tasa", importe: 500 },
    ],
  );
});

Deno.test("16% + exento conserva el factor Exento como grupo aparte", () => {
  assertEquals(
    resolverGruposTrasladoDr([
      linea("gravado_16", 0.16, 800),
      linea("exento", null, 200),
    ]),
    [
      { tasa: 0.16, factor: "Tasa", importe: 800 },
      { tasa: 0, factor: "Exento", importe: 200 },
    ],
  );
});

Deno.test("renglones del mismo tratamiento se suman en un solo grupo", () => {
  assertEquals(
    resolverGruposTrasladoDr([
      linea("gravado_16", 0.16, 600),
      linea("gravado_16", null, 400),
      linea("gravado_8", 0.08, 100),
    ]),
    [
      { tasa: 0.16, factor: "Tasa", importe: 1000 },
      { tasa: 0.08, factor: "Tasa", importe: 100 },
    ],
  );
});

Deno.test("mezcla sin importes capturados no se prorratea: se bloquea", () => {
  assertEquals(
    resolverGruposTrasladoDr([
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
      { tipo_iva: "tasa_0", tasa_iva_aplicada: 0 },
    ]),
    "sin_importes",
  );
});

Deno.test("pago parcial de una factura 16% + 0%: bases por grupo que cuadran", () => {
  // Factura: 1000 al 16% + 500 al 0% ⇒ subtotal 1500, IVA 160, total 1660.
  // Pago de 830 (la mitad) ⇒ base total 750 = 500 (16%) + 250 (0%).
  const taxes = buildTaxesDr({
    tasa_iva: 0.16,
    factor_iva: "Tasa",
    imp_pagado: 830,
    subtotal_factura: 1500,
    total_factura: 1660,
    grupos_iva: [
      { tasa: 0.16, factor: "Tasa", importe: 1000 },
      { tasa: 0, factor: "Tasa", importe: 500 },
    ],
  });
  assertEquals(taxes.length, 2);
  assertEquals(taxes[0], { type: "IVA", rate: 0.16, factor: "Tasa", withholding: false, base: 500 });
  assertEquals(taxes[1], { type: "IVA", rate: 0, factor: "Tasa", withholding: false, base: 250 });
  assertEquals(taxes.reduce((a, t) => a + t.base, 0), 750);
});

Deno.test("segunda parcialidad del resto: la suma de bases sigue cuadrando", () => {
  const taxes = buildTaxesDr({
    tasa_iva: 0.16,
    factor_iva: "Tasa",
    imp_pagado: 830,
    subtotal_factura: 1500,
    total_factura: 1660,
    grupos_iva: [
      { tasa: 0.16, factor: "Tasa", importe: 1000 },
      { tasa: 0, factor: "Tasa", importe: 500 },
    ],
  });
  // Dos parcialidades de 830 cubren el total 1660 y sus bases suman el subtotal.
  assertEquals(taxes.reduce((a, t) => a + t.base, 0) * 2, 1500);
});

Deno.test("16% + exento: el grupo exento va con factor Exento y su propia base", () => {
  const taxes = buildTaxesDr({
    tasa_iva: 0.16,
    factor_iva: "Tasa",
    imp_pagado: 1128, // total = 800*1.16 + 200 = 1128 (pago completo)
    subtotal_factura: 1000,
    total_factura: 1128,
    grupos_iva: [
      { tasa: 0.16, factor: "Tasa", importe: 800 },
      { tasa: 0, factor: "Exento", importe: 200 },
    ],
  });
  assertEquals(taxes[0].base, 800);
  assertEquals(taxes[1], { type: "IVA", rate: 0, factor: "Exento", withholding: false, base: 200 });
});

Deno.test("un solo grupo mantiene el comportamiento histórico (base sin IVA)", () => {
  const conGrupo = buildTaxesDr({
    tasa_iva: 0.16,
    factor_iva: "Tasa",
    imp_pagado: 1160,
    subtotal_factura: 1000,
    total_factura: 1160,
    grupos_iva: [{ tasa: 0.16, factor: "Tasa", importe: 1000 }],
  });
  const legacy = buildTaxesDr({ tasa_iva: 0.16, factor_iva: "Tasa", imp_pagado: 1160 });
  assertEquals(conGrupo, legacy);
  assertEquals(conGrupo[0].base, 1000);
});

Deno.test("retenciones usan la base total del documento, no la de un grupo", () => {
  const taxes = buildTaxesDr({
    tasa_iva: 0.16,
    factor_iva: "Tasa",
    imp_pagado: 1088, // 1000 + 160 IVA - 40 ret IVA - 32 ret ISR (aprox)
    subtotal_factura: 1000,
    total_factura: 1088,
    retenciones: [{ tipo: "IVA", tasa: 0.04 }],
    grupos_iva: [
      { tasa: 0.16, factor: "Tasa", importe: 700 },
      { tasa: 0, factor: "Tasa", importe: 300 },
    ],
  });
  const traslados = taxes.filter((t) => !t.withholding);
  const retencion = taxes.find((t) => t.withholding)!;
  assertEquals(traslados.length, 2);
  assertEquals(retencion.base, round2(traslados.reduce((a, t) => a + t.base, 0)));
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
