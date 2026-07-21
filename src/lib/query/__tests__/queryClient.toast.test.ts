/**
 * v13.303.75 · Fase 1 · Cuando una query falla, la UI debe recibir un toast.
 * Antes sólo se reportaba a Sentry y el usuario veía "Sin resultados".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const toastErrorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

// Silenciamos reporter Sentry para aislar el efecto UI.
vi.mock("@/lib/observability/reportQueryError", () => ({
  reportQueryError: vi.fn(),
  rootOf: (key: readonly unknown[]) => (typeof key[0] === "string" ? key[0] : "data"),
}));

// Silenciamos catálogos de errores esperados: por defecto no lo son.
vi.mock("@/lib/domain/expectedBusinessErrors", () => ({
  isExpectedBusinessError: vi.fn(() => false),
}));

describe("queryClient · toast on query failure", () => {
  beforeEach(() => {
    toastErrorMock.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("emite toast.error con id dedupe por root cuando una query falla", async () => {
    const { queryClient } = await import("../queryClient");
    await queryClient.fetchQuery({
      queryKey: ["facturas", "listado"],
      queryFn: async () => {
        throw new Error("Network down");
      },
      retry: false,
    }).catch(() => { /* swallow — nos interesa el side-effect del cache */ });

    // Damos un tick para que QueryCache.onError se propague.
    await new Promise((r) => setTimeout(r, 0));

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    const [msg, opts] = toastErrorMock.mock.calls[0];
    expect(msg).toBe("No pudimos cargar la información");
    expect((opts as { id: string }).id).toBe("query-error:facturas");
  });

  it("respeta meta.silentError y NO muestra toast", async () => {
    const { queryClient } = await import("../queryClient");
    await queryClient.fetchQuery({
      queryKey: ["ping"],
      queryFn: async () => { throw new Error("silent"); },
      retry: false,
      meta: { silentError: true },
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
