/**
 * Baseline v13.301.71 (Fase C): tras el backfill único, no debe haber
 * proformas históricas marcadas como `facturada` sin una factura viva
 * (o consolidación) que las respalde. Si este test empieza a fallar,
 * hay una regresión en Fase A (consolidar_proformas), Fase B
 * (revertir_proforma_al_cancelar_sustitucion) o Fase C
 * (eliminar_factura_borrador).
 *
 * El test es un smoke test que verifica que la migración de Fase C
 * incluye el backfill; NO consulta la BD en runtime (los tests no
 * tienen credenciales de prod).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

describe("Fase C — backfill de proformas huérfanas", () => {
  const files = readdirSync(MIGRATIONS_DIR).sort();
  const migrations = files.map((f) =>
    readFileSync(resolve(MIGRATIONS_DIR, f), "utf8"),
  );

  it("existe una migración con backfill sobre proformas 'facturada' huérfanas", () => {
    const conBackfill = migrations.some(
      (m) =>
        /UPDATE\s+public\.proformas[\s\S]{0,400}estado_proforma\s*=\s*'pendiente'/i.test(
          m,
        ) &&
        /estado_proforma\s*=\s*'facturada'/i.test(m) &&
        /estado_revision\s+IS\s+DISTINCT\s+FROM\s+'consolidada'/i.test(m),
    );
    expect(conBackfill).toBe(true);
  });

  it("el backfill excluye facturas vivas (Cancelada/Sustituida)", () => {
    const excluye = migrations.some(
      (m) =>
        /UPDATE\s+public\.proformas[\s\S]{0,800}NOT\s+IN\s*\(\s*'Cancelada'[\s\S]{0,60}'Sustituida'/i.test(
          m,
        ),
    );
    expect(excluye).toBe(true);
  });
});
