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
    const res = await aprobarFacturaProveedor(VALID_ID, true);
    expect(res).toMatchObject({ id: VALID_ID });
    expect(mock.rpcCalls[0].fn).toBe("aprobar_factura_proveedor");
  });

  it("data null → NOT_FOUND", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: null });
    await expect(aprobarFacturaProveedor(VALID_ID, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it.each([
    [{ code: "PGRST301", message: "jwt expired" }, "SESSION_EXPIRED"],
    [{ code: "42501", message: "permission denied" }, "FORBIDDEN"],
    [{ code: "PGRST116", message: "no rows" }, "NOT_FOUND"],
    [{ message: "estado inválido: already_approved" }, "INVALID_STATE"],
    [{ message: "network error fetch failed" }, "NETWORK"],
    [{ message: "boom desconocido" }, "UNKNOWN"],
  ])("mapea error RPC %j → %s", async (rpcError, expectedCode) => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: rpcError });
    await expect(aprobarFacturaProveedor(VALID_ID, true)).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it("rechaza con motivo válido llama RPC con p_motivo trimmed", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", {
      data: { id: VALID_ID },
      error: null,
    });
    await aprobarFacturaProveedor(VALID_ID, false, "  motivo válido  ");
    const call = mock.rpcCalls[0].args as { p_motivo: string };
    expect(call.p_motivo).toBe("motivo válido");
  });
});
