/**
 * v13.303.75 · Fase 1 · Cuando una query falla, la UI debe recibir un toast.
 * v13.308.7 · Migrado a `notifyError` para incluir "Ver detalles".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const toastErrorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Silenciamos reporter Sentry para aislar el efecto UI.
vi.mock("@/lib/observability/reportQueryError", () => ({
  reportQueryError: vi.fn(),
  rootOf: (key: readonly unknown[]) => (typeof key[0] === "string" ? key[0] : "data"),
}));

vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: vi.fn(),
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

  // El `await import()` del queryClient arrastra el grafo de módulos completo;
  // bajo carga (suite completa) puede pasar de 15 s. Timeout dedicado.
  it("emite toast.error con acción 'Reintentar' cuando una query falla", async () => {
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
    const options = opts as { duration: number; action: { label: string } };
    expect(options.duration).toBe(8000);
    // Q-08: la acción primaria reintenta en el lugar (no navega fuera).
    expect(options.action.label).toBe("Reintentar");
  }, 45_000);

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
