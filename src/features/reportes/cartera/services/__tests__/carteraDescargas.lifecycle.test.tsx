import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { descargarCarteraPdf } from "../carteraDescargas";

const mocks = vi.hoisted(() => ({ pdf: vi.fn(), render: vi.fn(), download: vi.fn(), issuer: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/features/facturacion/services", () => ({ fetchCobranza: vi.fn(), fetchCobranzaKpis: vi.fn() }));
vi.mock("@/features/cxp/services", () => ({ fetchFacturasCxP: vi.fn() }));
vi.mock("@/services/organization", () => ({ getSuperAdminOrg: vi.fn() }));
vi.mock("@react-pdf/renderer", () => ({ pdf: mocks.pdf }));
vi.mock("@/pdf/documents/ReporteCarteraDocument", () => ({ ReporteCarteraDocument: () => null }));
vi.mock("@/features/configuracion/services/emisorPdf", () => ({ fetchEmisorReporte: mocks.issuer }));
vi.mock("@/lib/downloadBlob", () => ({ descargarBlob: mocks.download }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error, notifyWarning: vi.fn() }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-10-13" }));

beforeEach(() => {
  vi.resetAllMocks();
  setAuthSnapshot({ userId: "user-a", email: null, organizationId: "org-a", organizationName: null, role: "admin", effectiveRole: "admin" });
  mocks.pdf.mockReturnValue({ toBlob: mocks.render });
  mocks.render.mockResolvedValue(new Blob(["synthetic PDF"]));
  mocks.issuer.mockResolvedValue(undefined);
});

function exportWith(signal?: AbortSignal, sigueVigente?: () => boolean) {
  return descargarCarteraPdf("2026-10-13", "TC", [], captureAuthDataScope(), { signal, sigueVigente });
}

describe("Cartera PDF cancellation checkpoints", () => {
  it("does no work for an already aborted job", async () => {
    const controller = new AbortController(); controller.abort();
    await exportWith(controller.signal);
    expect(mocks.issuer).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does no work for an already obsolete selection", async () => {
    await exportWith(undefined, () => false);
    expect(mocks.issuer).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("skips rendering when aborted during issuer loading", async () => {
    const controller = new AbortController();
    mocks.issuer.mockImplementation(async () => { controller.abort(); return undefined; });
    await exportWith(controller.signal);
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("does not download or notify when aborted during rendering", async () => {
    const controller = new AbortController();
    mocks.render.mockImplementation(async () => { controller.abort(); return new Blob(["obsolete"]); });
    await exportWith(controller.signal);
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each(["issuer", "renderer"])("silences %s rejection after explicit cancellation", async stage => {
    const controller = new AbortController();
    (stage === "issuer" ? mocks.issuer : mocks.render).mockImplementation(async () => { controller.abort(); throw new Error("obsolete failure"); });
    await exportWith(controller.signal);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("silences an obsolete selection's error without requiring an AbortSignal", async () => {
    let current = true;
    mocks.render.mockImplementation(async () => { current = false; throw new Error("obsolete failure"); });
    await exportWith(undefined, () => current);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each(["issuer", "renderer", "download"])("preserves actionable current %s errors", async stage => {
    const error = new Error(`Current ${stage} failure`);
    if (stage === "issuer") mocks.issuer.mockRejectedValue(error);
    else if (stage === "renderer") mocks.render.mockRejectedValue(error);
    else mocks.download.mockImplementation(() => { throw error; });
    await exportWith(new AbortController().signal);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(undefined, expect.objectContaining({ error, method: "CARTERA_AGING_PDF" }));
  });

  it("a live signal and current selection still permit one successful download", async () => {
    await exportWith(new AbortController().signal, () => true);
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), "cartera-antiguedad-2026-10-13.pdf");
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
  });
});
