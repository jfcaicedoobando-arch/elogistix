/**
 * Tests para los helpers puros de cxc-recordatorios. Cubre:
 * - `ventana`: ventanas T-3 / T+7 / T+15 y rechazo de otros días.
 * - `diasParaVencer`: aritmética de fechas UTC.
 * - `calcularSaldoFactura`: pagos + notas de crédito Aplicada, ignora deleted_at
 *   y NCs no Aplicadas; nunca devuelve negativo.
 * - `buildBucketEntry`: forma del objeto.
 */
// @ts-nocheck — Deno runtime
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ventana,
  buildBucketEntry,
  calcularSaldoFactura,
  diasParaVencer,
  type FacturaRow,
} from "./helpers.ts";

Deno.test("ventana mapea -3/+7/+15", () => {
  assertEquals(ventana(-3), "T-3");
  assertEquals(ventana(7), "T+7");
  assertEquals(ventana(15), "T+15");
});

Deno.test("ventana descarta cualquier otro día", () => {
  for (const d of [-4, -2, 0, 1, 6, 8, 14, 16, 30]) {
    assertEquals(ventana(d), null, `día ${d} debe ser null`);
  }
});

Deno.test("diasParaVencer calcula diferencia en días UTC", () => {
  const hoy = new Date("2026-06-13T00:00:00Z");
  assertEquals(diasParaVencer("2026-06-20", hoy), 7);
  assertEquals(diasParaVencer("2026-06-10", hoy), -3);
  assertEquals(diasParaVencer("2026-06-13", hoy), 0);
});

const baseFactura = (over: Partial<FacturaRow> = {}): FacturaRow => ({
  id: "f1", numero: "FAC-001", cliente_id: "c1", cliente_nombre: "ACME",
  total: 1000, moneda: "MXN", fecha_vencimiento: "2026-06-20",
  pagos_factura: null, factura_notas_credito: null,
  ...over,
});

Deno.test("calcularSaldoFactura resta pagos no eliminados", () => {
  const f = baseFactura({
    pagos_factura: [
      { monto_aplicado_factura: 300, deleted_at: null },
      { monto_aplicado_factura: 200, deleted_at: null },
      { monto_aplicado_factura: 999, deleted_at: "2026-01-01" }, // ignorado
    ],
  });
  assertEquals(calcularSaldoFactura(f), 500);
});

Deno.test("calcularSaldoFactura suma NCs Aplicada, ignora no-aplicadas", () => {
  const f = baseFactura({
    factura_notas_credito: [
      { monto: 100, estado: "Aplicada", deleted_at: null },
      { monto: 200, estado: "Borrador", deleted_at: null }, // ignorada
      { monto: 50, estado: "Aplicada", deleted_at: "2026-01-01" }, // ignorada
    ],
  });
  assertEquals(calcularSaldoFactura(f), 900);
});

Deno.test("calcularSaldoFactura nunca regresa negativo", () => {
  const f = baseFactura({
    total: 100,
    pagos_factura: [{ monto_aplicado_factura: 200, deleted_at: null }],
  });
  assertEquals(calcularSaldoFactura(f), 0);
});

Deno.test("buildBucketEntry copia campos relevantes", () => {
  const f = baseFactura();
  assertEquals(buildBucketEntry(f, 500, 7), {
    factura_id: "f1", numero: "FAC-001", cliente_id: "c1", cliente_nombre: "ACME",
    saldo: 500, moneda: "MXN", fecha_vencimiento: "2026-06-20", dias: 7,
  });
});
