import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanFile } from "@/../scripts/audit-migrations";
import { extractDumpFunction } from "@/test/helpers/extractDumpFunction";

const file = "20261014203000_demo_seed_identidad_y_aprobacion.sql";
const read = (path: string) => readFileSync(path, "utf8");
const forward = read(`supabase/migrations/${file}`);

describe("demo core compatibility forward reconstruction", () => {
  it("passes the actual migration scanner with the existing service-only ACL", () => {
    expect(scanFile(file, forward)).toEqual([]);
    expect(forward.match(/CREATE OR REPLACE FUNCTION public\.(\w+)/g))
      .toEqual(["CREATE OR REPLACE FUNCTION public.seed_demo_organization_core"]);
    expect(forward).not.toMatch(/ALTER (?:ROLE|TABLE)|DISABLE TRIGGER|app\.aprobando_cxp|INSERT INTO auth\.users/);
    expect(forward.match(/GRANT EXECUTE[^;]+;/g))
      .toEqual(["GRANT EXECUTE ON FUNCTION public.seed_demo_organization_core() TO service_role;"]);
  });

  it("aligns the canonical core and generated dump with the new effective migration", () => {
    const effective = read("supabase/migrations/20261015050000_disable_demo_reseed.sql");
    expect(extractDumpFunction(read("supabase/schema/security/seed_demo_organization_core.sql"), "public.seed_demo_organization_core").body).toBe(extractDumpFunction(effective, "public.seed_demo_organization_core").body);
    const expected = extractDumpFunction(effective, "public.seed_demo_organization_core").body;
    const actual = extractDumpFunction(read("supabase/schema/baseline.sql"), "public.seed_demo_organization_core");
    expect(actual.body).toBe(expected.split("\n").filter((line) => line.trim()).join("\n") + "\n");
    expect(actual.header).toContain("SECURITY DEFINER");
    expect(actual.header).toContain("SET search_path TO 'public'");
  });

  it("includes the unique forward file in the active release and current inventory", () => {
    const files = readdirSync("supabase/migrations").filter((path) => path.endsWith(".sql")).sort();
    expect(files.filter((path) => path.startsWith(file.slice(0, 14)))).toEqual([file]);
    const version = read("src/constants/appVersion.ts").match(/APP_VERSION\s*=\s*"([^"]+)"/)![1];
    const manifest = JSON.parse(read("supabase/releases/migration-manifest.json"));
    expect(manifest[version].migrations).toEqual(files);
  });
});
