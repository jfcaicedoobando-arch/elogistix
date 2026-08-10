import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calcularTotalesPorMoneda,
  formatPorMoneda,
  type FacturaTotalizable,
} from "./totales.ts";

const AHORA = new Date("2026-08-10T12:00:00Z");

function factura(p: Partial<FacturaTotalizable>): FacturaTotalizable {
  return {
    total: 0,
    saldo: 0,
    moneda: "MXN",
    fecha_vencimiento: null,
    estado: "Emitida",
    ...p,
  };
}

Deno.test("M9 · agrupa totales por moneda sin sumar divisas distintas", () => {
  const totales = calcularTotalesPorMoneda(
    [
      factura({ total: 1000, saldo: 1000, moneda: "MXN" }),
      factura({ total: 500, saldo: 200, moneda: "USD" }),
    ],
    AHORA,
  );
  assertEquals(totales.length, 2);
  assertEquals(totales[0], { moneda: "MXN", total: 1000, saldo: 1000, vencido: 0 });
  assertEquals(totales[1], { moneda: "USD", total: 500, saldo: 200, vencido: 0 });
  assertEquals(formatPorMoneda(totales, "saldo"), "1,000.00 MXN · 200.00 USD");
});

Deno.test("M9 · la factura parcialmente pagada vencida entra al vencido", () => {
  const totales = calcularTotalesPorMoneda(
    [
      factura({
        total: 1000,
        saldo: 400,
        estado: "Parcialmente pagada",
        fecha_vencimiento: "2026-07-01",
      }),
    ],
    AHORA,
  );
  assertEquals(totales[0].vencido, 400);
});

Deno.test("M9 · no cuenta como vencido lo liquidado ni lo que aún no vence", () => {
  const totales = calcularTotalesPorMoneda(
    [
      factura({ total: 100, saldo: 0, estado: "Pagada", fecha_vencimiento: "2026-01-01" }),
      factura({ total: 100, saldo: 100, fecha_vencimiento: "2026-12-01" }),
    ],
    AHORA,
  );
  assertEquals(totales[0].vencido, 0);
  assertEquals(totales[0].saldo, 100);
});

Deno.test("M9 · moneda nula se trata como MXN y lista vacía no truena", () => {
  const totales = calcularTotalesPorMoneda([factura({ total: 50, saldo: 50, moneda: null })], AHORA);
  assertEquals(totales[0].moneda, "MXN");
  assertEquals(formatPorMoneda([], "total"), "0.00 MXN");
});
