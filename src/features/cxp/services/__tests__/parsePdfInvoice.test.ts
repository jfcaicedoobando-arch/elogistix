/**
 * v13.823.4 — El cliente de `parse-invoice-pdf` debe enviar la organización
 * activa en el header `x-organization-id` (no en el multipart), para que la
 * edge function autorice antes de bufferar el PDF de hasta 10 MB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

const { invokeMock, ensureFreshSessionMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  ensureFreshSessionMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));
vi.mock("@/lib/auth/ensureFreshSession", () => ({
  ensureFreshSession: ensureFreshSessionMock,
}));

import { parsePdfInvoice } from "../parsePdfInvoice";

const ORG_PRINCIPAL = "00000000-0000-0000-0000-000000000001";
const pdf = () => new File(["%PDF-1.4"], "factura.pdf", { type: "application/pdf" });

describe("parsePdfInvoice", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    ensureFreshSessionMock.mockReset();
    ensureFreshSessionMock.mockResolvedValue("token-1");
  });

  it("envía la organización activa en el header y no en el FormData", async () => {
    const payload = { cfdi: { uuid: "" }, ai: { categoria_id: null, notas: "" } };
    invokeMock.mockResolvedValue({ data: payload, error: null });

    const result = await parsePdfInvoice(pdf(), [{ id: "c1", nombre: "Fletes" }], ORG_PRINCIPAL);

    expect(result).toEqual(payload);
    const opciones = invokeMock.mock.calls[0][1];
    expect(opciones.headers["x-organization-id"]).toBe(ORG_PRINCIPAL);
    expect(opciones.headers.Authorization).toBe("Bearer token-1");
    expect((opciones.body as FormData).get("organization_id")).toBeNull();
    expect((opciones.body as FormData).get("file")).toBeInstanceOf(File);
    // R192-01: el primer envío usa la credencial vigente, sin forzar renovación.
    expect(ensureFreshSessionMock).toHaveBeenCalledWith(false, undefined);
  });

  it("no invoca la función si no hay sesión alguna", async () => {
    ensureFreshSessionMock.mockResolvedValue(null);

    await expect(parsePdfInvoice(pdf(), [], ORG_PRINCIPAL)).rejects.toThrow(
      /Debes iniciar sesión para procesar la factura PDF/,
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("renueva a la fuerza sólo en el reintento tras un 401", async () => {
    const payload = { cfdi: { uuid: "" }, ai: { categoria_id: null, notas: "" } };
    ensureFreshSessionMock.mockResolvedValueOnce("token-1").mockResolvedValueOnce("token-2");
    invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: new FunctionsHttpError(new Response(JSON.stringify({ error: "Token inválido" }), { status: 401 })),
      })
      .mockResolvedValueOnce({ data: payload, error: null });

    await expect(parsePdfInvoice(pdf(), [], ORG_PRINCIPAL)).resolves.toEqual(payload);
    expect(ensureFreshSessionMock.mock.calls).toEqual([
      [false, undefined],
      [true, "token-1"],
    ]);
    expect(invokeMock.mock.calls[1][1].headers.Authorization).toBe("Bearer token-2");
  }, 15000);

  it("pide reintentar, no relogin, si la renovación del reintento no es posible", async () => {
    ensureFreshSessionMock.mockResolvedValueOnce("token-1").mockResolvedValueOnce(null);
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ error: "Token inválido" }), { status: 401 })),
    });

    await expect(parsePdfInvoice(pdf(), [], ORG_PRINCIPAL)).rejects.toThrow(
      /No pudimos validar tu sesión en este momento/,
    );
    expect(invokeMock).toHaveBeenCalledTimes(1);
  }, 15000);

  it("no fuerza renovación al reintentar un error transitorio distinto de 401", async () => {
    const payload = { cfdi: { uuid: "" }, ai: { categoria_id: null, notas: "" } };
    invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: new FunctionsHttpError(new Response("", { status: 503 })),
      })
      .mockResolvedValueOnce({ data: payload, error: null });

    await expect(parsePdfInvoice(pdf(), [], ORG_PRINCIPAL)).resolves.toEqual(payload);
    expect(ensureFreshSessionMock.mock.calls).toEqual([
      [false, undefined],
      [false, undefined],
    ]);
  }, 15000);
});

/**
 * v13.823.16 (Sentry JAVASCRIPT-REACT-5T) · cuando la petición nunca llega al
 * servidor (FunctionsFetchError / "Failed to fetch" desde móvil), el mensaje
 * debe apuntar a la conexión del dispositivo, no a una caída del servicio.
 */
describe("parsePdfInvoice — mensajes de falla", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    ensureFreshSessionMock.mockReset();
    ensureFreshSessionMock.mockResolvedValue("token-1");
  });

  it("indica falla de conexión del dispositivo con FunctionsFetchError", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new TypeError("Failed to fetch")),
    });

    await expect(parsePdfInvoice(pdf(), [], ORG_PRINCIPAL)).rejects.toThrow(
      /No pudimos contactar al servidor desde este dispositivo/,
    );
  }, 15000);

  it("mantiene el mensaje del servicio cuando responde con error HTTP", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ error: "PDF ilegible" }), { status: 400 })),
    });

    await expect(parsePdfInvoice(pdf(), [], ORG_PRINCIPAL)).rejects.toThrow(/PDF ilegible/);
  }, 15000);
});
