import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFacturasParaZip } from "../masivas";
import { fetchCfdiFacturapi } from "../descargarCfdiFacturapi";
import { generarZipFacturas } from "../masivasZip";

vi.mock("../masivas", () => ({ fetchFacturasParaZip: vi.fn() }));
vi.mock("../descargarCfdiFacturapi", () => ({
  fetchCfdiFacturapi: vi.fn(),
  esUrlFacturapi: (url: string) => url.includes("facturapi.io"),
}));

const scope = { organizationId: "org-1", isCurrent: () => true, assertCurrent: () => {} };

describe("ZIP de facturas seleccionadas", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("incluye XML sin PDF, evita sobrescribir folios y reporta documentos y filas ausentes", async () => {
    vi.mocked(fetchFacturasParaZip).mockResolvedValue([
      { id: "a", numero: "F-1", factura_pdf_url: "https://storage.invalid/a.pdf", factura_xml_url: null },
      { id: "b", numero: "F-1", factura_pdf_url: "https://www.facturapi.io/b.pdf", factura_xml_url: null },
    ]);
    const fetch = vi.fn(async () => new Response("pdf a"));
    vi.stubGlobal("fetch", fetch);
    vi.mocked(fetchCfdiFacturapi).mockImplementation(async ({ facturaId, tipo }) => {
      if (tipo === "pdf") throw new Error("PDF ausente");
      return { blob: new Blob([`xml ${facturaId}`]), filename: "documento.xml" };
    });
    const onProgress = vi.fn();
    const { archivo, facturas } = await generarZipFacturas(["a", "b", "c"], { scope, onProgress });
    expect(facturas).toEqual([
      { facturaId: "a", numero: "F-1", incluidos: ["pdf", "xml"], faltantes: [] },
      { facturaId: "b", numero: "F-1", incluidos: ["xml"], faltantes: ["pdf"] },
      { facturaId: "c", numero: null, incluidos: [], faltantes: ["pdf", "xml"] },
    ]);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("https://storage.invalid/a.pdf");
    const zip = await JSZip.loadAsync(await archivo!.arrayBuffer());
    expect(await zip.file("facturas/F-1.pdf")?.async("string")).toBe("pdf a");
    expect(await zip.file("facturas/F-1.xml")?.async("string")).toBe("xml a");
    expect(await zip.file("facturas/F-1-2.xml")?.async("string")).toBe("xml b");
  });

  it("evita descargar un ZIP vacío cuando faltan todos los archivos", async () => {
    vi.mocked(fetchFacturasParaZip).mockResolvedValue([
      { id: "a", numero: "F-1", factura_pdf_url: null, factura_xml_url: null },
    ]);
    vi.mocked(fetchCfdiFacturapi).mockResolvedValue({ blob: new Blob([]), filename: "vacio" });
    await expect(generarZipFacturas(["a"], { scope })).resolves.toEqual({
      archivo: null,
      facturas: [{ facturaId: "a", numero: "F-1", incluidos: [], faltantes: ["pdf", "xml"] }],
    });
  });
});
