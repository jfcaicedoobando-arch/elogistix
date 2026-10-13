import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock"); return createSoftDeleteReadMock();
});
const fx = vi.hoisted(() => ({ upload: vi.fn(), actividad: vi.fn(), limpiar: vi.fn(), anterior: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/storage/index", () => ({ uploadFile: fx.upload }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: fx.actividad }));
vi.mock("@/lib/documentoStorage", () => ({ limpiarBlobBestEffort: fx.limpiar, limpiarBlobAnteriorTrasReemplazo: fx.anterior }));
import { uploadDocumentoEmbarque } from "../uploadDocumentoEmbarque";
import { sha256Hex } from "../idempotencyHash";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
function usuario(userId = "actor-test", organizationId = "org-test") {
  setAuthSnapshot({ userId, organizationId, role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId, organizationId });
}
const from = mock.supabase.from.getMockImplementation()!;
const rpc = mock.supabase.rpc.getMockImplementation()!;
beforeEach(() => {
  usuario(); mock.reset(); mock.supabase.from.mockImplementation(from); mock.supabase.rpc.mockImplementation(rpc);
  for (const fn of Object.values(fx)) fn.mockReset().mockResolvedValue(undefined);
  mock.setRpcResult("idempotency_claim", { data: { __idempotency_pending: true }, error: null });
});
const file = () => new File(["contenido-fixture"], "test.pdf", { type: "application/pdf" });
const sinEfectos = () => {
  expect(mock.rpcCalls).toHaveLength(0); expect(mock.tableCalls.some(c => c.ops.includes("update"))).toBe(false);
  for (const fn of Object.values(fx)) expect(fn).not.toHaveBeenCalled();
};
const filtros = (index: number) => {
  for (const args of [["id", "d1"], ["embarque_id", "e1"], ["organization_id", "org-test"], ["deleted_at", null]]) expect(mock.tableCalls[index].opArgs).toContainEqual(args);
};
describe("prelectura documental viva antes de claim/storage", () => {
  it("ausencia no reclama idempotencia ni sube archivo", async () => {
    mock.queue("documentos_embarque", null);
    await expect(uploadDocumentoEmbarque("e1", "d1", file())).rejects.toMatchObject({ code: "NOT_FOUND" }); sinEfectos(); filtros(0);
  });
  it("baja con mismo path tampoco devuelve cache exitoso", async () => {
    const f = file(); const hash = await sha256Hex(f); const path = `embarques/e1/d1/${hash.slice(0, 12)}-test.pdf`;
    mock.queue("documentos_embarque", { archivo: path, deleted_at: "2026-10-01" });
    await expect(uploadDocumentoEmbarque("e1", "d1", f)).rejects.toMatchObject({ code: "NOT_FOUND" }); sinEfectos();
  });
  it("error inicial se propaga sin claim, upload ni limpieza", async () => {
    const error = new Error("lectura-documento"); mock.queue("documentos_embarque", null, error);
    await expect(uploadDocumentoEmbarque("e1", "d1", file())).rejects.toBe(error); sinEfectos();
  });
  it("mismo archivo en fila viva conserva cache sin RPC ni UPDATE", async () => {
    const f = file(); const hash = await sha256Hex(f); const path = `embarques/e1/d1/${hash.slice(0, 12)}-test.pdf`;
    mock.queue("documentos_embarque", { archivo: path });
    expect(await uploadDocumentoEmbarque("e1", "d1", f)).toEqual({ path, fileName: f.name, cached: true }); sinEfectos(); filtros(0);
  });
  it("cambio de contexto durante prelectura impide primer efecto", async () => {
    mock.queue("documentos_embarque", { archivo: null });
    mock.supabase.from.mockImplementation(table => {
      const chain = from(table); const single = chain.maybeSingle as () => Promise<unknown>;
      chain.maybeSingle = async () => { const res = await single(); usuario("otro-actor", "otra-org"); return res; }; return chain;
    });
    await expect(uploadDocumentoEmbarque("e1", "d1", file())).rejects.toThrow(/canceló/); sinEfectos();
  });
});
describe("UPDATE activo normal y cacheado", () => {
  it("upload vivo conserva commit, store, actividad y limpieza de anterior", async () => {
    mock.queue("documentos_embarque", { archivo: "anterior-fixture.pdf" }); mock.queue("documentos_embarque", [{ id: "d1" }]);
    const result = await uploadDocumentoEmbarque("e1", "d1", file()); expect(result.cached).toBe(false); filtros(0); filtros(1);
    expect(mock.getMutationPayload("documentos_embarque", "update")).toEqual({ archivo: result.path, estado: "Recibido" });
    expect(fx.upload).toHaveBeenCalledOnce(); expect(fx.anterior).toHaveBeenCalledExactlyOnceWith("anterior-fixture.pdf", result.path, "upload_documento_embarque:reemplazo");
    expect(mock.rpcCalls.map(c => c.fn)).toEqual(["idempotency_claim", "idempotency_store"]); expect(fx.actividad).toHaveBeenCalledOnce();
  });
  it("cache vivo A→B→A resincroniza con filtro activo, sin upload ni store", async () => {
    mock.queue("documentos_embarque", { archivo: "anterior-fixture.pdf" }); mock.queue("documentos_embarque", [{ id: "d1" }]);
    mock.setRpcResult("idempotency_claim", { data: { path: "cache-fixture.pdf", fileName: "cache.pdf" }, error: null });
    expect(await uploadDocumentoEmbarque("e1", "d1", file())).toEqual({ path: "cache-fixture.pdf", fileName: "cache.pdf", cached: true }); filtros(1);
    expect(fx.upload).not.toHaveBeenCalled(); expect(fx.limpiar).not.toHaveBeenCalled(); expect(fx.actividad).not.toHaveBeenCalled();
    expect(mock.rpcCalls.map(c => c.fn)).toEqual(["idempotency_claim"]);
  });
  it("cache que coincide con fila viva no actualiza", async () => {
    mock.queue("documentos_embarque", { archivo: "cache-fixture.pdf" }); mock.setRpcResult("idempotency_claim", { data: { path: "cache-fixture.pdf" }, error: null });
    expect((await uploadDocumentoEmbarque("e1", "d1", file())).cached).toBe(true); expect(mock.tableCalls).toHaveLength(1); expect(fx.upload).not.toHaveBeenCalled();
  });
  it.each(["normal", "cacheado"])("baja tras prelectura no revive por UPDATE %s", async modo => {
    mock.queue("documentos_embarque", { archivo: "anterior-fixture.pdf" }); mock.queue("documentos_embarque", [{ id: "d1", deleted_at: "2026-10-01" }]);
    if (modo === "cacheado") mock.setRpcResult("idempotency_claim", { data: { path: "cache-fixture.pdf" }, error: null });
    await expect(uploadDocumentoEmbarque("e1", "d1", file())).rejects.toThrow(modo === "cacheado" ? /No se pudo sincronizar/ : /No se pudo actualizar/); filtros(1);
    expect(fx.actividad).not.toHaveBeenCalled(); expect(mock.rpcCalls.some(c => c.fn === "idempotency_store")).toBe(false); expect(fx.anterior).not.toHaveBeenCalled();
    if (modo === "normal") expect(fx.limpiar).toHaveBeenCalledOnce(); else { expect(fx.upload).not.toHaveBeenCalled(); expect(fx.limpiar).not.toHaveBeenCalled(); }
  });
  it.each(["normal", "cacheado"])("error del UPDATE %s conserva error y limpieza adecuada", async modo => {
    const error = new Error("commit-documento"); mock.queue("documentos_embarque", { archivo: null }); mock.queue("documentos_embarque", null, error);
    if (modo === "cacheado") mock.setRpcResult("idempotency_claim", { data: { path: "cache-fixture.pdf" }, error: null });
    await expect(uploadDocumentoEmbarque("e1", "d1", file())).rejects.toBe(error); expect(fx.actividad).not.toHaveBeenCalled();
    if (modo === "normal") expect(fx.limpiar).toHaveBeenCalledOnce(); else expect(fx.limpiar).not.toHaveBeenCalled();
  });
  it("contexto cambia durante claim: no hay upload ni UPDATE posterior", async () => {
    mock.queue("documentos_embarque", { archivo: null }); mock.supabase.rpc.mockImplementation(async (fn, args) => {
      const res = await rpc(fn, args); usuario("otro-actor", "otra-org"); return res;
    });
    await expect(uploadDocumentoEmbarque("e1", "d1", file())).rejects.toThrow(/canceló/);
    expect(mock.rpcCalls.map(c => c.fn)).toEqual(["idempotency_claim"]); expect(fx.upload).not.toHaveBeenCalled(); expect(mock.tableCalls).toHaveLength(1); expect(fx.actividad).not.toHaveBeenCalled();
  });
  it("contexto cambia durante upload: limpia blob nuevo sin commit o actividad", async () => {
    mock.queue("documentos_embarque", { archivo: null }); fx.upload.mockImplementation(async () => { usuario("otro-actor", "otra-org"); });
    await expect(uploadDocumentoEmbarque("e1", "d1", file())).rejects.toThrow(/canceló/); expect(fx.limpiar).toHaveBeenCalledOnce();
    expect(mock.tableCalls).toHaveLength(1); expect(fx.actividad).not.toHaveBeenCalled(); expect(mock.rpcCalls.map(c => c.fn)).toEqual(["idempotency_claim"]);
  });
  it("cambio tras UPDATE confirmado omite efectos posteriores sin fingir aborto", async () => {
    mock.queue("documentos_embarque", { archivo: "anterior-fixture.pdf" }); mock.queue("documentos_embarque", [{ id: "d1" }]);
    mock.supabase.from.mockImplementation(table => {
      const chain = from(table); const then = chain.then as (fn: (res: unknown) => unknown) => Promise<unknown>;
      chain.then = (callback: (res: unknown) => unknown) => then(res => { usuario("otro-actor", "otra-org"); return callback(res); }); return chain;
    });
    expect((await uploadDocumentoEmbarque("e1", "d1", file())).cached).toBe(false); expect(fx.actividad).not.toHaveBeenCalled(); expect(fx.anterior).not.toHaveBeenCalled();
    expect(mock.rpcCalls.map(c => c.fn)).toEqual(["idempotency_claim"]);
  });
});
