import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import { esUrlFacturapi, fetchCfdiFacturapi, descargarCfdiFacturapi } from "../descargarCfdiFacturapi";

beforeEach(() => {
  getSession.mockReset();
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "proj");
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
  it("requiere algún id", async () => {
    await expect(fetchCfdiFacturapi({ tipo: "pdf" })).rejects.toThrow(/requerido/);
  });

  it("requiere sesión activa", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(fetchCfdiFacturapi({ tipo: "pdf", facturaId: "f" })).rejects.toThrow(/Sesión expirada/);
  });

  it("descarga blob y extrae filename del Content-Disposition", async () => {
    getSession.mockResolvedValueOnce({ data: { session: { access_token: "t" } } });
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
    getSession.mockResolvedValueOnce({ data: { session: { access_token: "t" } } });
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
    getSession.mockResolvedValueOnce({ data: { session: { access_token: "t" } } });
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
    getSession.mockResolvedValueOnce({ data: { session: { access_token: "t" } } });
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
    getSession.mockResolvedValueOnce({ data: { session: { access_token: "t" } } });
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
    try {
      await descargarCfdiFacturapi({ tipo: "pdf", facturaId: "f1" });
      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      clickSpy.mockRestore();
    }
  });
});
