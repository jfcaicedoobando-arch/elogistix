/**
 * IVA "No objeto de impuesto" (SAT ObjetoImp = 01) en el complemento de pago.
 *
 * CFDI Pagos 2.0 declara `ObjetoImpDR` por documento relacionado y `ImpuestosDR`
 * sólo aplica con ObjetoImpDR = 02. El SDK 5.1.0 lo expone como
 * `related_documents[].taxability`, así que el REP se timbra por la vía
 * estructurada: "01" (sin impuestos) cuando TODO el documento es no objeto y
 * "02" declarando sólo los impuestos gravados en las mixtas.
 *
 * `resolverGruposTrasladoDr` conserva el sentinel "no_objeto" como red de
 * seguridad del camino puro (el productivo filtra los renglones no objeto
 * antes de agrupar); nunca traduce "no objeto" a `Exento` ni a tasa 0%.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  esConceptoNoObjeto,
  MSG_REP_NO_OBJETO,
  resolverGruposTrasladoDr,
} from "./trasladoDr.ts";

Deno.test("no objeto NUNCA se traduce a Exento: devuelve el sentinel no_objeto", () => {
  assertEquals(resolverGruposTrasladoDr([{ tipo_iva: "no_objeto" }]), "no_objeto");
  assertEquals(
    resolverGruposTrasladoDr([{ tipo_iva: "no_objeto", tasa_iva_aplicada: null }]),
    "no_objeto",
  );
});

Deno.test("un renglón no objeto marca la lista completa como no_objeto", () => {
  assertEquals(
    resolverGruposTrasladoDr([
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 },
      { tipo_iva: "no_objeto", tasa_iva_aplicada: null },
    ]),
    "no_objeto",
  );
});

Deno.test("exento y tasa 0 siguen siendo representables como traslado", () => {
  assertEquals(resolverGruposTrasladoDr([{ tipo_iva: "exento" }]), [{ tasa: 0, factor: "Exento", importe: 0 }]);
  assertEquals(resolverGruposTrasladoDr([{ tipo_iva: "tasa_0", tasa_iva_aplicada: 0 }]), [
    { tasa: 0, factor: "Tasa", importe: 0 },
  ]);
});

Deno.test("el sentinel no se infiere de tasa 0 ni de tipos legacy", () => {
  assertEquals(esConceptoNoObjeto({ tipo_iva: "exento" }), false);
  assertEquals(esConceptoNoObjeto({ tipo_iva: null, tasa_iva_aplicada: 0 }), false);
  assertEquals(esConceptoNoObjeto({ tipo_iva: "NO_OBJETO" }), true);
  // P1-IVA: sin tipo_iva no se puede saber si era tasa 0%, exento o no objeto.
  assertEquals(resolverGruposTrasladoDr([{ tasa_iva_aplicada: 0 }]), "indeterminado");
});

Deno.test("el mensaje de respaldo no recomienda atajos contables no autorizados", () => {
  assertEquals(MSG_REP_NO_OBJETO.startsWith("LC_REP_NO_OBJETO:"), true);
  assertEquals(MSG_REP_NO_OBJETO.includes("ObjetoImpDR=01"), true);
  assertEquals(MSG_REP_NO_OBJETO.includes("bloqueado"), true);
  assertEquals(MSG_REP_NO_OBJETO.toLowerCase().includes("contabilidad"), true);
  assertEquals(MSG_REP_NO_OBJETO.toLowerCase().includes("soporte"), true);
  assertEquals(MSG_REP_NO_OBJETO.includes("PUE"), false);
  assertEquals(MSG_REP_NO_OBJETO.includes("sin REP"), false);
  assertEquals(MSG_REP_NO_OBJETO.includes("reemite"), false);
});
