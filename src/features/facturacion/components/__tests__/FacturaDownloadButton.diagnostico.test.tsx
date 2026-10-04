import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { DescargaCfdiError } from "@/features/facturacion/domain/descargaCfdiError";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const { descargar, notifyError } = vi.hoisted(() => ({ descargar: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/features/facturacion/services/descargarCfdiFacturapi", () => ({
  descargarCfdiFacturapi: descargar, esUrlFacturapi: () => true,
}));
vi.mock("@/services/storage", () => ({ openFacturaInNewTab: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError }));
vi.mock("@/components/shared/Hint", () => ({ Hint: ({ children }: { children: ReactNode }) => children }));
import { FacturaDownloadButton } from "../FacturaDownloadButton";

function changeContext(change: string) {
  if (change === "usuario") setAuthSnapshot({ userId: "u2", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  else syncActiveOrganizationScope({ userId: "u1", organizationId: "org2" });
}
beforeEach(() => {
  vi.clearAllMocks();
  setAuthSnapshot({ userId: "u1", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "u1", organizationId: "org1" });
});

describe("35: diagnóstico de descarga de NC", () => {
  it.each(["usuario", "organizacion"])("no ofrece toast de la NC anterior tras cambio de %s", async (change) => {
    let reject!: (error: Error) => void;
    descargar.mockReturnValueOnce(new Promise<void>((_done, fail) => { reject = fail; }));
    render(<FacturaDownloadButton stored={null} kind="xml" notaCreditoId="nc-original" />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar XML" }));
    changeContext(change);
    await act(async () => { reject(new DescargaCfdiError("unauthorized", 401, "unauthorized")); });
    expect(notifyError).not.toHaveBeenCalled();
  });

  it.each(["usuario", "organizacion"])("acción previa no reenvía el documento después de cambio de %s", async (change) => {
    descargar.mockRejectedValueOnce(new DescargaCfdiError("unauthorized", 401, "unauthorized"));
    render(<FacturaDownloadButton stored={null} kind="xml" notaCreditoId="nc-original" />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar XML" }));
    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
    const action = notifyError.mock.calls[0][1].action;
    changeContext(change);
    await act(async () => { action.onClick(); });
    expect(descargar).toHaveBeenCalledTimes(1);
  });

  it("401 conserva error, NC y correlación y ofrece reintento seguro", async () => {
    const error = new DescargaCfdiError("unauthorized", 401, "unauthorized", "req-reintento", "req-original");
    descargar.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    render(<FacturaDownloadButton stored={null} kind="xml" notaCreditoId="nc-original" />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar XML" }));
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    const opts = notifyError.mock.calls[0][1];
    expect(opts.description).toMatch(/validar tu sesión/);
    expect(opts.description).not.toMatch(/internet|expir/i);
    expect(opts.error).toBe(error);
    expect(opts.requestId).toBe("req-reintento");
    expect(opts.context).toMatchObject({ notaCreditoId: "nc-original", tipo: "xml", originalRequestId: "req-original" });
    expect(JSON.stringify(opts.context)).not.toMatch(/Bearer|token|apikey/);
    opts.action.onClick();
    await waitFor(() => expect(descargar).toHaveBeenCalledTimes(2));
    expect(descargar.mock.calls[1][0]).toMatchObject({ tipo: "xml", notaCreditoId: "nc-original" });
  });

  it.each([
    [new TypeError("Failed to fetch"), /conexión a internet/],
    [new DescargaCfdiError("forbidden", 403, "forbidden"), /permiso/],
    [new DescargaCfdiError("nota_credito_not_found", 404, "nota_credito_not_found"), /archivo disponible/],
  ])("orienta según la clase sin navegación ni reautenticación innecesaria", async (error, message) => {
    descargar.mockRejectedValueOnce(error);
    render(<FacturaDownloadButton stored={null} kind="xml" notaCreditoId="nc-original" />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar XML" }));
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][1]).toMatchObject({ description: expect.stringMatching(message), action: undefined });
  });
});
