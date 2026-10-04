import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const { fetchPdf, createPdf, notifyError } = vi.hoisted(() => ({ fetchPdf: vi.fn(), createPdf: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/features/facturacion/services/descargarCfdiFacturapi", () => ({ fetchCfdiFacturapi: fetchPdf, descargarCfdiFacturapi: vi.fn() }));
vi.mock("@/lib/pdf/blobPdfUrl", () => ({ crearUrlPdf: createPdf }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError }));
vi.mock("@/components/shared/FormDialogShell", () => ({ FormDialogShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/shared/PdfObjectViewer", () => ({ PdfObjectViewer: () => <div /> }));
import { DialogPreviewCfdiPdf } from "../DialogPreviewCfdiPdf";

beforeEach(() => {
  vi.clearAllMocks();
  setAuthSnapshot({ userId: "u1", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "u1", organizationId: "org1" });
});
describe("35: callbacks tardíos de preview", () => {
  it.each(["blob", "error"])("cambio de tenant cancela callback %s, vista y toast de la NC anterior", async (result) => {
    let resolve!: (value: { blob: Blob; filename: string }) => void;
    let reject!: (error: Error) => void;
    fetchPdf.mockReturnValueOnce(new Promise<{ blob: Blob; filename: string }>((done, fail) => { resolve = done; reject = fail; }));
    const close = vi.fn();
    render(<DialogPreviewCfdiPdf open onOpenChange={close} notaCreditoId="nc-original" title="NC sintética" />);
    expect(fetchPdf).toHaveBeenCalledWith({ tipo: "pdf", facturaId: undefined, pagoId: undefined, notaCreditoId: "nc-original" });
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
    await act(async () => {
      if (result === "blob") resolve({ blob: new Blob(["pdf-sintetico"]), filename: "sintetico.pdf" });
      else reject(new Error("unauthorized"));
    });
    expect(createPdf).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
});
