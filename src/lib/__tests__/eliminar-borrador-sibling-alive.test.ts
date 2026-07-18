/**
 * Guardrail v13.301.71 (Fase C, Bug 3 + H7): la RPC
 * `eliminar_factura_borrador` debe (a) resolver proformas vía
 * `conceptos_factura.proforma_id_origen` — NO vía `bitacora_actividad` — y
 * (b) sólo revertir una proforma a `pendiente` si no existe otra factura
 * viva consumiéndola (sibling-alive check).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function findLatestEliminarBorradorBody(): string {
  const files = readdirSync(MIGRATIONS_DIR).sort();
  let latest = "";
  for (const f of files) {
    const body = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
    if (/FUNCTION\s+public\.eliminar_factura_borrador\b/i.test(body)) {
      latest = body;
    }
  }
  return latest;
}

function extractFunctionBody(migration: string): string {
  // Extraemos sólo el cuerpo de la función más reciente, sin comentarios
  // arriba/abajo, para que los asserts de "NO referencia a X" no se
  // confundan con notas humanas del archivo.
  const match = migration.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.eliminar_factura_borrador[\s\S]*?\$function\$[\s\S]*?\$function\$/i,
  );
  return match ? match[0] : "";
}

describe("eliminar_factura_borrador — Fase C (Bug 3 + H7)", () => {
  const migration = findLatestEliminarBorradorBody();
  const body = extractFunctionBody(migration);

  it("existe al menos una migración que redefine eliminar_factura_borrador", () => {
    expect(body.length).toBeGreaterThan(0);
  });

  it("lee conceptos_factura.proforma_id_origen (fuente autoritativa)", () => {
    expect(body).toMatch(/conceptos_factura[\s\S]{0,300}proforma_id_origen/i);
  });

  it("NO usa bitacora_actividad como fuente de proformas (H7)", () => {
    // El cuerpo de la función no debe leer bitacora_actividad. Escrituras
    // (INSERT INTO bitacora_actividad ...) al final del flujo sí son válidas.
    const lecturas = body.match(/FROM\s+public\.bitacora_actividad/gi);
    expect(lecturas).toBeNull();
  });

  it("aplica sibling-alive check contra facturas vivas distintas al borrador", () => {
    // Debe filtrar por estado vivo y excluir la propia factura eliminada.
    expect(body).toMatch(
      /NOT\s+IN\s*\(\s*'Cancelada'[\s\S]{0,60}'Sustituida'/i,
    );
    expect(body).toMatch(/f\.id\s*<>\s*p_factura_id/i);
  });

  it("registra proformas revertidas y conservadas por sibling en bitácora", () => {
    expect(body).toMatch(/proformas_revertidas/);
    expect(body).toMatch(/proformas_conservadas_por_sibling/);
  });
});
