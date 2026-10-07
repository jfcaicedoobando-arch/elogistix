import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  aprobarFacturaProveedor,
  AprobacionFacturaError,
  MOTIVO_RECHAZO_MIN,
  MOTIVO_RECHAZO_MAX,
} from "../aprobacionFactura";

const VALID_ID = "11111111-2222-3333-4444-555555555555";
const REVIEWED_VERSION = "2026-10-04T11:00:00.123456+00:00";

describe("aprobarFacturaProveedor - validaciones", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
  });

  it("rechaza id inválido", async () => {
    await expect(aprobarFacturaProveedor("not-uuid", true)).rejects.toMatchObject({
      code: "INVALID_ID",
    });
  });

  it("rechaza id vacío", async () => {
    await expect(aprobarFacturaProveedor("", true)).rejects.toBeInstanceOf(AprobacionFacturaError);
  });

  it("motivo corto al rechazar", async () => {
    await expect(aprobarFacturaProveedor(VALID_ID, false, "x")).rejects.toMatchObject({
      code: "MOTIVO_REQUIRED",
    });
  });

  it("motivo demasiado largo", async () => {
    const largo = "x".repeat(MOTIVO_RECHAZO_MAX + 1);
    await expect(aprobarFacturaProveedor(VALID_ID, false, largo)).rejects.toMatchObject({
      code: "MOTIVO_TOO_LONG",
    });
  });

  it("constantes de motivo publicadas", () => {
    expect(MOTIVO_RECHAZO_MIN).toBeGreaterThan(0);
    expect(MOTIVO_RECHAZO_MAX).toBeGreaterThan(MOTIVO_RECHAZO_MIN);
  });
  it("falla cerrado sin versión revisada y no llama al servidor", async () => {
    await expect(aprobarFacturaProveedor(VALID_ID, true)).rejects.toMatchObject({ code: "LC_CONFLICTO_CONCURRENCIA" });
    expect(mock.rpcCalls).toHaveLength(0);
  });
});

describe("aprobarFacturaProveedor - RPC", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
  });

  it("aprueba y devuelve la fila", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", {
      data: { id: VALID_ID, estado_aprobacion: "aprobada" },
      error: null,
    });
    const res = await aprobarFacturaProveedor(VALID_ID, true, undefined, REVIEWED_VERSION);
    expect(res).toMatchObject({ id: VALID_ID });
    expect(mock.rpcCalls[0].fn).toBe("aprobar_factura_proveedor");
    expect(mock.rpcCalls[0].args).toMatchObject({ p_expected_updated_at: REVIEWED_VERSION });
  });

  it("data null → NOT_FOUND", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: null });
    await expect(aprobarFacturaProveedor(VALID_ID, true, undefined, REVIEWED_VERSION)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it.each([
    [{ code: "PGRST301", message: "jwt expired" }, "SESSION_EXPIRED"],
    [{ code: "42501", message: "permission denied" }, "FORBIDDEN"],
    [{ code: "PGRST116", message: "no rows" }, "NOT_FOUND"],
    [{ code: "PT409", message: "Versión obsoleta" }, "LC_CONFLICTO_CONCURRENCIA"],
    [{ code: "40001", message: "Versión obsoleta" }, "LC_CONFLICTO_CONCURRENCIA"],
    [{ message: "LC_CONFLICTO_CONCURRENCIA: versión obsoleta" }, "LC_CONFLICTO_CONCURRENCIA"],
    [{ message: "estado inválido: already_approved" }, "INVALID_STATE"],
    [{ message: "network error fetch failed" }, "NETWORK"],
    [{ message: "boom desconocido" }, "UNKNOWN"],
    // Fase O — validaciones de cuadre y consistencia.
    [{ message: "LC_CXP_SIN_CONCEPTOS: Captura los conceptos" }, "LC_CXP_SIN_CONCEPTOS"],
    [{ message: "LC_CXP_DESCUADRE: 100 vs 90" }, "LC_CXP_DESCUADRE"],
    [{ message: "LC_CXP_EMBARQUE_CANCELADO: embarque X" }, "LC_CXP_EMBARQUE_CANCELADO"],
    [{ message: "LC_CXP_EMBARQUE_ORG_MISMATCH: X" }, "LC_CXP_EMBARQUE_ORG_MISMATCH"],
    [{ message: "LC_CXP_EMBARQUE_NO_EXISTE: X" }, "LC_CXP_EMBARQUE_NO_EXISTE"],
    [{ message: "LC_CXP_UUID_NO_VERIFICADO: verifica" }, "LC_CXP_UUID_NO_VERIFICADO"],
  ])("mapea error RPC %j → %s", async (rpcError, expectedCode) => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: rpcError });
    await expect(aprobarFacturaProveedor(VALID_ID, true, undefined, REVIEWED_VERSION)).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it("rechaza con motivo válido llama RPC con p_motivo trimmed", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", {
      data: { id: VALID_ID },
      error: null,
    });
    await aprobarFacturaProveedor(VALID_ID, false, "  motivo válido  ", REVIEWED_VERSION);
    const call = mock.rpcCalls[0].args as { p_motivo: string };
    expect(call.p_motivo).toBe("motivo válido");
  });
});
