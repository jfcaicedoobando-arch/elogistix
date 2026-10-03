/**
 * @vitest-environment jsdom
 *
 * Branches del callback retornado:
 *  - stored=null + facturaId → usa proxy.
 *  - stored es URL de Facturapi → usa proxy.
 *  - stored es URL stored normal → openFacturaInNewTab.
 *  - usarProxy=true pero sin facturaId → no hace nada.
 *  - error en proxy → notifyError + reportCaughtError.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const openFacturaInNewTab = vi.fn();
const descargarCfdiFacturapi = vi.fn();
const esUrlFacturapi = vi.fn();
const notifyError = vi.fn();
const reportCaughtError = vi.fn();
const toast = vi.fn();

vi.mock("@/services/storage", () => ({
  openFacturaInNewTab: (...a: unknown[]) => openFacturaInNewTab(...a),
}));
vi.mock("@/features/facturacion/services/descargarCfdiFacturapi", () => ({
  descargarCfdiFacturapi: (...a: unknown[]) => descargarCfdiFacturapi(...a),
  esUrlFacturapi: (...a: unknown[]) => esUrlFacturapi(...a),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
}));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: (...a: unknown[]) => reportCaughtError(...a),
}));

import { useDescargarCfdi } from "../useDescargarCfdi";
import { buildErrorReport } from "@/lib/ui/errorReport";

beforeEach(() => {
  openFacturaInNewTab.mockReset();
  descargarCfdiFacturapi.mockReset();
  esUrlFacturapi.mockReset();
  notifyError.mockReset();
  reportCaughtError.mockReset();
  toast.mockReset();
});

describe("useDescargarCfdi", () => {
  it("stored=null + facturaId definido → llama descargarCfdiFacturapi", async () => {
    descargarCfdiFacturapi.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDescargarCfdi("fac-1"));

    await act(async () => {
      await result.current(null, "pdf");
    });

    expect(descargarCfdiFacturapi).toHaveBeenCalledWith({ tipo: "pdf", facturaId: "fac-1" });
    expect(openFacturaInNewTab).not.toHaveBeenCalled();
  });

  it("URL de Facturapi → usa proxy (no llama openFacturaInNewTab)", async () => {
    esUrlFacturapi.mockReturnValue(true);
    descargarCfdiFacturapi.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDescargarCfdi("fac-2"));

    await act(async () => {
      await result.current("https://facturapi.io/cfdi/abc", "xml");
    });

    expect(esUrlFacturapi).toHaveBeenCalledWith("https://facturapi.io/cfdi/abc");
    expect(descargarCfdiFacturapi).toHaveBeenCalledWith({ tipo: "xml", facturaId: "fac-2" });
    expect(openFacturaInNewTab).not.toHaveBeenCalled();
  });

  it("URL almacenada normal → abre via openFacturaInNewTab", async () => {
    esUrlFacturapi.mockReturnValue(false);
    openFacturaInNewTab.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDescargarCfdi("fac-3"));

    await act(async () => {
      await result.current("https://storage.example.com/factura.pdf", "pdf");
    });

    expect(openFacturaInNewTab).toHaveBeenCalledWith("https://storage.example.com/factura.pdf");
    expect(descargarCfdiFacturapi).not.toHaveBeenCalled();
  });

  it("usarProxy=true pero sin facturaId → no llama ningún servicio (rama silenciosa)", async () => {
    const { result } = renderHook(() => useDescargarCfdi(undefined));

    await act(async () => {
      await result.current(null, "pdf");
    });

    expect(descargarCfdiFacturapi).not.toHaveBeenCalled();
    expect(openFacturaInNewTab).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("error en proxy → reportCaughtError + notifyError con tipo en mayúsculas", async () => {
    descargarCfdiFacturapi.mockRejectedValue(new Error("falló descarga"));
    const { result } = renderHook(() => useDescargarCfdi("fac-4"));

    await act(async () => {
      await result.current(null, "xml");
    });

    expect(reportCaughtError).toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError.mock.calls[0]![1].title).toContain("XML");
  });

  it("el JSON conserva diagnóstico del proveedor sin convertir una caída de servicio en validación", async () => {
    const error = Object.assign(new Error("Proveedor no disponible"), {
      status: 503, requestId: "backend-download-123", logId: "provider-log-123",
    });
    descargarCfdiFacturapi.mockRejectedValue(error);
    const { result } = renderHook(() => useDescargarCfdi("fac-5"));
    await act(async () => { await result.current(null, "pdf"); });
    const options = notifyError.mock.calls[0]![1];
    expect(options.error).toBe(error);
    expect(options.errorCode).toBeUndefined();
    expect(buildErrorReport(options)).toMatchObject({
      requestId: "backend-download-123", errorCode: "SERVER_ERROR", method: "FACTURACION_DESCARGAR_CFDI",
      context: { facturaId: "fac-5", tipo: "pdf" },
      errorDetails: { status: 503, logId: "provider-log-123" },
    });
  });
});
