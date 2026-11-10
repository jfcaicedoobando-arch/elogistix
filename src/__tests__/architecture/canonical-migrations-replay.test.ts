import { readIsolatedDrizzleReplay } from "../../../scripts/ci/drizzle-history/control.mjs";
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "../../../scripts/lib/audit-drizzle-replay";

describe("canonical migration reconstruction", () => {
  it("covers every immutable Drizzle migration through reviewed Supabase replay", () => {
    const sources = (dir: string) => new Map(readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [file, readFileSync(`${dir}/${file}`, "utf8")]));
    const mapping = JSON.parse(readFileSync("drizzle/replay.json", "utf8")) as DrizzleReplayEntry[];
    expect(scanDrizzleReplay(sources("drizzle/migrations"), sources("supabase/migrations"), mapping, readIsolatedDrizzleReplay())).toEqual([]);
    expect(existsSync("supabase/releases/external-migrations.tsv")).toBe(false);
    expect(existsSync("scripts/db/replay-files.sh")).toBe(false);
  });

  it("accounts for deployed H14 through its existing atomic canonical migration only once", () => {
    const file = "0024_h14_baja_embarque_integridad_financiera.sql";
    const replay = "20261103100000_h14_baja_embarque_integridad_financiera.sql";
    const mapping = JSON.parse(readFileSync("drizzle/replay.json", "utf8")) as DrizzleReplayEntry[];
    expect(mapping.filter(entry => entry.file === file)).toEqual([{
      file,
      sha256: "ea07fc4a0064813482d84a3d7924867dc941cfc9b6ea9993bf75427c4a8af88b",
      replays: [replay],
    }]);
    const source = readFileSync(`drizzle/migrations/${file}`, "utf8");
    const canonical = readFileSync(`supabase/migrations/${replay}`, "utf8");
    const hash = (sql: string) => createHash("sha256").update(sql).digest("hex");
    expect(hash(source)).toBe("ea07fc4a0064813482d84a3d7924867dc941cfc9b6ea9993bf75427c4a8af88b");
    expect(hash(canonical)).toBe("e926236c6a54d353c905477677ae31f5ff1800caed1734c9cf2a65ee457c087e");
    // Drizzle history omits only the outer transaction; every guard, grant and body stays identical.
    const withoutOuterTransaction = (sql: string) => sql
      .replace(/^((?:--[^\n]*\n){3})BEGIN;\n/, "$1")
      .replace(/\nCOMMIT;\n$/, "\n");
    expect(source).toBe(withoutOuterTransaction(canonical));
    expect(readIsolatedDrizzleReplay().has(file)).toBe(false);
    expect(readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")
      && withoutOuterTransaction(readFileSync(`supabase/migrations/${name}`, "utf8")) === source)).toEqual([replay]);
  });

  it("orders the six unpublished financial fixes after the integrated upstream replays", () => {
    const migrations = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
    const financial = migrations.filter((file) => /^20261006020[0-5]00_audit/.test(file));
    expect(financial).toHaveLength(6);
    // Pin this integration boundary, not future Drizzle work added after it.
    const boundary = "20261006012000_replay_pricing_unidad_medida.sql";
    expect(migrations).toContain(boundary);
    expect(boundary < financial[0]).toBe(true);
    expect("20261005190000_replay_cierre_sin_pago_tc_nulo.sql" < financial[1]).toBe(true);
    const closure = readFileSync(`supabase/migrations/${financial[1]}`, "utf8");
    expect(closure).toContain("public.fecha_negocio_mx(), v_saldo, v_moneda, NULL");
    expect(migrations.some((file) => /^20261005180[0-5]00_audit/.test(file))).toBe(false);
  });

  it("preserves extended concurrency as an explicit local recipe", () => {
    const recipe=readFileSync("scripts/ci/database-full.sh","utf8");
    expect(recipe).toContain("bash scripts/ci/concurrencia-factura-manual.sh");
    expect(recipe).toContain("bash scripts/ci/concurrencia-cobro.sh");
    expect(recipe).toContain("export ISOLATED_QA_DB='1'");
    expect(readFileSync(".github/workflows/ci.yml","utf8")).toContain("bash scripts/db/local-verify.sh --no-behavioral");
  });

  it("refuses a non-loopback CI replay target before connecting", () => {
    expect(() => execFileSync("bash", ["scripts/ci/rls-prepare-db.sh"], {
      env: { ...process.env, PGHOST: "production.invalid" }, stdio: "pipe",
    })).toThrow();
    expect(readFileSync("scripts/ci/rls-prepare-db.sh", "utf8")).toContain('[[ "$existing_relations" != 0 ]]');
  });

  it.each(["scripts/ci/rls-prepare-db.sh", "scripts/db/local-verify.sh"])("%s replays canonical ordered history plus verified isolated history", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("for f in $(printf '%s\\n' supabase/migrations/*.sql | LC_ALL=C sort); do");
    expect(source).not.toContain("external-migrations");
    expect(source).not.toContain("drizzle/migrations");
    expect(source).toContain("isolated_history=\"$(node scripts/ci/drizzle-history/control.mjs list)\" || exit 1");
  });
});
