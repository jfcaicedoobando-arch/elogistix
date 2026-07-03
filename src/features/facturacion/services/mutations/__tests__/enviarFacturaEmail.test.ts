import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase client
const getSessionMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));

// Mock fetchConReintento to control network responses
const fetchConReintentoMock = vi.fn();
vi.mock("@/features/cotizacion/services/mutations/enviarPorEmail", () => ({
  fetchConReintento: fetchConReintentoMock,
  OFFLINE_MSG: "Sin conexión",
}));

import { enviarFacturaPorEmail } from "../enviarFacturaEmail";

const input = {
  facturaId: "fac-1",
  destinatarios: [{ email: "cli@x.com", nombre: "Cli" }],
  cc: ["me@x.com"],
  asunto: "Factura",
  mensaje: "Hola",
  totalFormateado: "$1,000.00",
  ejecutivo: { nombre: "Ana" },
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("enviarFacturaPorEmail", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    fetchConReintentoMock.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it("lanza si no hay sesión (access_token ausente)", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    await expect(enviarFacturaPorEmail(input)).rejects.toThrow(/sesión/i);
    expect(fetchConReintentoMock).not.toHaveBeenCalled();
  });

  it("envía Authorization Bearer y devuelve el resultado parseado", async () => {
    getSessionMock.mockResolvedValue({
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
    fetchConReintentoMock.mockResolvedValue(jsonResponse(ok));

    const res = await enviarFacturaPorEmail(input);

    expect(fetchConReintentoMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchConReintentoMock.mock.calls[0];
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
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "t" } },
    });
    fetchConReintentoMock.mockResolvedValue(
      jsonResponse({ error: "boom" }, 500),
    );
    await expect(enviarFacturaPorEmail(input)).rejects.toThrow(/500.*boom/);
  });

  it("envuelve fallos de red con mensaje amistoso", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "t" } },
    });
    fetchConReintentoMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(enviarFacturaPorEmail(input)).rejects.toThrow(
      /No se pudo contactar/,
    );
  });
});
