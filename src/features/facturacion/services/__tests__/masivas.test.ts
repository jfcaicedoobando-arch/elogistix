import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
vi.mock("../enviarCfdiEmail", () => ({ enviarCfdiFactura: vi.fn() }));

import { fetchFacturasParaZip, marcarFacturasComoEnviadas, reenviarFacturasMasivas } from "../masivas";
import { registrarActividad } from "@/services/bitacora/registrar";
import { enviarCfdiFactura } from "../enviarCfdiEmail";
import { AuthOperationChangedError } from "@/lib/auth/authOperationScope";

const scope = { organizationId: "org-1", isCurrent: () => true, assertCurrent: () => {} };

describe("masivas service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    vi.clearAllMocks();
  });

  it("fetchFacturasParaZip cortocircuita con array vacío", async () => {
    const res = await fetchFacturasParaZip([]);
    expect(res).toEqual([]);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("fetchFacturasParaZip devuelve filas y aplica IN(ids)", async () => {
    const rows = [{ id: "1", numero: "F-1", factura_pdf_url: null, factura_xml_url: null }];
    mock.setTableResult("facturas", { data: rows, error: null });
    const res = await fetchFacturasParaZip(["1", "2"]);
    expect(res).toEqual(rows);
    const call = mock.tableCalls[0];
    expect(call.table).toBe("facturas");
    expect(call.opArgs[call.ops.indexOf("in")]).toEqual(["id", ["1", "2"]]);
  });

  it("fetchFacturasParaZip propaga error de Supabase", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("nope") });
    await expect(fetchFacturasParaZip(["1"])).rejects.toThrow("nope");
  });

  it("marcarFacturasComoEnviadas cortocircuita con []", async () => {
    await marcarFacturasComoEnviadas([]);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("marca filas visibles y registra únicamente los IDs confirmados, como marcado manual", async () => {
    mock.setTableResult("facturas", { data: [{ id: "a" }], error: null });
    const resultados = await marcarFacturasComoEnviadas(["a", "b"], scope);
    expect(resultados).toEqual([
      { facturaId: "a", ok: true },
      { facturaId: "b", ok: false, error: "No se confirmó el marcado" },
    ]);
    const call = mock.tableCalls[0];
    const updateArgs = call.opArgs[call.ops.indexOf("update")];
    expect(updateArgs?.[0]).toHaveProperty("enviada_cliente_at");
    expect(call.opArgs[call.ops.indexOf("in")]).toEqual(["id", ["a", "b"]]);
    expect(call.opArgs[call.ops.indexOf("is")]).toEqual(["deleted_at", null]);
    expect(call.opArgs[call.ops.indexOf("eq")]).toEqual(["organization_id", "org-1"]);
    expect(call.opArgs[call.ops.indexOf("select")]).toEqual(["id"]);
    expect(registrarActividad).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      accion: "Marcó facturas como enviadas manualmente",
      detalles: { facturaIds: ["a"] },
      organizationId: "org-1",
    }));
    expect(enviarCfdiFactura).not.toHaveBeenCalled();
  });

  it("no registra éxito si el update no confirma ninguna factura", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    await expect(marcarFacturasComoEnviadas(["a"], scope))
      .resolves.toEqual([{ facturaId: "a", ok: false, error: "No se confirmó el marcado" }]);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("marcarFacturasComoEnviadas propaga error", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("bad") });
    await expect(marcarFacturasComoEnviadas(["a"])).rejects.toThrow("bad");
  });

  it("reporta reenvíos parciales por factura y no registra marcado manual", async () => {
    vi.mocked(enviarCfdiFactura)
      .mockResolvedValueOnce({ ok: true, enviado_a: "cliente@example.invalid" })
      .mockRejectedValueOnce(new Error("Sin contacto"));
    const onProgress = vi.fn();
    const resultados = await reenviarFacturasMasivas(["b", "a"], { scope, onProgress });
    expect(resultados).toEqual([
      { facturaId: "b", ok: true },
      { facturaId: "a", ok: false, error: "Sin contacto" },
    ]);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("omite envíos pendientes si cambia la sesión durante el lote", async () => {
    let actual = true;
    vi.mocked(enviarCfdiFactura).mockImplementation(async () => {
      actual = false;
      return { ok: true, enviado_a: "cliente@example.invalid" };
    });
    const scoped = {
      ...scope,
      isCurrent: () => actual,
      assertCurrent: () => { if (!actual) throw new AuthOperationChangedError(); },
    };
    await expect(reenviarFacturasMasivas(["a", "b", "c", "d", "e"], { scope: scoped }))
      .rejects.toBeInstanceOf(AuthOperationChangedError);
    expect(enviarCfdiFactura).toHaveBeenCalledExactlyOnceWith("a");
  });
});
