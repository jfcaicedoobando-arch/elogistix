import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateContext, type FacturaContext } from "./helpers.ts";
import { MSG_PPD_REQUIERE_99, MSG_PUE_REQUIERE_FORMA_REAL } from "../_shared/formaMetodoPago.ts";

function ctxBase(forma: string, metodo: string): FacturaContext {
  return {
    forma_pago: forma,
    metodo_pago: metodo,
    uso_cfdi: "G03",
    moneda: "MXN",
    tipo_cambio: 1,
    receptor: {
      legal_name: "Cliente Demo SA de CV",
      tax_id: "AAA010101AAA",
      tax_system: "601",
      address: { zip: "44100" },
    },
    conceptos: [
      {
        descripcion: "Flete marítimo",
        cantidad: 1,
        precio_unitario: 1000,
        clave_sat: "78101800",
        clave_unidad: "E48",
        tipo_iva: "gravado_16",
        tasa_iva: 0.16,
      },
    ],
  };
}

Deno.test("PPD + forma 99 pasa la validacion del servidor", () => {
  assertEquals(validateContext(ctxBase("99", "PPD")), []);
});

Deno.test("PPD con forma real se rechaza antes del PAC", () => {
  const issues = validateContext(ctxBase("03", "PPD"));
  assertEquals(issues.length, 1);
  assertEquals(issues[0].field, "forma_pago");
  assertEquals(issues[0].message, MSG_PPD_REQUIERE_99);
});

Deno.test("PUE + forma real pasa la validacion", () => {
  assertEquals(validateContext(ctxBase("03", "PUE")), []);
});

Deno.test("PUE con 99 se rechaza antes del PAC", () => {
  const issues = validateContext(ctxBase("99", "PUE"));
  assertEquals(issues.length, 1);
  assertEquals(issues[0].message, MSG_PUE_REQUIERE_FORMA_REAL);
});

Deno.test("metodo o forma ausentes siguen bloqueando", () => {
  assertEquals(validateContext(ctxBase("", "PUE")).length, 1);
  assertEquals(validateContext(ctxBase("99", "")).length >= 1, true);
});
