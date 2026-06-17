import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidRfc, isValidZip, validateContext, buildFacturapiPayload, basicAuthHeader, type FacturaContext } from "./helpers.ts";

Deno.test("isValidRfc acepta RFC genérico XAXX010101000", () => {
  assert(isValidRfc("XAXX010101000"));
});

Deno.test("isValidRfc rechaza basura", () => {
  assertEquals(isValidRfc("ABC"), false);
  assertEquals(isValidRfc(null), false);
});

Deno.test("isValidZip exige 5 dígitos", () => {
  assert(isValidZip("01234"));
  assertEquals(isValidZip("123"), false);
});

const baseCtx: FacturaContext = {
  serie: "A",
  forma_pago: "03",
  metodo_pago: "PUE",
  uso_cfdi: "G03",
  moneda: "MXN",
  tipo_cambio: 1,
  receptor: { legal_name: "ACME SA", tax_id: "AAA010101AAA", tax_system: "601", address: { zip: "06600" } },
  conceptos: [{ descripcion: "Flete marítimo", cantidad: 1, precio_unitario: 1000, clave_sat: "78101800", clave_unidad: "E48", unidad: "Servicio", tasa_iva: 0.16 }],
};

Deno.test("validateContext sin errores con datos válidos", () => {
  assertEquals(validateContext(baseCtx).length, 0);
});

Deno.test("validateContext detecta clave SAT faltante", () => {
  const ctx = { ...baseCtx, conceptos: [{ ...baseCtx.conceptos[0], clave_sat: null }] };
  const issues = validateContext(ctx);
  assert(issues.some((i) => i.field.includes("clave_sat")));
});

Deno.test("buildFacturapiPayload omite exchange cuando moneda = MXN", () => {
  const p = buildFacturapiPayload(baseCtx);
  assertEquals(p.exchange, undefined);
  assertEquals(p.serie, "A");
  assertEquals(p.items.length, 1);
  assertEquals(p.items[0].product.product_key, "78101800");
});

Deno.test("buildFacturapiPayload incluye exchange con USD", () => {
  const p = buildFacturapiPayload({ ...baseCtx, moneda: "USD", tipo_cambio: 18.5 });
  assertEquals(p.exchange, 18.5);
  assertEquals(p.currency, "USD");
});

Deno.test("basicAuthHeader genera Basic con password vacío", () => {
  const h = basicAuthHeader("sk_test_123");
  assertEquals(h, `Basic ${btoa("sk_test_123:")}`);
});
