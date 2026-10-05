import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdjuntosSolicitudPricing, useUrlAdjuntoPricing } from "../useAdjuntosSolicitudPricing";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  subir: vi.fn(),
  url: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/features/crm/services/pricing/adjuntosPricing", () => ({
  listarAdjuntos: mocks.listar,
  subirAdjunto: mocks.subir,
  urlAdjunto: mocks.url,
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: mocks.success,
  notifyError: mocks.error,
}));

let client: QueryClient;
const key = ["crm", "pricing", "adjuntos", "solicitud-1"];

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listar.mockResolvedValue([]);
  mocks.subir.mockResolvedValue(undefined);
  mocks.url.mockResolvedValue("https://example.test/archivo-firmado");
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
});

afterEach(() => {
  client.clear();
  vi.useRealTimers();
});

describe("adjuntos de solicitud a Pricing", () => {
  it("consulta el servicio con la organización y conserva la clave del listado", async () => {
    const adjunto = {
      path: "org-1/solicitud-1/cotizacion.pdf", nombre: "cotizacion.pdf",
      tamano: 1200, esImagen: false, creado: null,
    };
    mocks.listar.mockResolvedValue([adjunto]);
    const { result } = renderHook(() => useAdjuntosSolicitudPricing("org-1", "solicitud-1"), { wrapper });

    await waitFor(() => expect(result.current.adjuntos).toEqual([adjunto]));
    expect(mocks.listar).toHaveBeenCalledWith("org-1", "solicitud-1");
    expect(client.getQueryData(key)).toEqual([adjunto]);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("conserva la clave por path y el TTL de 50 minutos de la URL firmada", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const ahora = Date.UTC(2026, 9, 5, 16);
    vi.setSystemTime(ahora);
    const path = "org-1/solicitud-1/cotizacion.pdf";
    const primera = renderHook(() => useUrlAdjuntoPricing(path), { wrapper });

    await waitFor(() => expect(primera.result.current.isSuccess).toBe(true));
    expect(mocks.url).toHaveBeenCalledWith(path);
    expect(client.getQueryData(["crm", "pricing", "adjunto-url", path]))
      .toBe("https://example.test/archivo-firmado");
    primera.unmount();

    vi.setSystemTime(ahora + 49 * 60_000);
    const vigente = renderHook(() => useUrlAdjuntoPricing(path), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(vigente.result.current.isSuccess).toBe(true);
    expect(vigente.result.current.isFetching).toBe(false);
    expect(mocks.url).toHaveBeenCalledTimes(1);
    vigente.unmount();

    vi.setSystemTime(ahora + 50 * 60_000);
    const vencida = renderHook(() => useUrlAdjuntoPricing(path), { wrapper });
    await waitFor(() => expect(mocks.url).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(vencida.result.current.isFetching).toBe(false));
  });

  it("sube secuencialmente y al terminar invalida y vuelve a leer el listado", async () => {
    let terminarPrimero!: () => void;
    mocks.subir.mockImplementationOnce(() => new Promise<void>((resolve) => { terminarPrimero = resolve; }));
    const files = [new File(["uno"], "uno.pdf"), new File(["dos"], "dos.pdf")];
    const { result } = renderHook(() => useAdjuntosSolicitudPricing("org-1", "solicitud-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const invalidar = vi.spyOn(client, "invalidateQueries");

    act(() => result.current.subir.mutate(files));
    await waitFor(() => expect(mocks.subir).toHaveBeenCalledTimes(1));
    expect(mocks.subir).toHaveBeenNthCalledWith(1, "org-1", "solicitud-1", files[0]);
    expect(result.current.subir.isPending).toBe(true);

    await act(async () => terminarPrimero());
    await waitFor(() => expect(result.current.subir.isSuccess).toBe(true));
    expect(mocks.subir).toHaveBeenNthCalledWith(2, "org-1", "solicitud-1", files[1]);
    expect(mocks.subir).toHaveBeenCalledTimes(2);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: key });
    expect(mocks.listar).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledWith(undefined, { title: "2 archivos adjuntados" });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("detiene un lote tras el fallo parcial, muestra el error e invalida también", async () => {
    const error = new Error("No se pudo guardar dos.pdf");
    mocks.subir.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
    const files = [new File(["1"], "uno.pdf"), new File(["2"], "dos.pdf"), new File(["3"], "tres.pdf")];
    const { result } = renderHook(() => useAdjuntosSolicitudPricing("org-1", "solicitud-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const invalidar = vi.spyOn(client, "invalidateQueries");

    act(() => result.current.subir.mutate(files));
    await waitFor(() => expect(result.current.subir.isError).toBe(true));
    expect(result.current.subir.error).toBe(error);
    expect(mocks.subir.mock.calls).toEqual([
      ["org-1", "solicitud-1", files[0]], ["org-1", "solicitud-1", files[1]],
    ]);
    expect(mocks.error).toHaveBeenCalledWith(undefined, {
      title: "No se pudo adjuntar el archivo", description: error.message, error,
      method: "CRM_PRICING_ADJUNTO",
    });
    expect(mocks.success).not.toHaveBeenCalled();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: key });
    expect(mocks.listar).toHaveBeenCalledTimes(2);
  });
});
