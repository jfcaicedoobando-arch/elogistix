/**
 * Ola E3 · Sub-ola C — pruebas de traslado por tasa (N2) y saldo anterior con
 * notas de crédito (N1).
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolverTrasladoDr } from "./trasladoDr.ts";
import { ncAplicadasEnMonedaFactura } from "./ncDr.ts";
import { calcularParcialidad } from "./context.ts";

Deno.test("N2: tasa homogénea 16% se declara como Tasa 0.16", () => {
  const r = resolverTrasladoDr([
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
  ]);
  assertEquals(r, { tasa: 0.16, factor: "Tasa" });
});

Deno.test("N2: 16% + exento se rechaza (antes promediaba a 8%)", () => {
  const r = resolverTrasladoDr([
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
    { tipo_iva: "exento", tasa_iva_aplicada: null },
  ]);
  assertEquals(r, { tasa: 0.16, factor: "Tasa" });
  const mezcla = resolverTrasladoDr([
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
    { tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08 },
  ]);
  assertEquals(mezcla, null);
});

Deno.test("N2: factura toda exenta declara factor Exento", () => {
  assertEquals(
    resolverTrasladoDr([{ tipo_iva: "exento" }, { tipo_iva: "exento" }]),
    { tasa: 0, factor: "Exento" },
  );
});

Deno.test("N2: sin renglones cae al respaldo histórico", () => {
  assertEquals(resolverTrasladoDr([]), "sin_conceptos");
});

Deno.test("N1: NC aplicada en misma moneda se resta del saldo anterior", () => {
  const ncs = [
    { monto: 1000, moneda: "MXN", tipo_cambio: 1, estado: "Aplicada", fecha_emision: "2026-01-10" },
    { monto: 500, moneda: "MXN", tipo_cambio: 1, estado: "Borrador", fecha_emision: "2026-01-10" },
    { monto: 700, moneda: "MXN", tipo_cambio: 1, estado: "Aplicada", fecha_emision: "2026-03-01" },
  ];
  assertEquals(ncAplicadasEnMonedaFactura(ncs, "MXN", 1, "2026-02-01"), 1000);
});

Deno.test("N1: NC en MXN sobre factura USD se convierte con el T/C de la factura", () => {
  const ncs = [{ monto: 1740, moneda: "MXN", tipo_cambio: 1, estado: "Aplicada", fecha_emision: "2026-01-10" }];
  assertEquals(ncAplicadasEnMonedaFactura(ncs, "USD", 17.4, "2026-01-31"), 100);
});

Deno.test("N1: parcialidad resta pagos previos y notas de crédito", () => {
  const info = calcularParcialidad(
    [{ id: "p1", monto_aplicado_factura: 2000 }, { id: "p2", monto_aplicado_factura: 1000 }],
    "p2",
    10000,
    1000,
    3000,
  );
  assertEquals(info.numParcialidad, 2);
  assertEquals(info.saldoAnt, 5000);
  assertEquals(info.saldoInsoluto, 4000);
});
