/**
 * Guardrail Fase R.7 (Bug menor B): `eliminar_embarque_completo` debe bloquear
 * la eliminación cuando existen proformas en cualquier estado vivo, incluyendo
 * `borrador`. Antes sólo contaba `estado_proforma = 'pendiente'` con
 * `estado_aprobacion <> 'borrador'`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

/** Sólo la definición vigente y su cuerpo dollar-quoted, sin funciones vecinas. */
function findLatestBody(fn: string): string {
  const inicio = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${fn.replaceAll(".", "\\.")}\\s*\\(`,
    "gi",
  );
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort().reverse()) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    const definitions: string[] = [];
    for (const match of sql.matchAll(inicio)) {
      const start = match.index;
      const tag = /AS\s+(\$[A-Za-z_]*\$)/.exec(sql.slice(start));
      if (!tag) continue;
      const open = start + tag.index + tag[0].length;
      const close = sql.indexOf(tag[1], open);
      if (close !== -1) definitions.push(sql.slice(start, close + tag[1].length));
    }
    if (definitions.length > 0) return definitions[definitions.length - 1];
  }
  throw new Error(`No se encontró FUNCTION ${fn}`);
}

describe("eliminar_embarque_completo bloquea proformas en borrador", () => {
  const rpc = findLatestBody("public.eliminar_embarque_completo");
  const collector = findLatestBody("public._h14_dependencias_baja_embarque");

  it("delega al recolector vigente que incluye borradores y excluye canceladas y facturadas", () => {
    expect(rpc).toMatch(
      /v_motivos\s*:=\s*public\._h14_dependencias_baja_embarque\(p_embarque_id,\s*v_org,/,
    );
    expect(rpc).toMatch(/IF \(v_motivos->>'bloqueado'\)::boolean IS TRUE THEN/);
    expect(collector).toMatch(/public\._h14_proformas_baja_embarque\(p_embarque_id,\s*p_org\)/);
    expect(collector).toMatch(
      /FROM public\.proformas p, proforma_ids ids[\s\S]{0,240}p\.deleted_at IS NULL\s+AND COALESCE\(p\.estado_proforma, 'pendiente'\) NOT IN \('cancelada', 'facturada'\)/,
    );
    expect(collector).not.toMatch(/estado_aprobacion/);
  });
});
