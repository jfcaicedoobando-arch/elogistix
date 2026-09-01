import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const base = createSupabaseMock();
  return {
    ...base,
    supabase: {
      ...base.supabase,
      auth: {
        getUser: vi.fn(),
      },
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchPortalEmbarques,
  fetchPortalEmbarque,
  fetchPortalEventos,
  fetchPortalDocumentos,
  fetchPortalCotizaciones,
  fetchPortalCotizacion,
  fetchPortalFacturas,
  fetchPortalFactura,
  fetchPortalPagosFactura,
  fetchPortalClientUsers,
  fetchPortalClienteName,
  fetchPortalOrgName,
} from "@/features/portal/services/queries";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  vi.clearAllMocks();
});

describe("portal/queries", () => {
  it("fetchPortalEmbarques: corta y retorna [] cuando no hay clienteIds", async () => {
    const r = await fetchPortalEmbarques([]);
    expect(r).toEqual([]);
    expect(mock.tableCalls.length).toBe(0);
  });

  it("fetchPortalEmbarques: consulta tabla embarques cuando hay ids", async () => {
    mock.setTableResult("embarques", { data: [{ id: "e1" }], error: null });
    const r = await fetchPortalEmbarques(["cli-1"]);
    expect(r).toEqual([{ id: "e1" }]);
    expect(mock.tableCalls[0].table).toBe("embarques");
  });

  it("fetchPortalEmbarque: consulta tabla embarques por id", async () => {
    mock.setTableResult("embarques", { data: { id: "e1" }, error: null });
    const r = await fetchPortalEmbarque("e1");
    expect(r).toEqual({ id: "e1" });
  });

  it("fetchPortalEventos: ordena por fecha desc", async () => {
    mock.setTableResult("eventos_embarque", { data: [], error: null });
    await fetchPortalEventos("emb-1");
    expect(mock.tableCalls[0].ops).toContain("order");
  });

  it("fetchPortalDocumentos: propaga error", async () => {
    mock.setTableResult("documentos_embarque", { data: null, error: new Error("rls") });
    await expect(fetchPortalDocumentos("x")).rejects.toThrow("rls");
  });

  it("fetchPortalCotizaciones: resuelve embarque_expediente desde batch query", async () => {
    mock.setTableResult("cotizaciones", {
      data: [
        { id: "c1", embarque_id: "e1", folio: "COT-1" },
        { id: "c2", embarque_id: null, folio: "COT-2" },
      ],
      error: null,
    });
    mock.setTableResult("embarques", {
      data: [{ id: "e1", expediente: "EXP-X" }],
      error: null,
    });
    const r = await fetchPortalCotizaciones(["cli-1"]);
    expect(r[0].embarque_expediente).toBe("EXP-X");
    expect(r[1].embarque_expediente).toBeNull();
  });

  it("fetchPortalCotizaciones: maneja error en batch query de embarques", async () => {
    mock.setTableResult("cotizaciones", {
      data: [{ id: "c1", embarque_id: "e1" }],
      error: null,
    });
    mock.setTableResult("embarques", { data: null, error: new Error("batch fail") });
    await expect(fetchPortalCotizaciones(["cli-1"])).rejects.toThrow("batch fail");
  });

  it("fetchPortalCotizacion: maneja not found y vinculación", async () => {
    // 1. Not found
    mock.setTableResult("cotizaciones", { data: null, error: null });
    expect(await fetchPortalCotizacion("x")).toBeNull();

    // 2. Found with no embarque
    mock.setTableResult("cotizaciones", { data: { id: "c1", embarque_id: null }, error: null });
    const r1 = await fetchPortalCotizacion("c1");
    expect(r1?.embarque_expediente).toBeNull();

    // 3. Found with embarque
    mock.setTableResult("cotizaciones", { data: { id: "c1", embarque_id: "e1" }, error: null });
    mock.setTableResult("embarques", { data: { expediente: "EXP-1" }, error: null });
    const r2 = await fetchPortalCotizacion("c1");
    expect(r2?.embarque_expediente).toBe("EXP-1");
  });

  it("fetchPortalFacturas: ordena por fecha_emision desc", async () => {
    mock.setTableResult("facturas", { data: [{ id: "f1" }], error: null });
    const r = await fetchPortalFacturas(["cli-1"]);
    // B-106: la fila incluye el fallback `embarque_expediente` (null aquí).
    expect(r).toEqual([{ id: "f1", embarque_expediente: null }]);
  });

  it("fetchPortalFacturas (B-106): resuelve expediente del embarque cuando la factura no lo trae", async () => {
    mock.setTableResult("facturas", { data: [{ id: "f1", expediente: null, embarque_id: "e9" }], error: null });
    mock.setTableResult("embarques", { data: [{ id: "e9", expediente: "EMB-9" }], error: null });
    const r = await fetchPortalFacturas(["cli-1"]);
    expect(r).toEqual([{ id: "f1", expediente: null, embarque_id: "e9", embarque_expediente: "EMB-9" }]);
    expect(mock.tableCalls.some((c) => c.table === "embarques")).toBe(true);
  });

  it("fetchPortalFacturas: filtra por estados vivos (excluye Cancelada/Sustituida)", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    await fetchPortalFacturas(["cli-1"]);
    const call = mock.tableCalls.find((c) => c.table === "facturas");
    const inCalls = call!.ops.map((op, i) => [op, call!.opArgs[i]] as const).filter(([op]) => op === "in");
    const estadoFilter = inCalls.find(([, args]) => args[0] === "estado");
    expect(estadoFilter).toBeDefined();
    const values = estadoFilter![1][1] as string[];
    expect(values).not.toContain("Cancelada");
    expect(values).not.toContain("Sustituida");
    expect(values).toEqual(expect.arrayContaining(["Emitida", "Pagada", "Parcialmente pagada", "Vencida"]));
  });

  it("fetchPortalFactura: consulta tabla facturas por id", async () => {
    mock.setTableResult("facturas", { data: { id: "f1" }, error: null });
    const r = await fetchPortalFactura("f1");
    // B-106: la fila incluye el fallback `embarque_expediente` (null aquí).
    expect(r).toEqual({ id: "f1", embarque_expediente: null });
  });

  it("fetchPortalPagosFactura: ordena por fecha_pago desc", async () => {
    mock.setTableResult("pagos_factura", { data: [{ id: "p1" }], error: null });
    const r = await fetchPortalPagosFactura("f1");
    expect(r).toEqual([{ id: "p1" }]);
  });

  it("fetchPortalClientUsers: consulta tabla client_users", async () => {
    mock.setTableResult("client_users", { data: [{ id: "u1", cliente_id: "cli-1", clientes: { nombre: "Aceros del Norte" } }], error: null });
    const r = await fetchPortalClientUsers();
    // Se conserva la fila completa y se agrega el nombre legible del cliente
    // (el join va por RLS): la UI ya no muestra UUIDs ni adivina la empresa.
    expect(r).toEqual([
      { id: "u1", cliente_id: "cli-1", clientes: { nombre: "Aceros del Norte" }, cliente_nombre: "Aceros del Norte" },
    ]);
  });

  it("fetchPortalClienteName: maneja usuario no logueado y datos nulos", async () => {
    // No user
    (mock.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await fetchPortalClienteName()).toBeNull();

    // User logged in but no data
    (mock.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    mock.setTableResult("client_users", { data: null, error: null });
    expect(await fetchPortalClienteName()).toBeNull();

    // User logged in with data
    (mock.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    mock.setTableResult("client_users", { data: { clientes: { nombre: "ACME" } }, error: null });
    expect(await fetchPortalClienteName()).toBe("ACME");
  });

  it("fetchPortalOrgName: maneja usuario no logueado y datos nulos", async () => {
    // No user
    (mock.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await fetchPortalOrgName()).toBeNull();

    // User logged in but no data
    (mock.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    mock.setTableResult("client_users", { data: null, error: null });
    expect(await fetchPortalOrgName()).toBeNull();

    // User logged in with data
    (mock.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    mock.setTableResult("client_users", { data: { organizations: { nombre: "ORG" } }, error: null });
    expect(await fetchPortalOrgName()).toBe("ORG");
  });

  it.each([
    ["fetchPortalEmbarques", fetchPortalEmbarques, ["c1"]],
    ["fetchPortalEmbarque", fetchPortalEmbarque, "e1"],
    ["fetchPortalEventos", fetchPortalEventos, "e1"],
    ["fetchPortalDocumentos", fetchPortalDocumentos, "e1"],
    ["fetchPortalFacturas", fetchPortalFacturas, ["c1"]],
    ["fetchPortalFactura", fetchPortalFactura, "f1"],
    ["fetchPortalPagosFactura", fetchPortalPagosFactura, "f1"],
    ["fetchPortalClientUsers", fetchPortalClientUsers, undefined],
    ["fetchPortalClienteName", fetchPortalClienteName, undefined],
    ["fetchPortalOrgName", fetchPortalOrgName, undefined],
  ])("%s: propaga error de supabase", async (_, fn, args) => {
    mock.resetResults();
    mock.setTableResult("embarques", { data: null, error: new Error("db error") });
    mock.setTableResult("eventos_embarque", { data: null, error: new Error("db error") });
    mock.setTableResult("documentos_embarque", { data: null, error: new Error("db error") });
    mock.setTableResult("facturas", { data: null, error: new Error("db error") });
    mock.setTableResult("pagos_factura", { data: null, error: new Error("db error") });
    mock.setTableResult("client_users", { data: null, error: new Error("db error") });
    
    if (fn === fetchPortalClienteName || fn === fetchPortalOrgName) {
      (mock.supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    }

    await expect(args !== undefined ? (fn as any)(args) : (fn as any)()).rejects.toThrow("db error");
  });
});
