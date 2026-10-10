import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "../../../scripts/lib/audit-drizzle-replay";

describe("canonical migration reconstruction", () => {
  it("covers every immutable Drizzle migration through reviewed Supabase replay", () => {
    const sources = (dir: string) => new Map(readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [file, readFileSync(`${dir}/${file}`, "utf8")]));
    const mapping = JSON.parse(readFileSync("drizzle/replay.json", "utf8")) as DrizzleReplayEntry[];
    expect(scanDrizzleReplay(sources("drizzle/migrations"), sources("supabase/migrations"), mapping)).toEqual([]);
    expect(existsSync("supabase/releases/external-migrations.tsv")).toBe(false);
    expect(existsSync("scripts/db/replay-files.sh")).toBe(false);
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

  it("keeps the audit110 two-session idempotency check in isolated CI", () => {
    const workflow = readFileSync(".github/workflows/rls-tests.yml", "utf8");
    expect(workflow).toMatch(/name: Concurrencia de dos sesiones — factura manual idempotente\s+env:\s+ISOLATED_QA_DB: '1'\s+run: bash scripts\/ci\/concurrencia-factura-manual\.sh/);
    expect(workflow.match(/"scripts\/ci\/concurrencia-factura-manual\.sh"/g)).toHaveLength(2);
    // Toda la carpeta incluye factura manual, cobros y fixtures de cierre.
    // Ambas entradas (PR y push) deben conservar esa cobertura.
    expect(workflow.match(/"scripts\/ci\/fixtures\/\*\*"/g)).toHaveLength(2);
    expect(workflow.match(/"scripts\/ci\/concurrencia-cobro\.sh"/g)).toHaveLength(2);
  });

  it("refuses a non-loopback CI replay target before connecting", () => {
    expect(() => execFileSync("bash", ["scripts/ci/rls-prepare-db.sh"], {
      env: { ...process.env, PGHOST: "production.invalid" }, stdio: "pipe",
    })).toThrow();
    expect(readFileSync("scripts/ci/rls-prepare-db.sh", "utf8")).toContain('[[ "$existing_relations" != 0 ]]');
  });

  it.each(["scripts/ci/rls-prepare-db.sh", "scripts/db/local-verify.sh"])("%s replays only the canonical ordered history", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("for f in $(printf '%s\\n' supabase/migrations/*.sql | LC_ALL=C sort); do");
    expect(source).not.toContain("external-migrations");
    expect(source).not.toContain("drizzle/migrations");
  });
});
