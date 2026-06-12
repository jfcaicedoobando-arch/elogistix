import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@sentry/react", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  startSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
}));

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: "tok-abc" } },
    }),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { parseCfdiXml } from "@/services/cxp/parseCfdi";

const xmlFile = () =>
  new File(["<cfdi/>"], "factura.xml", { type: "application/xml" });

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
});
afterEach(() => {
  vi.restoreAllMocks();
  supabaseMock.auth.getSession.mockResolvedValue({
    data: { session: { access_token: "tok-abc" } },
  });
});

describe("parseCfdiXml", () => {
  it("envía multipart con Authorization Bearer y devuelve el JSON parseado", async () => {
    const payload = { cfdi: { uuid: "abc" }, ai: { categoria_id: null, notas: "" } };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await parseCfdiXml(xmlFile(), [{ id: "c1", nombre: "Fletes" }]);

    expect(result).toEqual(payload);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/functions/v1/parse-cfdi-xml");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization)
      .toBe("Bearer tok-abc");
  });

  it("propaga error con el mensaje del servidor cuando ok=false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "XML malformado" }),
    }));
    await expect(parseCfdiXml(xmlFile(), [])).rejects.toThrow("XML malformado");
  });

  it("usa mensaje genérico si el servidor no devuelve JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error("not json"); },
    }));
    await expect(parseCfdiXml(xmlFile(), [])).rejects.toThrow("Error al procesar el XML");
  });

  it("falla si no hay sesión activa", async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(parseCfdiXml(xmlFile(), [])).rejects.toThrow();
  });
});
