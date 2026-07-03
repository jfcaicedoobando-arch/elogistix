import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetchConReintento: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock("@/features/cotizacion/services/mutations/enviarPorEmail", () => ({
  fetchConReintento: mocks.fetchConReintento,
  OFFLINE_MSG: "Sin conexión",
}));

import { enviarFacturaPorEmail } from "../enviarFacturaEmail";

import type { EnviarFacturaEmailInput } from "../enviarFacturaEmail";

const input: EnviarFacturaEmailInput = {
  facturaId: "fac-1",
  destinatarios: [{ email: "cli@x.com", nombre: "Cli" }],
  cc: ["me@x.com"],
  asunto: "Factura",
  mensaje: "Hola",
  totalFormateado: "$1,000.00",
  ejecutivo: { nombre: "Ana" },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("enviarFacturaPorEmail", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.fetchConReintento.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it("lanza si no hay sesión (access_token ausente)", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await expect(enviarFacturaPorEmail(input)).rejects.toThrow(/sesión/i);
    expect(mocks.fetchConReintento).not.toHaveBeenCalled();
  });

  it("envía Authorization Bearer y devuelve el resultado parseado", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "tok-abc" } },
    });
    const ok = {
      success: true,
      estado: "enviado",
      envio_id: "env-1",
      resultados: [{ email: "cli@x.com", tipo: "to", ok: true }],
      pdf_link: "https://p",
      xml_link: "https://x",
    };
    mocks.fetchConReintento.mockResolvedValue(jsonResponse(ok));

    const res = await enviarFacturaPorEmail(input);

    expect(mocks.fetchConReintento).toHaveBeenCalledTimes(1);
    const [, init] = mocks.fetchConReintento.mock.calls[0];
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-abc");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.factura_id).toBe("fac-1");
    expect(body.destinatarios).toHaveLength(1);
    expect(res.estado).toBe("enviado");
    expect(res.envio_id).toBe("env-1");
  });

  it("lanza con status cuando la respuesta no es ok", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
    });
    mocks.fetchConReintento.mockResolvedValue(
      jsonResponse({ error: "boom" }, 500),
    );
    await expect(enviarFacturaPorEmail(input)).rejects.toThrow(/500.*boom/);
  });

  it("envuelve fallos de red con mensaje amistoso", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "t" } },
    });
    mocks.fetchConReintento.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(enviarFacturaPorEmail(input)).rejects.toThrow(
      /No se pudo contactar/,
    );
  });
});
