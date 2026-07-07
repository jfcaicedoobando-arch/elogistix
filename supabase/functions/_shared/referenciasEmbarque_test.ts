import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  hasReferencias,
  buildDescripcionPrefix,
  formatDescripcionConReferencias,
  buildPdfCustomSection,
} from "./referenciasEmbarque.ts";

Deno.test("hasReferencias: false cuando todo es null/vacío", () => {
  assertEquals(hasReferencias(null), false);
  assertEquals(hasReferencias(undefined), false);
  assertEquals(hasReferencias({}), false);
  assertEquals(hasReferencias({ expediente: "", bl_master: null, bl_house: "  " }), false);
});

Deno.test("hasReferencias: true con al menos un dato", () => {
  assert(hasReferencias({ expediente: "ELIMP00195" }));
  assert(hasReferencias({ bl_house: "HL2504XYZ" }));
});

Deno.test("buildDescripcionPrefix: solo expediente", () => {
  assertEquals(buildDescripcionPrefix({ expediente: "ELIMP00195" }), "[Exp. ELIMP00195] ");
});

Deno.test("buildDescripcionPrefix: expediente + master", () => {
  assertEquals(
    buildDescripcionPrefix({ expediente: "ELIMP00195", bl_master: "COSU1234" }),
    "[Exp. ELIMP00195 · BL/M: COSU1234] ",
  );
});

Deno.test("buildDescripcionPrefix: los tres campos", () => {
  assertEquals(
    buildDescripcionPrefix({ expediente: "E1", bl_master: "M1", bl_house: "H1" }),
    "[Exp. E1 · BL/M: M1 · BL/H: H1] ",
  );
});

Deno.test("buildDescripcionPrefix: cadena vacía sin datos", () => {
  assertEquals(buildDescripcionPrefix(null), "");
  assertEquals(buildDescripcionPrefix({}), "");
});

Deno.test("formatDescripcionConReferencias: sin datos deja la descripción intacta", () => {
  assertEquals(formatDescripcionConReferencias("Flete Marítimo", null), "Flete Marítimo");
});

Deno.test("formatDescripcionConReferencias: prepende prefijo", () => {
  const out = formatDescripcionConReferencias("Flete Marítimo", {
    expediente: "ELIMP00195",
    bl_house: "HL2504XYZ",
  });
  assertEquals(out, "[Exp. ELIMP00195 · BL/H: HL2504XYZ] Flete Marítimo");
});

Deno.test("formatDescripcionConReferencias: trunca cuando excede 1000 char", () => {
  const long = "A".repeat(1100);
  const out = formatDescripcionConReferencias(long, { expediente: "E1" });
  assert(out.length <= 1000);
  assert(out.startsWith("[Exp. E1] "));
  assert(out.endsWith("…"));
});

Deno.test("buildPdfCustomSection: HTML con los tres campos", () => {
  const html = buildPdfCustomSection({
    expediente: "ELIMP00195",
    bl_master: "COSU1234",
    bl_house: "HL2504XYZ",
  });
  assert(html.includes("<h4>Referencias del embarque</h4>"));
  assert(html.includes("Expediente:</strong> ELIMP00195"));
  assert(html.includes("BL Master:</strong> COSU1234"));
  assert(html.includes("BL House:</strong> HL2504XYZ"));
});

Deno.test("buildPdfCustomSection: escapa HTML peligroso", () => {
  const html = buildPdfCustomSection({ expediente: '<script>alert("x")</script>' });
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
});

Deno.test("buildPdfCustomSection: vacío sin datos", () => {
  assertEquals(buildPdfCustomSection(null), "");
  assertEquals(buildPdfCustomSection({}), "");
});
