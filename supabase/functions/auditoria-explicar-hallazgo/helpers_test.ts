// @ts-nocheck
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatDocumentos,
  buildUserPrompt,
  mapGatewayStatus,
  type ContextoEmbarque,
} from "./helpers.ts";

// ── formatDocumentos ───────────────────────────────────────────

Deno.test("formatDocumentos: lista vacía → guión", () => {
  assertEquals(formatDocumentos([]), "—");
});

Deno.test("formatDocumentos: documento único con archivo", () => {
  const out = formatDocumentos([{ nombre: "BL", estado: "Recibido", tiene_archivo: true }]);
  assertEquals(out, "- BL: Recibido (con archivo)");
});

Deno.test("formatDocumentos: documento único sin archivo", () => {
  const out = formatDocumentos([{ nombre: "BL", estado: "Pendiente", tiene_archivo: false }]);
  assertEquals(out, "- BL: Pendiente");
});

Deno.test("formatDocumentos: detecta duplicados y los marca explícitamente", () => {
  const out = formatDocumentos([
    { nombre: "Certificado de Origen", estado: "Pendiente", tiene_archivo: false },
    { nombre: "Certificado de Origen", estado: "No aplica", tiene_archivo: false },
    { nombre: "BL", estado: "Recibido", tiene_archivo: true },
  ]);
  assertStringIncludes(out, "DUPLICADO (2 filas)");
  assertStringIncludes(out, "Pendiente");
  assertStringIncludes(out, "No aplica");
  assertStringIncludes(out, "- BL: Recibido (con archivo)");
});

// ── buildUserPrompt ────────────────────────────────────────────

const ctxBase: ContextoEmbarque = {
  expediente: "LC-0001",
  estado: "en_transito",
  modo: "maritimo",
  cliente: "Acme",
  etd: "2026-06-01",
  eta: "2026-06-20",
  fecha_llegada_real: null,
  conceptos_venta_total: 5,
  conceptos_venta_pendientes: 2,
  conceptos_venta_facturados: 3,
  conceptos_costo_total: 4,
  facturas: [{ folio: "F-100", estado: "emitida", total: 1234.5, moneda: "MXN" }],
  proformas: [{ folio: "P-1", estado: "aprobada" }],
  documentos: [{ nombre: "BL", estado: "Recibido", tiene_archivo: true }],
};

Deno.test("buildUserPrompt: contexto null → string vacío", () => {
  assertEquals(buildUserPrompt("docs_faltantes", "x", null), "");
});

Deno.test("buildUserPrompt: incluye regla, detalle y campos clave", () => {
  const out = buildUserPrompt("margen_negativo", "Margen -15%", ctxBase);
  assertStringIncludes(out, "Regla: margen_negativo");
  assertStringIncludes(out, "Detalle: Margen -15%");
  assertStringIncludes(out, "Expediente: LC-0001");
  assertStringIncludes(out, "Cliente: Acme");
  assertStringIncludes(out, "F-100 [emitida] 1234.5 MXN");
  assertStringIncludes(out, "P-1 [aprobada]");
  assertStringIncludes(out, "- BL: Recibido (con archivo)");
});

Deno.test("buildUserPrompt: campos nulos se reemplazan por guión", () => {
  const out = buildUserPrompt("fechas", "ETA pasada", { ...ctxBase, eta: null, etd: null });
  assertStringIncludes(out, "ETD: — | ETA: —");
});

Deno.test("buildUserPrompt: facturas/proformas vacías muestran guión", () => {
  const out = buildUserPrompt("ventas_sin_facturar", "x", {
    ...ctxBase,
    facturas: [],
    proformas: [],
  });
  assertStringIncludes(out, "Facturas (0): —");
  assertStringIncludes(out, "Proformas (0): —");
});

// ── mapGatewayStatus ───────────────────────────────────────────

Deno.test("mapGatewayStatus: 429 → rate limit message", () => {
  const r = mapGatewayStatus(429);
  assertEquals(r.status, 429);
  assertStringIncludes(r.message, "Límite");
});

Deno.test("mapGatewayStatus: 402 → créditos insuficientes", () => {
  const r = mapGatewayStatus(402);
  assertEquals(r.status, 402);
  assertStringIncludes(r.message, "Créditos");
});

Deno.test("mapGatewayStatus: otros → 500 genérico", () => {
  assertEquals(mapGatewayStatus(500).status, 500);
  assertEquals(mapGatewayStatus(503).status, 500);
  assertEquals(mapGatewayStatus(418).status, 500);
});
