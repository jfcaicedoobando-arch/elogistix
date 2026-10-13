import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanFile } from "@/../scripts/audit-migrations";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const forwardFile = "20261013210000_guard_demo_cleanup_tenant_graph.sql";
const sql = read(`supabase/migrations/${forwardFile}`);
const baseline = read("supabase/schema/baseline.sql");
const core = baseline.match(/CREATE FUNCTION public\.seed_demo_organization_core\([\s\S]*?\n\$\$;/)![0];
const rootBlock = sql.split("v_roots := ARRAY[")[1].split("];", 1)[0];
const roots = [...rootBlock.matchAll(/'public\.(\w+)'::regclass/g)].map((m) => m[1]);
const globalBlock = sql.split("v_globals := array_remove(ARRAY[")[1].split("], NULL::oid)", 1)[0];
const globals = new Set([...globalBlock.matchAll(/to_regclass\('public\.(\w+)'\)/g)].map((m) => m[1]));
const tables = new Map([...baseline.matchAll(/CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/g)]
  .map((m) => [m[1], m[2]]));
const edges = [...baseline.matchAll(/ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT (\w+) FOREIGN KEY \((.*?)\) REFERENCES public\.(\w+)\((.*?)\)([^;]*);/g)]
  .map((m) => ({ child: m[1], name: m[2], childKeys: m[3].split(", "), parent: m[4], parentKeys: m[5].split(", "), action: m[6] }));
const graph = new Set(roots);
for (let previousSize = -1; previousSize !== graph.size;) {
  previousSize = graph.size;
  for (const edge of edges) {
    if (graph.has(edge.child) && !globals.has(edge.child)) graph.add(edge.parent);
    if (graph.has(edge.parent) && !globals.has(edge.parent)) graph.add(edge.child);
  }
}

// Structural contracts only. Runtime acceptance requires the separate disposable
// PostgreSQL fixture and two-session tests; these assertions are not an SQL engine.
describe("forward demo cleanup fail-closed tenant graph contract", () => {
  it("passes the real migration guard without changing historical replay ownership", () => {
    expect(scanFile(forwardFile, sql)).toEqual([]);
    const mapping = JSON.parse(read("drizzle/replay.json")) as { file: string; replays: string[] }[];
    expect(mapping.find((entry) => entry.file === "0014_demo_seed_limpia_agentes.sql")?.replays)
      .toEqual(["20261013204000_replay_demo_seed_limpia_agentes.sql"]);
    expect(mapping.some((entry) => entry.replays.includes(forwardFile))).toBe(false);
  });
  it("keeps authorization, lock and cooldown before the gate, and the whole gate before business DML", () => {
    const ordered = ["LC_SEED_DEMO_NO_AUTORIZADO", "PERFORM pg_advisory_xact_lock", "RETURN false;",
      "current_setting('transaction_isolation')", "EXECUTE v_graph_sql INTO v_graph", "LOCK TABLE ONLY",
      "EXECUTE v_graph_sql INTO v_after", "v_after_fingerprint IS DISTINCT FROM v_fingerprint",
      "INTO v_bad USING v_org", "IF v_bad THEN", "UPDATE public.crm_solicitudes_pricing",
      "DELETE FROM public.costeo_cargos_fob_agente", "PERFORM public.seed_demo_organization_core()",
      "INSERT INTO public.demo_seed_state"];
    const offsets = ordered.map((needle) => sql.indexOf(needle));
    expect(offsets.every((n) => n >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(sql.slice(0, sql.indexOf("UPDATE public.crm_solicitudes_pricing")))
      .not.toMatch(/(?:UPDATE|DELETE FROM|INSERT INTO|TRUNCATE)\s+public\./);
  });
  it("covers every direct DELETE root and all reviewed core mutation targets", () => {
    const coreDeletes = [...core.matchAll(/DELETE FROM public\.(\w+)/g)].map((m) => m[1]);
    expect(coreDeletes).toHaveLength(12);
    expect(roots).toHaveLength(16);
    expect(new Set(roots).size).toBe(roots.length);
    for (const table of coreDeletes) expect(roots).toContain(table);
    for (const mutation of core.matchAll(/(?:DELETE FROM|UPDATE|INSERT INTO) public\.(\w+)/g)) {
      expect(graph.has(mutation[1]), `unrepresented core mutation: ${mutation[1]}`).toBe(true);
      expect(globals.has(mutation[1]), `core mutates a shared endpoint: ${mutation[1]}`).toBe(false);
    }
  });
  it("supports every reviewed baseline graph table and UUID FK key without blind unscoped exceptions", () => {
    expect(graph.size).toBeGreaterThan(80);
    expect([...globals].sort()).toEqual(["navieras", "organizations", "puertos", "tipos_contenedor"]);
    for (const name of graph) {
      const table = tables.get(name);
      expect(table, name).toBeDefined();
      if (globals.has(name)) {
        expect(table).not.toMatch(/\borganization_id\b/);
        expect(table).toMatch(/\bid uuid\b/);
      } else expect(table, name).toMatch(/\borganization_id uuid\b/);
    }
    for (const edge of edges.filter((edge) => graph.has(edge.child) && graph.has(edge.parent))) {
      expect(globals.has(edge.child), `global child: ${edge.name}`).toBe(false);
      for (const [table, keys] of [[edge.child, edge.childKeys], [edge.parent, edge.parentKeys]] as const) {
        for (const key of keys) expect(tables.get(table), `${edge.name}: ${key}`).toMatch(new RegExp(`\\b${key} uuid\\b`));
      }
    }
  });
  it("includes actual incoming cascade/SET NULL and outgoing rollup-parent paths", () => {
    for (const name of ["agente_users_agente_id_fkey", "costeo_tarifas_reemplazada_por_fkey", "anticipos_aplicaciones_anticipo_id_fkey"]) {
      const edge = edges.find((edge) => edge.name === name)!;
      expect(edge, name).toBeDefined();
      expect(graph.has(edge.child) && graph.has(edge.parent)).toBe(true);
    }
    expect(sql).toContain("fk.conrelid = g.relid OR fk.confrelid = g.relid");
    expect(sql).toContain("p.organization_id = $1 AND c.organization_id IS DISTINCT FROM $1");
    expect(sql).toContain("c.organization_id = $1 AND p.organization_id IS DISTINCT FROM $1");
    expect(sql).not.toMatch(/fk\.confdeltype\s*=|fk\.convalidated\s*=/);
  });
  it("re-resolves every static root and shared endpoint name after locking", () => {
    const recheck = sql.split("IF v_roots IS DISTINCT FROM ARRAY[")[1];
    expect(recheck).toBeDefined();
    const checkedRoots = [...recheck.split("]", 1)[0].matchAll(/to_regclass\('public\.(\w+)'\)/g)].map((m) => m[1]);
    expect(checkedRoots).toEqual(roots);
    const checkedGlobals = recheck.split("OR v_globals IS DISTINCT FROM array_remove(ARRAY[")[1].split("], NULL::oid)", 1)[0];
    expect(checkedGlobals).toBe(globalBlock);
    expect(sql.indexOf("IF v_roots IS DISTINCT FROM ARRAY[")).toBeGreaterThan(sql.indexOf("LOCK TABLE ONLY"));
  });
  it("has fail-closed snapshot, lock, identity, schema and operator gates", () => {
    expect(sql).toContain("current_setting('transaction_isolation') <> 'read committed'");
    expect(sql).toContain("IN SHARE ROW EXCLUSIVE MODE NOWAIT");
    expect(sql).toContain("WHERE c.oid = ANY(v_graph) ORDER BY c.oid");
    expect(sql).toContain("l.relation = v_relation.oid");
    expect(sql).toContain("l.mode = 'ShareRowExclusiveLock' AND l.granted");
    expect(sql.match(/jsonb_agg\(to_jsonb\(fk\) ORDER BY fk.oid\)/g)).toHaveLength(2);
    expect(sql).toContain("v_after IS DISTINCT FROM v_graph");
    expect(sql).toContain("i.inhrelid = v_relation.oid OR i.inhparent = v_relation.oid");
    expect(sql).toContain("v_relation.relkind <> 'r'");
    expect(sql).toContain("'pg_catalog.=(uuid,uuid)'::regoperator::oid");
    expect(sql).toContain("WITH ORDINALITY AS keys(child_att, parent_att, ord)");
    expect(sql).toContain("fk.conrelid = ANY(v_globals)");
    expect(sql).toContain("LC_SEED_DEMO_TENANT_UNSAFE");
  });
  it("adds only function-local unfiltered-read configuration and retains service-role-only ACL", () => {
    expect(sql).toContain("p_skip_ms bigint DEFAULT 600000");
    expect(sql).toContain("SECURITY DEFINER\n SET search_path TO 'public'\n SET row_security TO 'off'");
    expect(sql).not.toMatch(/set_config|ALTER\s+(?:ROLE|TABLE)|DISABLE\s+TRIGGER|BYPASSRLS|OWNER TO/i);
    const grants = (text: string) => text.match(/(?:REVOKE ALL|GRANT EXECUTE) ON FUNCTION public\.seed_demo_organization_guarded\(bigint\)[^;]+;/g);
    expect(grants(sql)).toEqual(grants(read("supabase/migrations/20261013204000_replay_demo_seed_limpia_agentes.sql")));
    expect(read("supabase/schema/security/seed_demo_organization_guarded.sql")).toBe(sql);
    expect(baseline.match(/CREATE FUNCTION public\.seed_demo_organization_guarded\([\s\S]*?AS \$\$/)?.[0])
      .toContain("SET row_security TO 'off'");
  });
});
