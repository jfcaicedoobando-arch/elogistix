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
  functions: {
    invoke: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { parseCfdiXml, CfdiUploadError } from "@/features/cxp/services/parseCfdi";
import {
  FunctionsHttpError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

const xmlFile = () =>
  new File(["<cfdi/>"], "factura.xml", { type: "application/xml" });
const organizationId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  supabaseMock.auth.getSession.mockResolvedValue({
    data: { session: { access_token: "tok-abc" } },
  });
  supabaseMock.functions.invoke.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseCfdiXml", () => {
  it("invoca la edge function 'parse-cfdi-xml' con FormData y devuelve el JSON parseado", async () => {
    const payload = { cfdi: { uuid: "abc" }, ai: { categoria_id: null, notas: "" } };
    supabaseMock.functions.invoke.mockResolvedValue({ data: payload, error: null });

    const result = await parseCfdiXml(xmlFile(), [{ id: "c1", nombre: "Fletes" }], organizationId);

    expect(result).toEqual(payload);
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "parse-cfdi-xml",
      expect.objectContaining({ body: expect.any(FormData) }),
    );
    const opciones = supabaseMock.functions.invoke.mock.calls[0][1];
    expect(opciones.headers["x-organization-id"]).toBe(organizationId);
    expect((opciones.body as FormData).get("organization_id")).toBeNull();
  });

  it("envuelve FunctionsHttpError como CfdiUploadError fase 'response' con status", async () => {
    const fakeResponse = new Response(JSON.stringify({ error: "XML malformado" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    const httpError = new FunctionsHttpError(fakeResponse);
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: httpError });

    await expect(parseCfdiXml(xmlFile(), [], organizationId)).rejects.toMatchObject({
      name: "CfdiUploadError",
      context: { phase: "response", lastStatus: 400 },
    });
  });

  it("reintenta y envuelve FunctionsFetchError como fase 'request'", async () => {
    // v13.137.24: usamos fake timers para evitar los 4s reales de `sleep(BACKOFF)`
    // entre intentos. Con testTimeout=15s y singleFork bajo carga, los 4s reales
    // dejaban cero margen y producían flakes en CI.
    vi.useFakeTimers();
    try {
      const fetchError = new FunctionsFetchError(new TypeError("Failed to fetch"));
      supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: fetchError });

      const promise = parseCfdiXml(xmlFile(), [], organizationId).catch((e) => e);
      await vi.runAllTimersAsync();
      const caught = await promise;

      expect(caught).toBeInstanceOf(CfdiUploadError);
      expect((caught as CfdiUploadError).context.phase).toBe("request");
      expect((caught as CfdiUploadError).context.attemptCount).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falla si no hay sesión activa", async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(parseCfdiXml(xmlFile(), [], organizationId)).rejects.toThrow();
    expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();
  });
});
