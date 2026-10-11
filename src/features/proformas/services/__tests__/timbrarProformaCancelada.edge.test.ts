import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function cargarEmisor(validarProformasVigentes: () => Promise<Response | null>) {
  const src = readFileSync("supabase/functions/facturapi-emitir/emitir.ts", "utf8");
  const compiled = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/^import .*?;\s*$/gm, "").replace(/^export \{.*?\}.*?;\s*$/gm, "").replace(/^export /gm, "");
  const crear = vi.fn(async () => new Response("synthetic PAC", { status: 200 }));
  const context = { Response, crypto, console, validarProformasVigentes,
    buildFacturapiPayload: vi.fn(() => ({})), createInvoiceInFacturapi: crear };
  return { emitir: runInNewContext(`${compiled}\nemitirYActualizar`, context), crear };
}

describe("timbrado de borrador vinculado a histórico cancelado", () => {
  it("detiene el PAC y libera claim cuando la proforma está cancelada", async () => {
    const bloqueo = new Response(JSON.stringify({ error: "LC_PROFORMA_CANCELADA" }), { status: 409 });
    const validar = vi.fn(async () => bloqueo);
    const { emitir, crear } = cargarEmisor(validar);
    const release = vi.fn(async () => undefined);
    const response = await emitir({ supabase: {}, factura: { id: "f1", organization_id: "o1", proforma_id: "p1" }, claim: { release } });
    expect(response.status).toBe(409);
    expect(crear).toHaveBeenCalledTimes(0);
    expect(release).toHaveBeenCalledOnce();
  });
  it("mantiene el PAC de una nueva proforma vigente", async () => {
    const { emitir, crear } = cargarEmisor(async () => null);
    const release = vi.fn(async () => undefined);
    expect((await emitir({ supabase: {}, factura: { id: "f1", organization_id: "o1" }, claim: { release } })).status).toBe(200);
    expect(crear).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledTimes(0);
  });
});

function cargarGuard() {
  const src = readFileSync("supabase/functions/facturapi-emitir/proformasVigentes.ts", "utf8");
  const compiled = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/^import .*?;\s*$/gm, "").replace(/^export /gm, "");
  return runInNewContext(`${compiled}\nvalidarProformasVigentes`, {
    jsonResponse: (data: unknown, status: number) => new Response(JSON.stringify(data), { status }), Response,
  });
}

describe("orígenes vigentes previos al PAC", () => {
  it.each([
    { header: "p1", origins: [], rows: [{ id: "p1", estado_proforma: "cancelada" }], status: 409 },
    { header: "p1", origins: ["p2"], rows: [{ id: "p1", estado_proforma: "facturada" }, { id: "p2", estado_proforma: "cancelada" }], status: 409 },
    { header: "p1", origins: ["p1"], rows: [{ id: "p1", estado_proforma: "facturada" }], status: 0 },
    { header: "p1", origins: [], rows: [], status: 409 },
    { header: null, origins: [], rows: [], status: 0 },
  ])("valida cabecera y fusión sin cambiar tenant ni papelera ($header / $status)", async ({ header, origins, rows, status }) => {
    const calls: unknown[][] = [];
    const supabase = { from(table: string) {
      const chain = { select: () => chain,
        eq: (key: string, value: unknown) => { calls.push([table, key, value]); return chain; },
        is: (key: string, value: unknown) => { calls.push([table, key, value]); return chain; }, in: () => chain,
        then: (fn: (r: unknown) => unknown) => Promise.resolve({ data: table === "conceptos_factura" ? origins.map(id => ({ proforma_id_origen: id })) : rows, error: null }).then(fn) };
      return chain;
    } };
    const response = await cargarGuard()(supabase, { id: "f1", organization_id: "o1", proforma_id: header });
    expect(response?.status ?? 0).toBe(status);
    expect(calls).toContainEqual(["conceptos_factura", "organization_id", "o1"]);
    expect(calls).toContainEqual(["conceptos_factura", "deleted_at", null]);
    if (header) {
      expect(calls).toContainEqual(["proformas", "organization_id", "o1"]);
      expect(calls).toContainEqual(["proformas", "deleted_at", null]);
    }
  });
  it("un error de lectura no permite llegar al PAC", async () => {
    const supabase = { from() { const chain = { select: () => chain, eq: () => chain, is: () => chain,
      then: (fn: (r: unknown) => unknown) => Promise.resolve({ data: null, error: new Error("synthetic") }).then(fn) }; return chain; } };
    expect((await cargarGuard()(supabase, { id: "f1", organization_id: "o1" })).status).toBe(500);
  });
});
