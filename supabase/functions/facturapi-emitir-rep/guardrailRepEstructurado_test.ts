/**
 * Guardrail — el REP viaja SIEMPRE por la vía estructurada de FacturAPI.
 *
 * El sandbox rechazó la ruta de XML manual (`complements[].type = "custom"`)
 * con `400 El campo complements no es válido`; el SDK 5.1.0 sí expone
 * `related_documents[].taxability` (ObjetoImpDR). Esta prueba impide que la
 * ruta manual reaparezca por copy/paste.
 *
 * Es estática (lee los fuentes) porque `etapaEmision.ts` arrastra
 * `timbrar.ts → _shared/facturapiClient.ts`, que importa `npm:facturapi` y no
 * resuelve fuera de Supabase.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const DIR = new URL(".", import.meta.url).pathname;

async function fuente(nombre: string): Promise<string> {
  return await Deno.readTextFile(`${DIR}${nombre}`);
}

Deno.test("ningún fuente del REP declara un complemento type custom", async () => {
  for await (const entrada of Deno.readDir(DIR)) {
    if (!entrada.isFile || !entrada.name.endsWith(".ts")) continue;
    if (entrada.name === "guardrailRepEstructurado_test.ts") continue;
    const texto = await fuente(entrada.name);
    assertEquals(
      /type:\s*["']custom["']|COMPLEMENTO_XML_TYPE/.test(texto),
      false,
      `${entrada.name} reintroduce la ruta custom del REP`,
    );
  }
});

Deno.test("los módulos de XML manual quedaron retirados", async () => {
  for (const nombre of ["repManual.ts", "pagoXml.ts", "pagoXmlDr.ts"]) {
    let existe = true;
    try {
      await Deno.stat(`${DIR}${nombre}`);
    } catch {
      existe = false;
    }
    assertEquals(existe, false, `${nombre} debería estar eliminado`);
  }
});

Deno.test("etapaEmision entrega el payload estructurado tal cual a timbrarRep", async () => {
  const texto = await fuente("etapaEmision.ts");
  assertEquals(texto.includes("payloadRepFinal"), false);
  assertEquals(texto.includes("repManual"), false);
  // El payload con external_id/idempotency_key va directo al timbrado.
  assert(/payload:\s*payload,/.test(texto));
  assert(texto.includes("external_id: claimTag"));
  assert(texto.includes("idempotency_key: claimTag"));
});

Deno.test("buildRepPayload conserva type pago y declara taxability", async () => {
  const texto = await fuente("helpers.ts");
  assert(texto.includes('type: "pago"'));
  assert(texto.includes('taxability: dr.objeto_imp_dr ?? "02"'));
});
