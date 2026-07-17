/**
 * Guardrail: ninguna migración nueva debe reintroducir el patrón
 * `DEFAULT '00000000-0000-0000-0000-000000000001'` en columnas
 * `organization_id`. Ese default hardcodeado apareció en la migración
 * histórica `20260326215454...sql` y ya fue sobrescrito por
 * `current_user_org_id()`. Este test evita que se copie/pegue como
 * plantilla en tablas nuevas — cualquier default de org debe usar la
 * función `current_user_org_id()` en su lugar.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const HARDCODED = /DEFAULT\s+'00000000-0000-0000-0000-000000000001'/i;

// Migraciones históricas que introdujeron el patrón antes del blindaje.
// Ya fueron sobrescritas el mismo día; se listan aquí sólo para que el
// test siga verde. NO añadir migraciones nuevas a este set.
const HISTORICAL_ALLOWLIST: ReadonlySet<string> = new Set([
  "20260326215454_efd12f32-9b8a-4b3c-9ae5-6e73e7d2a0f1.sql",
]);

describe("Arquitectura — organization_id sin default hardcodeado", () => {
  it("ninguna migración fuera de la allowlist histórica usa DEFAULT '000...0001'", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(MIGRATIONS_DIR)) {
      if (!file.endsWith(".sql")) continue;
      if (HISTORICAL_ALLOWLIST.has(file)) continue;
      const contents = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      if (HARDCODED.test(contents)) offenders.push(file);
    }
    expect(
      offenders,
      `Migraciones con UUID hardcodeado como default de organization_id. Usar current_user_org_id() en su lugar:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
