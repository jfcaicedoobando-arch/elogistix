/**
 * Plan A (audit Sentry): valida `resolveEnvironment()` y la constante
 * `TRACE_PROPAGATION_TARGETS`. Ambas viven privadas en `core.ts`, así que
 * las re-importamos vía side-effect: `resolveEnvironment` se ejerce
 * indirectamente por `initSentry()`. Para mantenerlo aislado del SDK real
 * (que no queremos arrancar en jsdom), hacemos un mock liviano de
 * `@sentry/react` y leemos `init({ environment, tracePropagationTargets })`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sentryMock = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  reactRouterV6BrowserTracingIntegration: vi.fn(() => ({ name: "tracing" })),
  replayIntegration: vi.fn(() => ({ name: "replay" })),
  feedbackIntegration: vi.fn(() => ({ name: "feedback" })),
  browserProfilingIntegration: vi.fn(() => ({ name: "profiling" })),
  httpClientIntegration: vi.fn(() => ({ name: "httpClient" })),
  thirdPartyErrorFilterIntegration: vi.fn(() => ({ name: "tpe" })),
  captureConsoleIntegration: vi.fn(() => ({ name: "console" })),
}));


vi.mock("@sentry/react", () => sentryMock);

async function freshInit() {
  vi.resetModules();
  const mod = await import("../core");
  mod.initSentry();
  // initSentry() es sincrónico — la llamada a Sentry.init ya ocurrió.
  return sentryMock.init.mock.calls.at(-1)?.[0] as
    | { environment?: string; tracePropagationTargets?: Array<string | RegExp> }
    | undefined;
}

// Auditoría 13.137.32: capturamos originalLocation dentro de beforeEach para
// evitar snapshot contaminado si otro archivo del shard mutó window.location antes.
let originalLocation: Location;

function setHostname(host: string) {
  // jsdom: redefinir window.location de forma controlada.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, hostname: host },
  });
}

beforeEach(() => {
  originalLocation = window.location;
  sentryMock.init.mockClear();
  // Forzar MODE != development para que initSentry no se salga temprano.
  vi.stubEnv("MODE", "production");
  vi.unstubAllEnvs();
  vi.stubEnv("MODE", "production");
  // 13.310.0: sin DSN, initSentry no arranca. Stub un DSN de prueba.
  vi.stubEnv("VITE_SENTRY_DSN", "https://x@o0.ingest.sentry.io/0");
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  vi.unstubAllEnvs();
});

describe("resolveEnvironment (Sentry)", () => {
  it("prioriza VITE_SENTRY_ENV explícito por encima del host", async () => {
    vi.stubEnv("VITE_SENTRY_ENV", "staging");
    setHostname("librecarga.com");
    const cfg = await freshInit();
    expect(cfg?.environment).toBe("staging");
  });

  it("detecta preview por host *.lovable.app", async () => {
    setHostname("foo.lovable.app");
    const cfg = await freshInit();
    expect(cfg?.environment).toBe("preview");
  });

  it("detecta production por host librecarga.com / www.librecarga.com", async () => {
    setHostname("librecarga.com");
    const cfg = await freshInit();
    expect(cfg?.environment).toBe("production");

    sentryMock.init.mockClear();
    setHostname("www.librecarga.com");
    const cfg2 = await freshInit();
    expect(cfg2?.environment).toBe("production");
  });

  it("fallback a import.meta.env.MODE para hosts desconocidos", async () => {
    setHostname("preview-xyz.example.com");
    const cfg = await freshInit();
    // En este test MODE='production' (stub), por lo que cae al MODE.
    expect(cfg?.environment).toBe("production");
  });
});

describe("TRACE_PROPAGATION_TARGETS", () => {
  it("incluye API/functions relativos, Supabase edge y dominio librecarga", async () => {
    setHostname("librecarga.com");
    const cfg = await freshInit();
    const targets = cfg?.tracePropagationTargets ?? [];
    // Esperamos al menos 3 patrones — los 3 son RegExp.
    expect(targets.length).toBeGreaterThanOrEqual(3);

    const matches = (url: string) =>
      targets.some((t) => (t instanceof RegExp ? t.test(url) : url.includes(t)));

    expect(matches("/api/foo")).toBe(true);
    expect(matches("/functions/v1/bar")).toBe(true);
    expect(matches("https://xyz.supabase.co/functions/v1/bar")).toBe(true);
    expect(matches("https://librecarga.com/dashboard")).toBe(true);
    // Negativo: cualquier otro origen NO debe matchear.
    expect(matches("https://google.com/")).toBe(false);
  });
});
