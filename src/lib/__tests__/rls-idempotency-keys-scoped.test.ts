/**
 * Guardrail: las policies RLS de `idempotency_keys` deben estar
 * scopeadas por organización. Este test verifica el snapshot SQL de
 * la migración de remediación (v13.301.55) para asegurar que las 3
 * policies (SELECT/INSERT/UPDATE) mencionan `organization_id` y
 * `current_user_org_id`, previniendo una regresión que colapse la
 * corrección del hallazgo H1 de la auditoría multi-tenant.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigrationsContainingIdempotency(): string {
  let bundle = "";
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    if (!file.endsWith(".sql")) continue;
    const contents = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    if (/idempotency_keys/i.test(contents)) bundle += `\n-- ${file}\n${contents}`;
  }
  return bundle;
}

describe("RLS · idempotency_keys scopeada por organización", () => {
  const bundle = readMigrationsContainingIdempotency();

  it("existe al menos una policy SELECT con organization_id + current_user_org_id", () => {
    const hasSelect =
      /CREATE POLICY[^;]*idempotency_keys[^;]*FOR SELECT[^;]*organization_id\s*=\s*public\.current_user_org_id\(\)/is.test(
        bundle,
      );
    expect(hasSelect).toBe(true);
  });

  it("existe una policy INSERT con WITH CHECK scopeado por organización", () => {
    const hasInsert =
      /CREATE POLICY[^;]*idempotency_keys[^;]*FOR INSERT[^;]*WITH CHECK[^;]*organization_id\s*=\s*public\.current_user_org_id\(\)/is.test(
        bundle,
      );
    expect(hasInsert).toBe(true);
  });

  it("existe una policy UPDATE (USING + WITH CHECK) scopeada por organización", () => {
    const hasUpdate =
      /CREATE POLICY[^;]*idempotency_keys[^;]*FOR UPDATE[^;]*organization_id\s*=\s*public\.current_user_org_id\(\)[^;]*WITH CHECK[^;]*organization_id\s*=\s*public\.current_user_org_id\(\)/is.test(
        bundle,
      );
    expect(hasUpdate).toBe(true);
  });
});
