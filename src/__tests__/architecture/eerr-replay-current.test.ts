import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const normalize = (sql: string) => sql.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").trim();
function definition(sql: string) {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.eerr_resumen_anual(");
  const end = sql.indexOf("$function$;", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end + "$function$;".length);
}

describe("EERR · materialización de los parches vigentes", () => {
  const canonical = read("supabase/schema/facturacion/eerr_resumen_anual.sql");
  const migration = read("supabase/migrations/20261003010000_eerr_resumen_anual_replay.sql");

  it("preserva exactamente AUD-ANALISIS-7/8 y el ALTER SECURITY DEFINER", () => {
    const previous = definition(read("supabase/migrations/20260904000200_ola2_v14_org_scope_kpis.sql"));
    const patch = read("supabase/migrations/20261001205003_4763ef1c-2703-4593-ae2d-da547908e3bc.sql");
    const section = patch.slice(patch.indexOf("-- eerr_resumen_anual, fuente por embarque"));
    const replacement = section.match(/\$r\$([\s\S]*?)\$r\$/)?.[1];
    expect(replacement).toBeTruthy();
    const effective = previous
      .replace("AND ncf.estado = 'Aplicada'", "AND ncf.estado IN ('Timbrada','Aplicada')")
      .replace(/ing AS \([\s\S]*?GROUP BY em\.mes\s*\),/, replacement!)
      .replace(/\bSTABLE\b/, "STABLE SECURITY DEFINER");
    expect(normalize(definition(migration))).toBe(normalize(effective));
    expect(normalize(canonical)).toBe(normalize(migration));
  });

  it("no vuelve a ventas cotizadas ni cambia el ciclo de NC de proveedor", () => {
    expect(migration).not.toContain("public.conceptos_venta");
    expect(migration).toContain("public._venta_facturada_por_embarque(v_org)");
    expect(migration).toContain("AND n.estado = 'Aplicada'");
    expect(migration).toContain("ncf.estado IN ('Timbrada','Aplicada')");
    expect(migration).toContain("WHERE f.id = ncf.factura_id AND f.deleted_at IS NULL");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.eerr_resumen_anual(integer, text) FROM anon");
  });
});
