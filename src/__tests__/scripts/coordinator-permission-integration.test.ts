import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(path, "utf8");

describe("coordinator permission boundary integration", () => {
  it("chains only the forward correction after margin", () => {
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")).entries;
    const previous = JSON.parse(read("drizzle/migrations/meta/0039_snapshot.json"));
    const current = JSON.parse(read("drizzle/migrations/meta/0040_snapshot.json"));
    expect(journal).toHaveLength(41);
    expect(journal[40]).toEqual({ idx: 40, version: "7", when: 1794002479400,
      tag: "0040_coordinador_permission_boundary", breakpoints: true });
    expect(current.prevId).toBe(previous.id);
    expect(current.id).not.toBe(previous.id);
    expect(read("supabase/tests/_guards_manifest.txt")).toContain("supabase/tests/coordinador_permission_boundary.sql");
  });
  it("checks private triggers before and after artificial harness grants", () => {
    for (const path of ["scripts/ci/rls-prepare-db.sh", "scripts/db/local-verify.sh"]) {
      expect(read(path)).toContain("_ci_check_coordinador_acl.sql");
    }
    for (const path of ["scripts/db/local-verify.sh", ".github/workflows/rls-tests.yml"]) {
      const text = read(path);
      expect(text.indexOf("_ci_preserve_coordinador_acl.sql")).toBeGreaterThan(text.indexOf("_ci_post_migrate.sql"));
    }
    const preserve = read("supabase/tests/rls/_ci_preserve_coordinador_acl.sql");
    expect(preserve).toContain("REVOKE EXECUTE ON FUNCTION public._cliente_coordinador_guard(), public._cotizacion_crear_handover() FROM authenticated, service_role;");
    expect(preserve).toContain("\\ir _ci_check_coordinador_acl.sql");
    const check = read("supabase/tests/rls/_ci_check_coordinador_acl.sql");
    expect(check).toContain("pg_catalog.pg_has_role(v_role,v_owner,'MEMBER')");
    expect(check).toContain("a.grantee<>v_owner OR a.grantor<>v_owner OR a.is_grantable");
    expect(check).toContain("v_proc.prosecdef IS DISTINCT FROM (v_name='public._cotizacion_crear_handover()')");
  });
});
