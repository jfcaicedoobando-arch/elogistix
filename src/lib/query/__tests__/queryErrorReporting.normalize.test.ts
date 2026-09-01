/**
 * v13.823.16 (Sentry JAVASCRIPT-REACT-5N / -5P) · un error de PostgREST sin
 * mensaje ya no debe titularse "unknown error": se clasifica como fallo de red
 * (u offline) e incluye la consulta afectada para que el issue sea accionable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sentryMock = vi.hoisted(() => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@sentry/react", () => sentryMock);

import { reportQueryError } from "../queryErrorReporting";

async function flush(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (sentryMock.captureException.mock.calls.length > 0) return;
    await new Promise((r) => setTimeout(r, 5));
  }
}

const setOnline = (valor: boolean): void => {
  Object.defineProperty(navigator, "onLine", { value: valor, configurable: true });
};

beforeEach(() => {
  sentryMock.captureException.mockClear();
  setOnline(true);
});
afterEach(() => vi.clearAllMocks());

describe("reportQueryError — errores sin mensaje", () => {
  it("clasifica como fallo de red e incluye la consulta afectada", async () => {
    reportQueryError({ message: "" }, "query", "embarques");
    await flush();

    const [error, opciones] = sentryMock.captureException.mock.calls[0];
    expect((error as Error).message).toContain("Fallo de red");
    expect((error as Error).message).toContain("embarques");
    expect((error as Error).message).not.toContain("unknown error");
    expect(opciones.tags.error_kind).toBe("network");
    expect(opciones.tags.query_root).toBe("embarques");
  });

  it("marca error_kind=offline cuando el navegador está sin conexión", async () => {
    setOnline(false);
    reportQueryError({ message: "", status: 0 }, "query", "facturas");
    await flush();

    const [error, opciones] = sentryMock.captureException.mock.calls[0];
    expect((error as Error).message).toContain("Sin conexión");
    expect(opciones.tags.error_kind).toBe("offline");
    expect(opciones.tags.http_status).toBe("0");
  });

  it("conserva el mensaje real cuando existe", async () => {
    reportQueryError({ message: "permission denied for table facturas", code: "42501" }, "query", "facturas");
    await flush();

    const [error, opciones] = sentryMock.captureException.mock.calls[0];
    expect((error as Error).message).toBe("permission denied for table facturas");
    expect(opciones.tags.pg_code).toBe("42501");
    expect(opciones.tags.error_kind).toBeUndefined();
  });
});
