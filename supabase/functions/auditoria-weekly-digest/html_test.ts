// @ts-nocheck — Deno runtime
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { esc, buildHtml } from "./index.ts";

Deno.test("esc: escapa < > &", () => {
  assertEquals(esc("a & <b> \"x\""), "a &amp; &lt;b&gt; \"x\"");
});

Deno.test("buildHtml: total y severidades", () => {
  const html = buildHtml("ACME", {
    total_hallazgos: 5,
    por_severidad: { critico: 2, alto: 1, medio: 2 },
    hallazgos: [],
  });
  assert(html.includes("Total hallazgos:</strong> 5"));
  assert(html.includes(">2</strong> críticos"));
  assert(html.includes("Sin fugas financieras"));
});

Deno.test("buildHtml: top 5 ordenado por monto desc", () => {
  const html = buildHtml("ACME", {
    hallazgos: [
      { severidad: "alto", monto_mxn: 100, cliente_nombre: "Bajo", detalle: "x", expediente: "E1" },
      { severidad: "alto", monto_mxn: 500, cliente_nombre: "Alto", detalle: "y", expediente: "E2" },
    ],
  });
  const idxAlto = html.indexOf("Alto");
  const idxBajo = html.indexOf("Bajo");
  assert(idxAlto > 0 && idxAlto < idxBajo);
});

Deno.test("buildHtml: filtra montos null/0", () => {
  const html = buildHtml("ACME", {
    hallazgos: [{ severidad: "medio", monto_mxn: 0, cliente_nombre: "X" }],
  });
  assert(html.includes("Sin fugas financieras"));
});

Deno.test("buildHtml: escapa nombre de organización", () => {
  const html = buildHtml("<ACME>", { total_hallazgos: 0 });
  assert(html.includes("&lt;ACME&gt;"));
});
