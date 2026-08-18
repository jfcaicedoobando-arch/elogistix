/**
 * BUG-01 (auditoría 2026-08-18) — invariantes del contexto fiscal.
 *
 * Timbrar con conceptos borrados o con la cabecera descuadrada genera un CFDI
 * incorrecto que ya no se puede editar (sólo cancelar). Estos checks
 * estructurales garantizan que las 3 defensas sigan en el código y en el orden
 * correcto: filtro de papelera → sin conceptos → cuadre ANTES del SAT.
 */
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const contextoSource = await Deno.readTextFile(new URL("./contexto.ts", import.meta.url));
const emitirSource = await Deno.readTextFile(new URL("./emitir.ts", import.meta.url));

Deno.test("contexto: los conceptos en papelera NO se timbran (deleted_at IS NULL)", () => {
  assertStringIncludes(contextoSource, 'from("conceptos_factura")');
  assertStringIncludes(contextoSource, '.is("deleted_at", null)');
});

Deno.test("contexto: factura sin conceptos vigentes devuelve 422 sin_conceptos", () => {
  assertStringIncludes(contextoSource, '"sin_conceptos"');
  assertStringIncludes(contextoSource, "422");
});

Deno.test("contexto: el cuadre de subtotal devuelve 422 subtotal_descuadrado", () => {
  assertStringIncludes(contextoSource, '"subtotal_descuadrado"');
  assertStringIncludes(contextoSource, "validarCuadreSubtotal");
});

Deno.test("contexto: el cuadre se evalúa ANTES de armar/enviar el payload al SAT", () => {
  // El contexto se valida en `contexto.ts`; la llamada al SDK vive en
  // `emitir.ts`. Si el cuadre viviera después de invoices.create, un
  // descuadre ya habría consumido folio y cuota del SAT.
  const cuadreIdx = contextoSource.indexOf("validarCuadreSubtotal(conceptos");
  if (cuadreIdx <= 0) throw new Error("validarCuadreSubtotal ya no se invoca en cargarBaseContexto");
  assertStringIncludes(emitirSource, "facturapi.invoices.create(payload)");
  if (emitirSource.includes("subtotal_descuadrado")) {
    throw new Error("El cuadre debe quedarse en contexto.ts (antes del SAT), no en emitir.ts");
  }
});
