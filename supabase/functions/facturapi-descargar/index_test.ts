/**
 * Ola 4 · N39 — descarga de NC: nombre de archivo sin serie duplicada.
 * `folio` ya se persiste como `<serie><folio>` desde v13.213.20; concatenar
 * de nuevo `serie+folio` producía "NCNC7.pdf". `resolveFolioSerieNc` se
 * extrajo como función pura exportada para poder testearla sin mockear
 * Supabase (index.ts sólo la invoca).
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveFolioSerieNc } from "./index.ts";
import { buildFilename } from "../_shared/facturaFilename.ts";

Deno.test("resolveFolioSerieNc: usa folio directo cuando ya incluye la serie (caso normal post v13.213.20)", () => {
  assertEquals(resolveFolioSerieNc("NC", "NC7"), "NC7");
});

Deno.test("resolveFolioSerieNc: NO duplica la serie (regresión NCNC7)", () => {
  const r = resolveFolioSerieNc("NC", "NC7");
  assert(!r.includes("NCNC"), `no debe duplicar la serie, obtuvo: ${r}`);
});

Deno.test("resolveFolioSerieNc: fallback defensivo cuando folio viene vacío (filas legacy)", () => {
  assertEquals(resolveFolioSerieNc("NC", ""), "NC");
});

Deno.test("resolveFolioSerieNc: ambos vacíos -> cadena vacía", () => {
  assertEquals(resolveFolioSerieNc("", ""), "");
});

Deno.test("buildFilename + resolveFolioSerieNc: nombre final de la NC es 'NotaCredito_NC7....pdf', no 'NotaCredito_NCNC7....pdf'", () => {
  const folioSerie = resolveFolioSerieNc("NC", "NC7");
  const filename = buildFilename({
    tipo: "NotaCredito",
    folioSerie,
    cliente: "Cliente Uno",
    fecha: "2026-01-10",
    ext: "pdf",
  });
  assertStringIncludes(filename, "NC7");
  assert(!filename.includes("NCNC7"), `filename no debe duplicar la serie: ${filename}`);
});

Deno.test("index.ts: resolveFromNc usa resolveFolioSerieNc (no concatena serie+folio a ciegas)", async () => {
  const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(indexSource, "resolveFolioSerieNc(serie, folio)");
});
