import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  aprobarFacturaProveedor,
  AprobacionFacturaError,
  MOTIVO_RECHAZO_MAX,
} from "../aprobacionFactura";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("aprobarFacturaProveedor — validaciones", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("rechaza UUID inválido antes de llamar al RPC", async () => {
    await expect(aprobarFacturaProveedor("f1", true)).rejects.toMatchObject({
      name: "AprobacionFacturaError",
      code: "INVALID_ID",
    });
  });

  it("exige motivo mínimo al rechazar", async () => {
    await expect(aprobarFacturaProveedor(UUID, false, "  ")).rejects.toMatchObject({
      code: "MOTIVO_REQUIRED",
    });
    await expect(aprobarFacturaProveedor(UUID, false, "ab")).rejects.toMatchObject({
      code: "MOTIVO_REQUIRED",
    });
  });

  it("rechaza motivo mayor al máximo", async () => {
    const largo = "x".repeat(MOTIVO_RECHAZO_MAX + 1);
    await expect(aprobarFacturaProveedor(UUID, false, largo)).rejects.toMatchObject({
      code: "MOTIVO_TOO_LONG",
    });
  });
});

describe("aprobarFacturaProveedor — RPC", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("invoca RPC al aprobar con UUID válido", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: { id: UUID, estado: "Vigente" }, error: null });
    const r = await aprobarFacturaProveedor(UUID, true);
    expect(r.id).toBe(UUID);
  });

  it("acepta motivo válido al rechazar", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: { id: UUID }, error: null });
    const r = await aprobarFacturaProveedor(UUID, false, "  duplicada  ");
    expect(r.id).toBe(UUID);
  });

  it("mapea error de permisos a FORBIDDEN", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: { message: "no_role", code: "42501" } });
    await expect(aprobarFacturaProveedor(UUID, true)).rejects.toMatchObject({
      name: "AprobacionFacturaError",
      code: "FORBIDDEN",
    });
  });

  it("mapea error de sesión expirada", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: { message: "JWT expired", code: "PGRST301" } });
    await expect(aprobarFacturaProveedor(UUID, true)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("mapea error de estado inválido", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: { message: "factura already_approved" } });
    await expect(aprobarFacturaProveedor(UUID, true)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("lanza NOT_FOUND si data es null sin error", async () => {
    mock.setRpcResult("aprobar_factura_proveedor", { data: null, error: null });
    await expect(aprobarFacturaProveedor(UUID, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("errores del servicio son instancias de AprobacionFacturaError", async () => {
    try {
      await aprobarFacturaProveedor("no-uuid", true);
    } catch (e) {
      expect(e).toBeInstanceOf(AprobacionFacturaError);
    }
  });
});
