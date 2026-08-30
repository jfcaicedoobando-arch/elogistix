import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validarTcFiscal, TC_MXN_MIN, TC_MXN_MAX } from "./tcBanda.ts";

Deno.test("MXN no requiere tipo de cambio", () => {
  assertEquals(validarTcFiscal("MXN", null), null);
  assertEquals(validarTcFiscal(null, null), null);
});

Deno.test("bloquea TC inválido en moneda extranjera", () => {
  for (const moneda of ["USD", "EUR"]) {
    for (const tc of [null, undefined, NaN, "abc", 0, 1, 4.99, 40.01, 100]) {
      const r = validarTcFiscal(moneda, tc);
      assertEquals(typeof r, "string", `${moneda} con TC ${String(tc)} debía bloquear`);
    }
  }
});

Deno.test("acepta los límites de la banda", () => {
  assertEquals(validarTcFiscal("USD", TC_MXN_MIN), null);
  assertEquals(validarTcFiscal("USD", TC_MXN_MAX), null);
  assertEquals(validarTcFiscal("USD", 17.5), null);
  assertEquals(validarTcFiscal("EUR", 20), null);
});
