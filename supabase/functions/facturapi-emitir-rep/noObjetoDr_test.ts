/**
 * IVA "No objeto de impuesto" (SAT ObjetoImp = 01) en el complemento de pago.
 *
 * CFDI Pagos 2.0 declara `ObjetoImpDR` por documento relacionado y `ImpuestosDR`
 * sólo aplica con ObjetoImpDR = 02. La API de Facturapi no expone ObjetoImpDR en
 * `related_documents` (sólo `taxes`), así que un renglón "no objeto" NO puede
 * representarse: antes se traducía a `Exento`, que es un dato fiscal falso.
 * Ahora `resolverTrasladoDr` devuelve el sentinel "no_objeto" y el llamador
 * bloquea el timbrado ANTES del claim.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  esConceptoNoObjeto,
  MSG_REP_NO_OBJETO,
  resolverTrasladoDr,
} from "./trasladoDr.ts";

Deno.test("no objeto NUNCA se traduce a Exento: se bloquea el REP", () => {
  assertEquals(resolverTrasladoDr([{ tipo_iva: "no_objeto" }]), "no_objeto");
  assertEquals(
    resolverTrasladoDr([{ tipo_iva: "no_objeto", tasa_iva_aplicada: null }]),
    "no_objeto",
  );
});

Deno.test("un solo renglón no objeto bloquea aunque el resto sea gravado", () => {
  assertEquals(
    resolverTrasladoDr([
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
      { tipo_iva: "no_objeto", tasa_iva_aplicada: null },
    ]),
    "no_objeto",
  );
});

Deno.test("exento y tasa 0 siguen siendo representables (no se bloquean)", () => {
  assertEquals(resolverTrasladoDr([{ tipo_iva: "exento" }]), { tasa: 0, factor: "Exento" });
  assertEquals(resolverTrasladoDr([{ tipo_iva: "tasa_0", tasa_iva_aplicada: 0 }]), {
    tasa: 0,
    factor: "Tasa",
  });
});

Deno.test("el bloqueo no se infiere de tasa 0 ni de tipos legacy", () => {
  assertEquals(esConceptoNoObjeto({ tipo_iva: "exento" }), false);
  assertEquals(esConceptoNoObjeto({ tipo_iva: null, tasa_iva_aplicada: 0 }), false);
  assertEquals(esConceptoNoObjeto({ tipo_iva: "NO_OBJETO" }), true);
  assertEquals(resolverTrasladoDr([{ tasa_iva_aplicada: 0 }]), { tasa: 0, factor: "Tasa" });
});

Deno.test("el mensaje de bloqueo no recomienda atajos contables no autorizados", () => {
  assertEquals(MSG_REP_NO_OBJETO.startsWith("LC_REP_NO_OBJETO:"), true);
  assertEquals(MSG_REP_NO_OBJETO.includes("ObjetoImpDR=01"), true);
  assertEquals(MSG_REP_NO_OBJETO.includes("bloqueado"), true);
  assertEquals(MSG_REP_NO_OBJETO.toLowerCase().includes("contabilidad"), true);
  assertEquals(MSG_REP_NO_OBJETO.toLowerCase().includes("soporte"), true);
  assertEquals(MSG_REP_NO_OBJETO.includes("PUE"), false);
  assertEquals(MSG_REP_NO_OBJETO.includes("sin REP"), false);
  assertEquals(MSG_REP_NO_OBJETO.includes("reemite"), false);
});
