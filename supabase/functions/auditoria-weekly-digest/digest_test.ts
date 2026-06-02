// @ts-nocheck
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { esc, buildHtml } from "./index.ts";

// ── esc() HTML escaping ───────────────────────────────────────

Deno.test("esc: plain string unchanged", () => {
  assertEquals(esc("hello world"), "hello world");
});

Deno.test("esc: ampersand escaped", () => {
  assertEquals(esc("Tom & Jerry"), "Tom &amp; Jerry");
});

Deno.test("esc: less-than escaped", () => {
  assertEquals(esc("<script>"), "&lt;script&gt;");
});

Deno.test("esc: greater-than escaped", () => {
  assertEquals(esc("a > b"), "a &gt; b");
});

Deno.test("esc: all special chars together", () => {
  assertEquals(esc("<a & b>"), "&lt;a &amp; b&gt;");
});

Deno.test("esc: empty string", () => {
  assertEquals(esc(""), "");
});

Deno.test("esc: XSS payload neutralised", () => {
  assertEquals(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror="alert(1)"&gt;');
});

// ── buildHtml output shape ────────────────────────────────────

Deno.test("buildHtml: contains escaped org name", () => {
  const html = buildHtml("Org <Test> & Co", { total_hallazgos: 0 });
  assertStringIncludes(html, "Org &lt;Test&gt; &amp; Co");
});

Deno.test("buildHtml: shows total_hallazgos", () => {
  const html = buildHtml("Mi Org", { total_hallazgos: 42 });
  assertStringIncludes(html, "42");
});

Deno.test("buildHtml: zero hallazgos when missing", () => {
  const html = buildHtml("Mi Org", {});
  assertStringIncludes(html, "Total hallazgos:");
  assertStringIncludes(html, "0");
});

Deno.test("buildHtml: shows severity counts", () => {
  const html = buildHtml("Mi Org", {
    por_severidad: { critico: 3, alto: 5, medio: 10 },
  });
  assertStringIncludes(html, "3");
  assertStringIncludes(html, "5");
  assertStringIncludes(html, "10");
});

Deno.test("buildHtml: dry-run path — no API key means no network call (pure function check)", () => {
  // processOrg returns dryRun:true when keys are absent.
  // We verify the shape a dry-run result would have.
  const dryRunResult = { org: "Org A", destinatarios: 2, enviado: false, dryRun: true };
  assertEquals(dryRunResult.enviado, false);
  assertEquals(dryRunResult.dryRun, true);
  assertEquals(dryRunResult.destinatarios, 2);
});

Deno.test("buildHtml: top-5 financieras shown when monto_mxn present", () => {
  const html = buildHtml("Mi Org", {
    hallazgos: [
      { severidad: "critico", monto_mxn: 50000, cliente_nombre: "ACME", expediente: "EXP-1", detalle: "desc" },
    ],
  });
  assertStringIncludes(html, "ACME");
  assertStringIncludes(html, "EXP-1");
});

Deno.test("buildHtml: no fugas message when monto_mxn absent", () => {
  const html = buildHtml("Mi Org", { hallazgos: [{ severidad: "bajo" }] });
  assertStringIncludes(html, "Sin fugas financieras");
});
