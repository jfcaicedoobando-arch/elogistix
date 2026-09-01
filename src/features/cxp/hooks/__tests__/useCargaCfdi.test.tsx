/**
 * Tests para `useCargaCfdi`: validación de archivo (extensión, tamaño),
 * happy path con `parseCfdiXml`, timeout cliente y mapeo de fase de
 * `CfdiUploadError` al título del toast.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const parseCfdiXml = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: (_t: unknown, opts: { title: string }) => toastSuccess(opts.title),
}));
vi.mock("@/hooks/shared/useOrgActiva", () => ({
  useOrgActiva: () => ({ organizationId: "22222222-2222-4222-8222-222222222222" }),
}));
vi.mock("@/features/cxp/services", async () => {
  const actual = await vi.importActual<typeof import("@/features/cxp/services/parseCfdi.types")>(
    "@/features/cxp/services/parseCfdi.types",
  );
  return {
    parseCfdiXml: (...a: unknown[]) => parseCfdiXml(...a),
    CfdiUploadError: actual.CfdiUploadError,
  };
});

import { useCargaCfdi } from "../useCargaCfdi";
import { CfdiUploadError } from "@/features/cxp/services/parseCfdi.types";

const onParsed = vi.fn();
const categorias = [{ id: "c1", nombre: "Cat 1" }];

const makeXml = (size = 100, name = "f.xml") =>
  new File([new Uint8Array(size)], name, { type: "application/xml" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCargaCfdi", () => {
  it("rechaza archivos que no terminan en .xml", () => {
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    act(() => result.current.handleXml(new File(["x"], "foo.txt")));
    expect(result.current.xml).toBeNull();
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: expect.stringMatching(/\.xml/i),
    }));
  });

  it("rechaza XML mayor a 2 MB", () => {
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    act(() => result.current.handleXml(makeXml(2 * 1024 * 1024 + 1)));
    expect(result.current.xml).toBeNull();
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: expect.stringMatching(/2 MB/),
    }));
  });

  it("ignora null en handleXml sin tocar estado", () => {
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    act(() => result.current.handleXml(null));
    expect(result.current.xml).toBeNull();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("procesar happy path llama parseCfdiXml y onParsed", async () => {
    const data = { cfdi: { uuid: "U" }, ai: {} };
    parseCfdiXml.mockResolvedValueOnce(data);
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    const xml = makeXml(50);
    act(() => result.current.handleXml(xml));
    await act(async () => { await result.current.procesar(); });
    expect(parseCfdiXml).toHaveBeenCalledWith(
      xml,
      categorias,
      "22222222-2222-4222-8222-222222222222",
    );
    expect(onParsed).toHaveBeenCalledWith(data, { xml, pdf: null });
    expect(toastSuccess).toHaveBeenCalledWith("CFDI procesado");
    expect(result.current.loading).toBe(false);
  });

  it("procesar sin xml no hace nada", async () => {
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    await act(async () => { await result.current.procesar(); });
    expect(parseCfdiXml).not.toHaveBeenCalled();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it("reset limpia xml y pdf", () => {
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    act(() => {
      result.current.setXml(makeXml(10));
      result.current.setPdf(new File(["p"], "p.pdf"));
    });
    expect(result.current.xml).not.toBeNull();
    act(() => result.current.reset());
    expect(result.current.xml).toBeNull();
    expect(result.current.pdf).toBeNull();
  });

  it("mapea CfdiUploadError fase=response al título HTTP", async () => {
    parseCfdiXml.mockRejectedValueOnce(
      new CfdiUploadError("boom", {
        attemptCount: 1, latencyMs: 10, online: true,
        xmlSize: 10, xmlName: "f.xml", lastStatus: 502,
        phase: "response", errorName: "HttpError",
      }, null),
    );
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    act(() => result.current.handleXml(makeXml(10)));
    await act(async () => { await result.current.procesar(); });
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: expect.stringMatching(/HTTP 502/),
    }));
    expect(onParsed).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("mapea CfdiUploadError fase=request offline al título de sin conexión", async () => {
    parseCfdiXml.mockRejectedValueOnce(
      new CfdiUploadError("net", {
        attemptCount: 2, latencyMs: 10, online: false,
        xmlSize: 10, xmlName: "f.xml", lastStatus: null,
        phase: "request", errorName: "TypeError",
      }, null),
    );
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    act(() => result.current.handleXml(makeXml(10)));
    await act(async () => { await result.current.procesar(); });
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: expect.stringMatching(/Sin conexión/i),
    }));
  });

  it("dispara mensaje de timeout cuando parseCfdiXml tarda demasiado", async () => {
    vi.useFakeTimers();
    parseCfdiXml.mockImplementationOnce(() => new Promise(() => { /* never */ }));
    const { result } = renderHook(() => useCargaCfdi({ categorias, onParsed }));
    act(() => result.current.handleXml(makeXml(10)));
    let pending: Promise<void>;
    act(() => { pending = result.current.procesar(); });
    await act(async () => {
      vi.advanceTimersByTime(15_001);
      await pending!;
    });
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: expect.stringMatching(/Tiempo de espera/i),
    }));
    expect(result.current.loading).toBe(false);
  });
});
