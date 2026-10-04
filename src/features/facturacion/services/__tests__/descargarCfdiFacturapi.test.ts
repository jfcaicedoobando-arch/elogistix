import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getSession, refreshSession } = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, refreshSession } },
}));

import { esUrlFacturapi, fetchCfdiFacturapi, descargarCfdiFacturapi } from "../descargarCfdiFacturapi";

beforeEach(() => {
  getSession.mockReset();
  refreshSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: "user-sintetico" }, access_token: "t", expires_at: Date.now() / 1000 + 3600 } } });
  vi.stubEnv("VITE_SUPABASE_URL", "https://configured.example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
});
afterEach(() => {
  // vi.stubGlobal + unstubAllGlobals evita el leak de fetch entre archivos
  // del shard bajo singleFork (auditoría 13.137.28 - ALTA).
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("esUrlFacturapi", () => {
  it.each([
    [null, false],
    [undefined, false],
    ["", false],
    ["https://other.com/cfdi", false],
    ["https://www.facturapi.io/file.pdf", true],
  ])("(%s) → %s", (input, expected) => {
    expect(esUrlFacturapi(input as string | null)).toBe(expected);
  });
});

describe("fetchCfdiFacturapi", () => {
  const rotatedSession = (token: string) => {
    const session = { user: { id: "user-sintetico" }, access_token: token, expires_at: Date.now() / 1000 + 3600 };
    getSession.mockResolvedValue({ data: { session } });
    return { data: { session }, error: null };
  };
  const unauthorized = (requestId: string) => new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401, headers: { "x-request-id": requestId },
  });

  it("35: usa endpoint configurado, sesión vigente y API key pública para la misma NC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("xml", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" });
    expect(fetchMock).toHaveBeenCalledWith("https://configured.example.invalid/functions/v1/facturapi-descargar", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer t", apikey: "public-test-key" }),
      body: JSON.stringify({ tipo: "xml", nota_credito_id: "nc-original" }),
    }));
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("35: un 401 recupera una credencial diferente y repite sólo la misma lectura", async () => {
    refreshSession.mockImplementation(async () => rotatedSession("rotado"));
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized("req-original")).mockResolvedValueOnce(new Response("xml"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: { Authorization: "Bearer rotado" },
      body: fetchMock.mock.calls[0][1].body,
    });
  });

  it("35: conserva ambos request IDs si la sesión recuperada también es rechazada", async () => {
    refreshSession.mockImplementation(async () => rotatedSession("rotado"));
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized("req-original")).mockResolvedValueOnce(unauthorized("req-reintento"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" })).rejects.toMatchObject({
      status: 401, code: "unauthorized", requestId: "req-reintento", originalRequestId: "req-original",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("35: no reenvía el token rechazado si el refresh devuelve el mismo", async () => {
    refreshSession.mockImplementation(async () => rotatedSession("t"));
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized("req-original"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" })).rejects.toMatchObject({ requestId: "req-original", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404, 422, 502])("35: respuesta %s conserva diagnóstico sin refrescar ni reintentar", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "documento_rechazado" }), { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" })).rejects.toMatchObject({ status, code: "documento_rechazado" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("35: un fallo de transporte no se convierte en rechazo de sesión", async () => {
    const transporte = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(transporte));
    await expect(fetchCfdiFacturapi({ tipo: "xml", notaCreditoId: "nc-original" })).rejects.toBe(transporte);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("requiere algún id", async () => {
    await expect(fetchCfdiFacturapi({ tipo: "pdf" })).rejects.toThrow(/requerido/);
  });

  it("requiere sesión activa", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(fetchCfdiFacturapi({ tipo: "pdf", facturaId: "f" })).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("descarga blob y extrae filename del Content-Disposition", async () => {
    const blob = new Blob(["x"]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(blob),
        headers: { get: () => 'attachment; filename="factura.pdf"' },
      }),
    );
    const res = await fetchCfdiFacturapi({ tipo: "pdf", facturaId: "f1" });
    expect(res.blob).toBe(blob);
    expect(res.filename).toBe("factura.pdf");
  });

  it("usa filename por default si no viene en headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob([])),
        headers: { get: () => "" },
      }),
    );
    const res = await fetchCfdiFacturapi({ tipo: "xml", pagoId: "p" });
    expect(res.filename).toBe("cfdi.xml");
  });

  it("lanza error con mensaje del body cuando !ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "boom" }),
      }),
    );
    await expect(fetchCfdiFacturapi({ tipo: "pdf", facturaId: "f" })).rejects.toThrow("boom");
  });

  it("cae a 'Error N' cuando el body no es JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error("not json")),
      }),
    );
    await expect(fetchCfdiFacturapi({ tipo: "pdf", facturaId: "f" })).rejects.toThrow("Error 503");
  });
});

describe("descargarCfdiFacturapi", () => {
  it("crea link y dispara click", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(["x"])),
        headers: { get: () => 'filename="f.pdf"' },
      }),
    );
    const createObjectURL = vi.fn().mockReturnValue("blob:url");
    const revokeObjectURL = vi.fn();
    // Auditoría 13.137.31: `Object.assign(URL, ...)` sin restauración dejaba los
    // métodos reemplazados para el resto del shard. Guardado/restauración explícita.
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    // Auditoría 13.137.34: usamos fake timers para flushear el `setTimeout(revokeObjectURL, 1000)`
    // del SUT antes de restaurar los originales — si no, el timer se dispara después del
    // afterEach y revoca contra `undefined` (jsdom no define URL.revokeObjectURL), provocando
    // "URL.revokeObjectURL is not a function" como unhandled error en el shard.
    vi.useFakeTimers();
    try {
      await descargarCfdiFacturapi({ tipo: "pdf", facturaId: "f1" });
      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:url");
    } finally {
      vi.useRealTimers();
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      clickSpy.mockRestore();
    }
  });
});
