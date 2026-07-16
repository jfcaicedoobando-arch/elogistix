/**
 * 13.116.0 — Smoke estructural + invariantes de seguridad.
 * Lógica pura ya está cubierta en `helpers_test.ts`.
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as helpers from "./helpers.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const cancelacionSource = await Deno.readTextFile(new URL("./cancelacion.ts", import.meta.url));
const terminalesSource = await Deno.readTextFile(new URL("./terminales.ts", import.meta.url));
const bundleSource = indexSource + "\n" + cancelacionSource + "\n" + terminalesSource;

Deno.test("helpers exporta la API consumida por index.ts", () => {
  assert(typeof helpers.validateCancelacionInput === "function");
  assert(typeof helpers.buildCancelQuery === "function");
  assert(helpers.MOTIVOS_VALIDOS instanceof Set);
});

Deno.test("facturapi-cancelar: requiere Authorization header (401 si falta)", () => {
  // Sin esto cualquiera podría cancelar CFDIs ajenos.
  assertStringIncludes(indexSource, 'req.headers.get("Authorization")');
  assertStringIncludes(indexSource, '"unauthorized"');
});

Deno.test("facturapi-cancelar: usa supabase.auth.getUser para validar JWT", () => {
  // Defensa en profundidad además del header presence.
  assertStringIncludes(indexSource, "supabase.auth.getUser()");
});

Deno.test("facturapi-cancelar: registra fallo en bitacora_actividad si Facturapi rechaza", () => {
  // Auditoría: cancelaciones fallidas deben quedar trazadas.
  assertStringIncludes(bundleSource, "facturapi_cancelar_failed");
  assertStringIncludes(bundleSource, "facturapi_cancelada");
});

Deno.test("facturapi-cancelar: actualiza estado=Cancelada Y registra motivo (no parcial)", () => {
  // Si sólo se cambia estado sin motivo, perdemos trazabilidad SAT.
  // Acepta el ternario `esSustitucion ? "Sustituida" : "Cancelada"` introducido en 13.137.9.
  const estadoIdx = bundleSource.search(/estado:\s*(?:(?:ctx\.)?esSustitucion\s*\?\s*"Sustituida"\s*:\s*)?"Cancelada"/);
  const motIdx = bundleSource.indexOf("cancelacion_motivo: motivo");
  const fechaIdx = bundleSource.indexOf("cancelado_en:");
  assertEquals(estadoIdx >= 0 && motIdx >= 0 && fechaIdx >= 0, true,
    "Update debe incluir estado + motivo + fecha juntos");
});


Deno.test("facturapi-cancelar: rechaza factura sin facturapi_id (409 no_timbrada)", () => {
  assertStringIncludes(indexSource, '"no_timbrada"');
});
