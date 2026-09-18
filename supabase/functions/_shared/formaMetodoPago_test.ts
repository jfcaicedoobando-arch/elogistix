import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formaPagoParaMetodo,
  MSG_PPD_REQUIERE_99,
  MSG_PUE_REQUIERE_FORMA_REAL,
  normalizarClaveFormaPago,
  validarFormaMetodoPago,
} from "./formaMetodoPago.ts";

Deno.test("PPD con forma 99 es valido", () => {
  assertEquals(validarFormaMetodoPago("99", "PPD"), []);
});

Deno.test("PPD con forma real se bloquea", () => {
  const issues = validarFormaMetodoPago("03", "PPD");
  assertEquals(issues.length, 1);
  assertEquals(issues[0].field, "forma_pago");
  assertEquals(issues[0].message, MSG_PPD_REQUIERE_99);
});

Deno.test("PUE con forma real es valido", () => {
  assertEquals(validarFormaMetodoPago("03", "PUE"), []);
  assertEquals(validarFormaMetodoPago("01", "PUE"), []);
});

Deno.test("PUE con 99 se bloquea", () => {
  const issues = validarFormaMetodoPago("99", "PUE");
  assertEquals(issues.length, 1);
  assertEquals(issues[0].message, MSG_PUE_REQUIERE_FORMA_REAL);
});

Deno.test("forma ausente o fuera de catalogo se bloquea", () => {
  assertEquals(validarFormaMetodoPago("", "PUE").length, 1);
  assertEquals(validarFormaMetodoPago(null, "PPD").length, 1);
  assertEquals(validarFormaMetodoPago("77", "PUE").length, 1);
  assertEquals(validarFormaMetodoPago("Transferencia", "PUE").length, 1);
});

Deno.test("metodo invalido o ausente se bloquea", () => {
  assertEquals(validarFormaMetodoPago("03", "").some((i) => i.field === "metodo_pago"), true);
  assertEquals(validarFormaMetodoPago("03", "PIP").some((i) => i.field === "metodo_pago"), true);
});

Deno.test("normalizarClaveFormaPago solo acepta claves del catalogo", () => {
  assertEquals(normalizarClaveFormaPago(" 03 "), "03");
  assertEquals(normalizarClaveFormaPago("99"), "99");
  assertEquals(normalizarClaveFormaPago("07"), null);
  assertEquals(normalizarClaveFormaPago("3"), null);
});

Deno.test("formaPagoParaMetodo evita datos obsoletos al cambiar PUE<->PPD", () => {
  assertEquals(formaPagoParaMetodo("PPD", "03"), "99");
  assertEquals(formaPagoParaMetodo("PUE", "99"), "");
  assertEquals(formaPagoParaMetodo("PUE", "03"), "03");
});
