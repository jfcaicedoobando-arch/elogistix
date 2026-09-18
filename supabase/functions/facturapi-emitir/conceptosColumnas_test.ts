/**
 * Regresión 13.824.2 — el `.select()` de `conceptos_factura` sólo puede pedir
 * columnas que existen en esa tabla.
 *
 * Pedir `aplica_iva` (que sólo existe en `conceptos_venta` y en
 * `proforma_conceptos_consolidados`) hacía fallar la consulta con 500
 * `conceptos_query_failed` y bloqueaba el timbrado de TODAS las facturas.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const contextoSource = await Deno.readTextFile(new URL("./contexto.ts", import.meta.url));

/** Columnas reales de `public.conceptos_factura` (baseline de la base). */
const COLUMNAS_CONCEPTOS_FACTURA = new Set([
  "id",
  "factura_id",
  "organization_id",
  "concepto_venta_id",
  "descripcion",
  "cantidad",
  "unidad",
  "clave_unidad",
  "clave_prod_serv",
  "precio_unitario",
  "subtotal",
  "tipo_iva",
  "tasa_iva_aplicada",
  "iva",
  "ret_iva",
  "ret_isr",
  "ieps",
  "tasa_ieps",
  "total",
  "orden",
  "created_at",
  "deleted_at",
]);

function selectDeConceptosFactura(): string {
  const idx = contextoSource.indexOf('from("conceptos_factura")');
  if (idx < 0) throw new Error("Ya no se lee conceptos_factura en contexto.ts");
  const trozo = contextoSource.slice(idx, idx + 1200);
  const m = trozo.match(/\.select\(\s*"([^"]+)"/) ?? trozo.match(/\.select\(\s*`([^`]+)`/);
  if (!m) throw new Error("No se encontró el .select() de conceptos_factura");
  return m[1];
}

Deno.test("contexto: el select de conceptos_factura no pide columnas inexistentes", () => {
  const columnas = selectDeConceptosFactura()
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const inexistentes = columnas.filter((c) => !COLUMNAS_CONCEPTOS_FACTURA.has(c));
  assertEquals(inexistentes, [], `Columnas inexistentes en conceptos_factura: ${inexistentes.join(", ")}`);
});

Deno.test("contexto: aplica_iva NO se lee de conceptos_factura", () => {
  const select = selectDeConceptosFactura();
  if (select.includes("aplica_iva")) {
    throw new Error("conceptos_factura no tiene aplica_iva: el select rompe el timbrado completo");
  }
  // La nota queda documentada para que nadie lo vuelva a agregar.
  assertStringIncludes(contextoSource, "aplica_iva");
});
