import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildExpresionImpresa,
  esExpresionInvalida,
  formatTotalSat,
  variantesAIntentar,
} from "./expresion.ts";

Deno.test("formatTotalSat omite ceros no significativos", () => {
  assertEquals(formatTotalSat(371.2), "371.2");
  assertEquals(formatTotalSat(0.99), "0.99");
  assertEquals(formatTotalSat(1), "1.0");
  assertEquals(formatTotalSat(0), "0.0");
  assertEquals(formatTotalSat(1234.567891), "1234.567891");
});

Deno.test("expresión con RFC normal usa separadores &amp;", () => {
  const expr = buildExpresionImpresa({
    rfcEmisor: "TIE830322QV7",
    rfcReceptor: "ESH2311092R7",
    total: 295.8,
    uuid: "A1C9D38F-32E4-4B57-B88A-272D87BD883E",
  });
  assertEquals(
    expr,
    "?re=TIE830322QV7&amp;rr=ESH2311092R7&amp;tt=295.8&amp;id=A1C9D38F-32E4-4B57-B88A-272D87BD883E",
  );
});

Deno.test("variante '&' deja el ampersand del RFC escapado una sola vez", () => {
  const expr = buildExpresionImpresa(
    { rfcEmisor: "AL&0807074L5", rfcReceptor: "ESH2311092R7", total: 371.2, uuid: "U" },
    "&",
  );
  assertStringIncludes(expr, "?re=AL&amp;0807074L5&amp;rr=");
});

Deno.test("variante '&amp;' hace doble escape del ampersand del RFC", () => {
  const expr = buildExpresionImpresa(
    { rfcEmisor: "AL&0807074L5", rfcReceptor: "ESH2311092R7", total: 371.2, uuid: "U" },
    "&amp;",
  );
  assertStringIncludes(expr, "?re=AL&amp;amp;0807074L5&amp;rr=");
});

Deno.test("variante '%26' percent-encodea el ampersand del RFC", () => {
  const expr = buildExpresionImpresa(
    { rfcEmisor: "AL&0807074L5", rfcReceptor: "ESH2311092R7", total: 371.2, uuid: "U" },
    "%26",
  );
  assertStringIncludes(expr, "?re=AL%260807074L5&amp;rr=");
});

Deno.test("sólo se reintenta cuando hay ampersand en algún RFC", () => {
  assertEquals(variantesAIntentar("TIE830322QV7", "ESH2311092R7"), ["&"]);
  assertEquals(variantesAIntentar("AL&0807074L5", "ESH2311092R7"), ["&", "&amp;", "%26"]);
  assertEquals(variantesAIntentar("TIE830322QV7", "A&B010101AAA"), ["&", "&amp;", "%26"]);
});

Deno.test("esExpresionInvalida detecta el código 601", () => {
  assertEquals(
    esExpresionInvalida("N - 601", "La expresión impresa proporcionada no es válida"),
    true,
  );
  assertEquals(esExpresionInvalida("S", "Vigente"), false);
  assertEquals(esExpresionInvalida("N - 202", "No Encontrado"), false);
});
