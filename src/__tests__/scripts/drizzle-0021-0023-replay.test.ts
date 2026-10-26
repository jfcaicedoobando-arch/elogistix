import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanFile } from "@/../scripts/audit-migrations";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "@/../scripts/lib/audit-drizzle-replay";

const entries = JSON.parse(readFileSync("drizzle/replay.json", "utf8")) as DrizzleReplayEntry[];
const cases = [
  ["0021_refacturar_proforma_rpc.sql", "20261026184800_replay_refacturar_proforma_rpc.sql", "8f5c299f5c593fe398e620056d8a2971a9f9ed4e90940310df173023fa9572e5"],
  ["0022_cotizacion_comercial.sql", "20261026184900_replay_cotizacion_comercial.sql", "5cc034df0035d1f9b1722aa9bfad12ff68965bde22273500f55903bf9b60ed38"],
  ["0023_margen_minimo_utilidad_rpc.sql", "20261026185000_replay_margen_minimo_utilidad_rpc.sql", "b106eb27b920f2d34825e9141a46d2ed51943c4ccad69cca8c2f970d2348c86a"],
];

describe("Drizzle 0021–0023 immutable historical replay", () => {
  it.each(cases)("preserves every byte and original ACL of %s", (sourceFile, replayFile, sha256) => {
    const source = readFileSync(`drizzle/migrations/${sourceFile}`, "utf8");
    const replay = readFileSync(`supabase/migrations/${replayFile}`, "utf8");
    expect(createHash("sha256").update(source).digest("hex")).toBe(sha256);
    // Unlike function-body comparison, exact bytes cover DDL, trigger and ACL too.
    expect(replay).toBe(source);
    const mapping = entries.filter((entry) => entry.file === sourceFile);
    expect(mapping).toEqual([{ file: sourceFile, sha256, replays: [replayFile] }]);
    expect(scanDrizzleReplay(new Map([[sourceFile, source]]), new Map([[replayFile, replay]]), mapping)).toEqual([]);
    expect(scanFile(replayFile, replay)).toEqual([]);
  });
});

describe("0022 CI harness preserves the replay ACL", () => {
  it("checks original and final ACL without granting new roles to the trigger", () => {
    const read = (file: string) => readFileSync(file, "utf8");
    const harness = read("supabase/tests/rls/_ci_post_migrate.sql");
    const check = "\\ir _ci_check_cotizacion_vendedor_acl.sql";
    const blanket = "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;";
    const restore = "REVOKE EXECUTE ON FUNCTION public._cotizacion_vendedor_misma_org() FROM authenticated, service_role;";
    expect(harness.split(check)).toHaveLength(3);
    expect(harness.indexOf(check)).toBeLessThan(harness.indexOf(blanket));
    expect(harness.indexOf(restore)).toBeGreaterThan(harness.indexOf(blanket));
    expect(harness.lastIndexOf(check)).toBeGreaterThan(harness.indexOf(restore));
    const assertion = read("supabase/tests/rls/_ci_check_cotizacion_vendedor_acl.sql");
    expect(assertion).toContain("v_oid IS NULL");
    expect(assertion).toContain("pg_catalog.aclexplode(v_proc.proacl)) <> 1");
    expect(assertion).toContain("a.grantee <> v_owner");
    expect(assertion).toContain("OR NOT v_proc.prosecdef");
    expect(assertion).toContain("ARRAY['anon', 'authenticated', 'service_role']");
    expect(assertion).toContain("pg_catalog.has_function_privilege(v_role, v_oid, 'EXECUTE')");
    expect(assertion).not.toMatch(/\b(?:GRANT|REVOKE)\b/);
    expect(read("supabase/schema/baseline.sql")).not.toMatch(/GRANT .*ON FUNCTION public\._cotizacion_vendedor_misma_org\(\)/);
    expect(read("supabase/tests/rls/_ci_service_role_only.sql")).not.toContain("public._cotizacion_vendedor_misma_org()");
  });
});
