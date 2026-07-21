/**
 * Deno tests para `_shared/facturaFilename.ts`.
 *
 * Run: deno test supabase/functions/_shared/facturaFilename_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFilename, slugifyForFilename, toFechaYmd } from "./facturaFilename.ts";

Deno.test("slugifyForFilename: quita acentos y caracteres no seguros", () => {
  assertEquals(slugifyForFilename("Clíente Ácmé, S.A. de C.V."), "Cliente_Acme_S_A_de_C_V");
});

Deno.test("slugifyForFilename: cadena vacía o nula → ''", () => {
  assertEquals(slugifyForFilename(""), "");
  assertEquals(slugifyForFilename(null), "");
  assertEquals(slugifyForFilename(undefined), "");
});

Deno.test("slugifyForFilename: recorta a 40 chars", () => {
  const input = "A".repeat(60);
  assertEquals(slugifyForFilename(input).length, 40);
});

Deno.test("toFechaYmd: ISO válido → YYYY-MM-DD UTC", () => {
  assertEquals(toFechaYmd("2026-07-21T10:30:00-06:00"), "2026-07-21");
});

Deno.test("toFechaYmd: null/inválido → ''", () => {
  assertEquals(toFechaYmd(null), "");
  assertEquals(toFechaYmd("not-a-date"), "");
});

Deno.test("buildFilename: caso completo Factura", () => {
  assertEquals(
    buildFilename({ tipo: "Factura", folioSerie: "F971", cliente: "Cliente Acme", fecha: "2026-07-21", ext: "pdf" }),
    "Factura_F971_Cliente_Acme_2026-07-21.pdf",
  );
});

Deno.test("buildFilename: sin cliente omite segmento sin doble _", () => {
  assertEquals(
    buildFilename({ tipo: "REP", folioSerie: "A5", cliente: null, fecha: "2026-07-21", ext: "xml" }),
    "REP_A5_2026-07-21.xml",
  );
});

Deno.test("buildFilename: sin folio ni fecha", () => {
  assertEquals(
    buildFilename({ tipo: "NotaCredito", folioSerie: "", cliente: "Cliente", fecha: null, ext: "pdf" }),
    "NotaCredito_Cliente.pdf",
  );
});

Deno.test("buildFilename: todo vacío → sólo tipo", () => {
  assertEquals(
    buildFilename({ tipo: "Factura", folioSerie: null, cliente: null, fecha: null, ext: "pdf" }),
    "Factura.pdf",
  );
});
