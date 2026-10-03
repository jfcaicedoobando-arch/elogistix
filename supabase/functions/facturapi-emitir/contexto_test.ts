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
const cuadreSource = await Deno.readTextFile(new URL("./contextoCuadre.ts", import.meta.url));
const emitirSource = await Deno.readTextFile(new URL("./emitir.ts", import.meta.url));
const crearSource = await Deno.readTextFile(new URL("./crear.ts", import.meta.url));
const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
/** El cuadre vive en `contextoCuadre.ts` y se invoca desde `contexto.ts`. */
const contextoYCuadre = `${contextoSource}\n${cuadreSource}`;

Deno.test("contexto: los conceptos en papelera NO se timbran (deleted_at IS NULL)", () => {
  assertStringIncludes(contextoSource, 'from("conceptos_factura")');
  assertStringIncludes(contextoSource, '.is("deleted_at", null)');
});

Deno.test("contexto: factura sin conceptos vigentes devuelve 422 sin_conceptos", () => {
  assertStringIncludes(contextoSource, '"sin_conceptos"');
  assertStringIncludes(contextoSource, "422");
});

Deno.test("contexto: el cuadre de subtotal devuelve 422 subtotal_descuadrado", () => {
  assertStringIncludes(contextoYCuadre, '"subtotal_descuadrado"');
  assertStringIncludes(contextoYCuadre, "validarCuadreSubtotal");
});

Deno.test("contexto: el cuadre se evalúa ANTES de armar/enviar el payload al SAT", () => {
  // El contexto se valida en `contexto.ts`; la llamada al SDK vive en
  // `crear.ts`, invocada por `emitir.ts`. Si el cuadre viviera después de invoices.create, un
  // descuadre ya habría consumido folio y cuota del SAT.
  const cuadreIdx = contextoSource.indexOf("validarCuadreSubtotal(");
  if (cuadreIdx <= 0) throw new Error("validarCuadreSubtotal ya no se invoca en cargarBaseContexto");
  assertStringIncludes(emitirSource, "createInvoiceInFacturapi(input, payload)");
  assertStringIncludes(crearSource, "facturapi.invoices.create(payload)");
  if (emitirSource.includes("subtotal_descuadrado") || crearSource.includes("subtotal_descuadrado")) {
    throw new Error("El cuadre debe quedarse en contexto.ts (antes del SAT), no en emitir.ts/crear.ts");
  }
});

Deno.test("contexto: auth, organización y contexto válido preceden la delegación al SDK", () => {
  const pasos = [
    "supabase.auth.getUser()",
    "prepararEmision(supabase,",
    "getFacturapiClient(supabase, facturaVigente.organization_id)",
    "cargarContexto(supabase,",
    "if (context instanceof Response) return context;",
    "emitirYActualizar({",
  ];
  let anterior = -1;
  for (const paso of pasos) {
    const actual = indexSource.indexOf(paso);
    if (actual <= anterior) throw new Error(`Paso ausente o fuera de orden antes del SDK: ${paso}`);
    anterior = actual;
  }
  assertStringIncludes(indexSource, "authorizeOrgRole(supabase, user.id, factura.organization_id, ROLES_EMISOR_FISCAL)");
  assertStringIncludes(indexSource, "if (preparada instanceof Response) return preparada;");
  assertStringIncludes(contextoSource, "if (base instanceof Response) return base;");
  assertStringIncludes(contextoSource, "if (cuadre) return cuadre;");
});
