/**
 * Guardrail v13.307.14 — Liberación del folio interno de facturas de proveedor
 * al hacer soft-delete de la última factura activa.
 *
 * Blinda que la migración incluya el trigger `trg_liberar_folio_proveedor_factura`
 * y la función que baja `folio_secuencias.ultimo_numero` al MAX de folios vivos
 * SÓLO cuando no queden folios activos mayores (reusar sólo si borraste la última).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function readLatestContaining(marker: string): string {
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
    if (body.includes(marker)) return body;
  }
  throw new Error(`No se encontró migración con marker: ${marker}`);
}

describe("Folio interno CxP — liberación al soft-delete (v13.307.14)", () => {
  // Buscar la migración que define la función (no meras referencias en comentarios/GRANTs).
  const sql = readLatestContaining("CREATE OR REPLACE FUNCTION public.tg_liberar_folio_proveedor_factura");

  it("define la función como SECURITY DEFINER con search_path fijo", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.tg_liberar_folio_proveedor_factura[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path TO 'public'/,
    );
  });

  it("sólo se activa cuando deleted_at pasa de NULL a un valor", () => {
    expect(sql).toMatch(/IF NEW\.deleted_at IS NULL OR OLD\.deleted_at IS NOT NULL THEN[\s\S]*?RETURN NEW;/);
  });

  it("calcula MAX de folios vivos filtrando por deleted_at IS NULL", () => {
    expect(sql).toMatch(/FROM public\.proveedor_facturas[\s\S]*?deleted_at IS NULL/);
  });

  it("nunca decrementa por debajo del MAX vivo (reusar sólo si borraste la última)", () => {
    expect(sql).toMatch(/ultimo_numero\s*>\s*v_max_vivo/);
  });

  it("registra el trigger AFTER UPDATE OF deleted_at con guard DISTINCT FROM", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_liberar_folio_proveedor_factura[\s\S]*?AFTER UPDATE OF deleted_at[\s\S]*?OLD\.deleted_at IS DISTINCT FROM NEW\.deleted_at/,
    );
  });
});
