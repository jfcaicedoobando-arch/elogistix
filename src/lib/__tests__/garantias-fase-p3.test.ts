/**
 * Guardrail Fase P.3 (v13.301.89) — Materialización de retenciones de garantía.
 *
 * Blinda que la migración P.3 incluya:
 *  - RPC `materializar_factura_retencion_garantia` SECURITY DEFINER con
 *    `search_path=public`, cascada de roles, y los 5 códigos de error clave.
 *  - Trigger AFTER UPDATE `trg_garantia_auto_materializar` con manejo de
 *    excepciones que nunca bloquea el UPDATE del estado.
 *  - `REVOKE PUBLIC/anon` + `GRANT EXECUTE` restringido a authenticated y
 *    service_role.
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

describe("Fase P.3 — Retención de garantía → factura CxP (v13.301.89)", () => {
  const sql = readLatestContaining("materializar_factura_retencion_garantia");

  it("expone la RPC como SECURITY DEFINER con search_path fijo a public", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.materializar_factura_retencion_garantia[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public/,
    );
  });

  it("valida cascada de roles admin/admin_org/operador/super_admin", () => {
    const lower = sql.toLowerCase();
    expect(lower).toContain("has_role(v_uid, 'admin')");
    expect(lower).toContain("'admin_org'");
    expect(lower).toContain("'operador'");
    expect(lower).toContain("'super_admin'");
    expect(lower).toContain("lc_garantia_sin_rol");
  });

  it("levanta LC_GARANTIA_NO_RETENIDA cuando el estado no es 'retenido'", () => {
    expect(sql.toLowerCase()).toContain("lc_garantia_no_retenida");
  });

  it("bloquea materializar dos veces con LC_GARANTIA_FACTURA_YA_MATERIALIZADA", () => {
    expect(sql.toLowerCase()).toContain("lc_garantia_factura_ya_materializada");
  });

  it("exige naviera y proveedor mapeado por nombre en la organización", () => {
    expect(sql.toLowerCase()).toContain("lc_garantia_sin_naviera");
    expect(sql.toLowerCase()).toContain("lc_garantia_sin_proveedor_naviera");
    expect(sql).toMatch(/lower\(nombre\)\s*=\s*lower\(v_naviera_nombre\)/);
  });

  it("resuelve categoría de presupuesto (COGS con fallback) o falla explícito", () => {
    expect(sql.toLowerCase()).toContain("lc_garantia_sin_categoria_presupuesto");
    expect(sql).toMatch(/presupuesto_categorias/);
  });

  it("inserta proveedor_facturas en Borrador con folio interno y vincula a la garantía", () => {
    expect(sql).toMatch(/INSERT INTO public\.proveedor_facturas/);
    expect(sql).toMatch(/siguiente_folio_proveedor/);
    expect(sql).toMatch(/UPDATE public\.embarque_garantias_contenedor[\s\S]*?proveedor_factura_id/);
  });

  it("crea trigger AFTER UPDATE OF estado que auto-materializa hacia 'retenido'", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_garantia_auto_materializar[\s\S]*?AFTER UPDATE OF estado[\s\S]*?embarque_garantias_contenedor/,
    );
    expect(sql).toMatch(/EXCEPTION WHEN OTHERS/);
    expect(sql.toLowerCase()).toContain("pendiente");
  });

  it("mantiene REVOKE PUBLIC/anon y GRANT sólo a authenticated y service_role", () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.materializar_factura_retencion_garantia\(uuid\)[\s\S]*?FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.materializar_factura_retencion_garantia\(uuid\)[\s\S]*?FROM anon/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.materializar_factura_retencion_garantia\(uuid\)[\s\S]*?authenticated[\s\S]*?service_role/,
    );
  });
});
