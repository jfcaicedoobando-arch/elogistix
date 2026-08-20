/**
 * BUG-01 (Ola G1) — blindaje transversal del filtro de papelera.
 *
 * `contexto_test.ts` ya cubre `facturapi-emitir`, pero los conceptos también se
 * leen al timbrar el REP y al enviar la factura por correo. Las Edge Functions
 * usan la service role key (bypassan RLS), así que el filtro explícito
 * `.is("deleted_at", null)` es la única defensa. Este test estructural falla si
 * alguien lo quita de cualquiera de esos flujos.
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ARCHIVOS = [
  "../facturapi-emitir/contexto.ts",
  "../facturapi-emitir-rep/index.ts",
  "../facturapi-enviar-email/index.ts",
] as const;

for (const rel of ARCHIVOS) {
  Deno.test(`${rel}: lee conceptos_factura excluyendo la papelera`, async () => {
    const src = await Deno.readTextFile(new URL(rel, import.meta.url));
    assertStringIncludes(src, 'from("conceptos_factura")');
    assertStringIncludes(src, '.is("deleted_at", null)');
  });

  Deno.test(`${rel}: cada lectura de conceptos_factura trae su filtro`, async () => {
    const src = await Deno.readTextFile(new URL(rel, import.meta.url));
    const lecturas = src.split('from("conceptos_factura")').length - 1;
    const filtros = src.split('.is("deleted_at", null)').length - 1;
    assert(
      filtros >= lecturas,
      `${rel}: ${lecturas} lectura(s) de conceptos_factura pero sólo ${filtros} filtro(s) deleted_at`,
    );
  });
}
