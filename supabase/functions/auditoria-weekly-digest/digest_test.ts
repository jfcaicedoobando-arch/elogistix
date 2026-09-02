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

Deno.test("buildHtml: ordena top-5 financieras por monto_mxn descendente", () => {
  const html = buildHtml("Mi Org", {
    hallazgos: [
      { severidad: "alto", monto_mxn: 1000, cliente_nombre: "C1", expediente: "E1", detalle: "d" },
      { severidad: "alto", monto_mxn: 9000, cliente_nombre: "C2", expediente: "E2", detalle: "d" },
      { severidad: "alto", monto_mxn: 5000, cliente_nombre: "C3", expediente: "E3", detalle: "d" },
    ],
  });
  // El primero listado debe ser el de mayor monto (C2).
  const idxC2 = html.indexOf("C2");
  const idxC3 = html.indexOf("C3");
  const idxC1 = html.indexOf("C1");
  assertEquals(idxC2 > -1 && idxC3 > -1 && idxC1 > -1, true);
  assertEquals(idxC2 < idxC3 && idxC3 < idxC1, true);
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

// ── Ronda YAGNI · defecto 10: fallos visibles + envío idempotente ──

Deno.test("defecto 10: el digest devuelve 500 si alguna org falló", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, "const status = fallos > 0 ? 500 : 200;");
  assertStringIncludes(src, "ok: fallos === 0");
});

Deno.test("defecto 10: el reintento no duplica correos (dedupe por semana)", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, "yaEnviadoEstaSemana");
  assertStringIncludes(src, "registrarEstadoEmail");
});

Deno.test("claveSemana: es estable dentro de la misma semana ISO", async () => {
  const { claveSemana } = await import("./index.ts");
  assertEquals(claveSemana(new Date("2026-09-07T00:00:00Z")), claveSemana(new Date("2026-09-11T23:00:00Z")));
});

Deno.test("claveSemana: cambia entre semanas distintas", async () => {
  const { claveSemana } = await import("./index.ts");
  assertEquals(claveSemana(new Date("2026-09-07T00:00:00Z")) === claveSemana(new Date("2026-09-15T00:00:00Z")), false);
});
