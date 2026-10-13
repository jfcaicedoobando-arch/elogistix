// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const migration = "20261013040000_global_catalog_permission_hardening.sql";
const body = read(`supabase/migrations/${migration}`);
const statements = body.replace(/^--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean);

describe("reviewed global catalog permission package", () => {
  it("pins the reviewed portable payload and only its four restrictive statements", () => {
    expect(hash(body)).toBe("da199ffb6b8b7685cf352eb279818b562a078e4aa01d16dee7757cf641e1e93a");
    expect(statements).toHaveLength(4);
    expect(statements.filter(s => s.startsWith("REVOKE"))).toHaveLength(3);
    expect(statements[3]).toBe('ALTER POLICY "Authenticated read planes" ON public.planes\n  USING (activo IS TRUE)');
    expect(statements.join(";")).not.toMatch(/\b(GRANT|CREATE|DROP|INSERT INTO|UPDATE SET|DELETE FROM|BEGIN|COMMIT)\b/);
  });
  it("asserts real restrictive grants before the CI harness can mask missing DDL", () => {
    const post = read("supabase/tests/rls/_ci_post_migrate.sql");
    const check = "\\ir _ci_check_global_catalog_acl.sql";
    const broadGrant = "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;";
    const reclose = "REVOKE INSERT, UPDATE, DELETE ON public.tipos_cambio_dof FROM authenticated;";
    expect(post.indexOf(check)).toBeLessThan(post.indexOf(broadGrant));
    expect(post.indexOf(reclose)).toBeGreaterThan(post.indexOf(broadGrant));
    expect(post.lastIndexOf(check)).toBeGreaterThan(post.indexOf(reclose));
  });
  it("routes both SQL tests into the existing automatic lanes", () => {
    expect(read("supabase/tests/_guards_manifest.txt").split(/\r?\n/))
      .toContain("supabase/tests/global_catalog_acl.sql");
    const suite = read("supabase/tests/rls/test_rls_global_catalog_permissions.sql");
    expect(suite).toMatch(/^BEGIN;/m);
    expect(suite.trimEnd()).toMatch(/ROLLBACK;$/);
    expect(suite).not.toMatch(/^COMMIT;/m);
    const support = JSON.parse(read("scripts/ci/test-catalog/sql-support.json"));
    expect(support["supabase/tests/rls/_ci_check_global_catalog_acl.sql"]).toBeTruthy();
    expect(read(".github/workflows/rls-tests.yml"))
      .toContain("python3 scripts/db/global-catalog-permissions/test-negative.py");
  });
  it("retains the exact 39 historical release entries and adds only this migration", () => {
    const manifest = JSON.parse(read("supabase/releases/migration-manifest.json"));
    const historical = Object.fromEntries(Object.entries(manifest)
      .filter(([version]) => version.localeCompare("13.824.75", "en", { numeric: true }) < 0));
    expect(Object.keys(historical)).toHaveLength(39);
    expect(hash(JSON.stringify(historical))).toBe("44d18235af32fafe79770fd0506efe93e58c36961312b2e44e70cef35d4a0606");
    const before = manifest["13.824.74"].migrations as string[];
    const after = manifest["13.824.75"].migrations as string[];
    expect(before).toHaveLength(1524);
    expect(after).toHaveLength(1525);
    expect(after.filter(file => !before.includes(file))).toEqual([migration]);
    expect(before.every(file => after.includes(file))).toBe(true);
  });
});
