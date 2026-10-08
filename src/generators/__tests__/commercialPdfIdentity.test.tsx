import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const mocks = vi.hoisted(() => ({ emisor: vi.fn(), download: vi.fn(), containers: vi.fn() }));
vi.mock("@/pdf/emisor", () => ({ cargarEmisorDocumento: mocks.emisor }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: mocks.download }));
vi.mock("@/features/catalogos/services", () => ({ fetchTiposContenedor: mocks.containers }));
vi.mock("@/pdf/documents/CotizacionDocument", () => ({ CotizacionDocument: () => null }));
vi.mock("@/pdf/documents/ProformaDocument", () => ({ ProformaDocument: () => null }));
vi.mock("@/pdf/documents/ProformaConsolidadaDocument", () => ({ ProformaConsolidadaDocument: () => null }));

import { generarPdfCotizacion } from "../cotizacionPdf";
import { generarPdfProforma } from "../proformaPdf";

const emisor = { organizacionNombre: "Comercial Sintética", razonSocial: "Empresa", rfc: "" };
// SAFE-CAST: el adaptador no interpreta el resto de las columnas; sólo las pasa al Document mockeado.
const proforma = { organization_id: "org-a", numero: "P-1", es_consolidada: false } as Parameters<typeof generarPdfProforma>[0]["proforma"];
const embarque = { expediente: "E-1" } as Parameters<typeof generarPdfProforma>[0]["embarque"];

beforeEach(() => {
  vi.resetAllMocks();
  setAuthSnapshot({ userId: "u1", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "u1", organizationId: "org-a" });
  mocks.emisor.mockResolvedValue(emisor);
  mocks.containers.mockResolvedValue([]);
  mocks.download.mockResolvedValue(undefined);
});

describe("identidad de PDFs comerciales", () => {
  it("solicita identidad por org de cotización y usa el nombre comercial en el archivo", async () => {
    await generarPdfCotizacion(makeCotizacionRow({ organization_id: "org-a" }));
    expect(mocks.emisor).toHaveBeenCalledWith("org-a");
    const [document, filename] = mocks.download.mock.calls[0];
    expect(document.props.emisor).toEqual(emisor);
    expect(filename).toContain("Comercial_Sintetica_");
  });

  it.each([false, true])("proforma consolidada=%s conserva la org persistida y los campos fiscales", async (consolidada) => {
    await generarPdfProforma({
      proforma: { ...proforma, es_consolidada: consolidada }, embarque, conceptos: [],
      // SAFE-CAST: basta una fila para seleccionar el Document consolidado mockeado.
      conceptosConsolidados: consolidada ? [{ id: "concepto-a" } as NonNullable<Parameters<typeof generarPdfProforma>[0]["conceptosConsolidados"]>[number]] : [],
    });
    expect(mocks.emisor).toHaveBeenCalledWith("org-a");
    const [document, filename] = mocks.download.mock.calls[0];
    expect(document.props.emisor).toEqual(emisor);
    expect(filename).toContain("Comercial_Sintetica_P-1-proforma");
  });

  it("propaga rechazo de identidad cruzada sin descargar", async () => {
    mocks.emisor.mockRejectedValue(new Error("La organización del documento no coincide"));
    await expect(generarPdfCotizacion(makeCotizacionRow({ organization_id: "org-b" }))).rejects.toThrow("no coincide");
    await expect(generarPdfProforma({ proforma: { ...proforma, organization_id: "org-b" }, embarque, conceptos: [] })).rejects.toThrow("no coincide");
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("cancela cotización si cambia el tenant mientras espera el catálogo", async () => {
    let finish!: (value: never[]) => void;
    mocks.containers.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = generarPdfCotizacion(makeCotizacionRow({ organization_id: "org-a" }));
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org-b" });
    finish([]);
    await expect(pending).rejects.toThrow("cambió el usuario o la organización");
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("cancela proforma si cambia el tenant durante la carga de identidad", async () => {
    const pending = generarPdfProforma({ proforma, embarque, conceptos: [] });
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org-b" });
    await expect(pending).rejects.toThrow("cambió el usuario o la organización");
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
