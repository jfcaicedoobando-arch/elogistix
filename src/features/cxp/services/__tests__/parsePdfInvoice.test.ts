/**
 * v13.823.4 — El cliente de `parse-invoice-pdf` debe enviar la organización
 * activa en el header `x-organization-id` (no en el multipart), para que la
 * edge function autorice antes de bufferar el PDF de hasta 10 MB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  });
});
