import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Handler real, dependencias sintéticas: ninguna red ni correo real.
async function enviar(estado: string, deleted_at: string | null = null, acceso = true, cancelarAntesEntregar = false) {
  const prof = { id: "p1", organization_id: "o1", estado_proforma: estado, deleted_at,
    token_publico: "token", token_expira_at: "2099-01-01", total_mxn: 116, total_usd: 0 };
  const writes: string[] = [];
  const entrega = vi.fn(async () => ({ ok: true }));
  let lecturas = 0;
  const admin = { from(table: string) {
    if (table === "proformas" && ++lecturas > 1 && cancelarAntesEntregar) prof.estado_proforma = "cancelada";
    let visible = true;
    const result = () => ({ data: table === "proformas" ? (visible ? prof : null) : table === "organization_members" && !acceso ? null : { id: "fixture" }, error: null });
    const chain = {
      select: () => chain, eq: () => chain,
      is: (key: string, value: unknown) => { if (key === "deleted_at" && prof.deleted_at !== value) visible = false; return chain; },
      neq: (key: string, value: unknown) => { if (key === "estado_proforma" && prof.estado_proforma === value) visible = false; return chain; },
      update: () => { writes.push(table); return chain; },
      insert: () => { writes.push(table); return chain; },
      single: async () => result(), maybeSingle: async () => result(),
      then: (fn: (value: unknown) => unknown) => Promise.resolve(result()).then(fn),
    };
    return chain;
  } };
  let handler!: (req: Request) => Promise<Response>;
  const src = readFileSync("supabase/functions/enviar-proforma-email/index.ts", "utf8");
  const compiled = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/^import .*?;\s*$/gm, "").replace(/^export \{\};?\s*$/gm, "");
  runInNewContext(compiled, {
    Deno: { env: { get: (key: string) => key === "SUPABASE_ANON_KEY" ? "anon-fixture" : "synthetic" }, serve: (fn: typeof handler) => { handler = fn; } },
    createClient: (_url: string, key: string) => key === "anon-fixture" ? { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } } : admin,
    wrapEdgeHandler: (_name: string, fn: typeof handler) => fn,
    captureEdgeException: vi.fn(), buildCors: () => ({}), handlePreflightStrict: () => null,
    enviarEmailPlantilla: entrega,
    _jsonResponse: (data: unknown, status: number) => new Response(JSON.stringify(data), { status }),
    Date, Intl, crypto, console,
  });
  const response = await handler(new Request("https://synthetic.invalid", { method: "POST", headers: { Authorization: "Bearer synthetic" }, body: JSON.stringify({ proforma_id: "p1", destinatarios: [{ email: "fixture@example.invalid" }] }) }));
  return { response, entrega, writes };
}

describe("envío Edge del histórico cancelado", () => {
  it("rechaza cancelada con token vigente sin crear token, entregar correo ni registrar bitácora", async () => {
    const { response, entrega, writes } = await enviar("cancelada");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("LC_PROFORMA_CANCELADA") });
    expect(entrega).toHaveBeenCalledTimes(0);
    expect(writes).toEqual([]);
  });
  it("conserva soft-delete y aislamiento de organización", async () => {
    for (const result of [await enviar("pendiente", "2026-01-01"), await enviar("pendiente", null, false)]) {
      expect([403, 404]).toContain(result.response.status);
      expect(result.entrega).toHaveBeenCalledTimes(0);
      expect(result.writes).toEqual([]);
    }
  });
  it("mantiene el envío de una nueva proforma vigente", async () => {
    const { response, entrega } = await enviar("pendiente");
    expect(response.status).toBe(200);
    expect(entrega).toHaveBeenCalledOnce();
  });
  it("vuelve a comprobar el estado antes de la entrega externa", async () => {
    const { response, entrega } = await enviar("pendiente", null, true, true);
    expect(await response.json()).toMatchObject({ success: false, estado: "fallido" });
    expect(entrega).toHaveBeenCalledTimes(0);
  });
});
