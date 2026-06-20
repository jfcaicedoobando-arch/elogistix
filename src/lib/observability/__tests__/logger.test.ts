import { describe, it, expect, vi, beforeEach } from "vitest";

const logClientErrorMock = vi.fn();
vi.mock("@/services/observability/logClientError", () => ({
  logClientError: (...args: unknown[]) => logClientErrorMock(...args),
}));

import { logger } from "../logger";

describe("lib/observability/logger", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logClientErrorMock.mockClear();
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("debug imprime con scope en modo no-prod (test)", () => {
    logger.debug("scopeA", "hello", 42);
    expect(debugSpy).toHaveBeenCalledWith("[scopeA]", "hello", 42);
  });

  it("info imprime con scope", () => {
    logger.info("scopeB", { foo: 1 });
    expect(infoSpy).toHaveBeenCalledWith("[scopeB]", { foo: 1 });
  });

  it("warn siempre imprime con prefijo", () => {
    logger.warn("scopeC", "cuidado");
    expect(warnSpy).toHaveBeenCalledWith("[scopeC]", "cuidado");
  });

  it("error imprime y reporta a logClientError preservando el Error", () => {
    const boom = new Error("falló X");
    logger.error("scopeD", boom);
    expect(errorSpy).toHaveBeenCalledWith("[scopeD]", boom);
    expect(logClientErrorMock).toHaveBeenCalledTimes(1);
    const payload = logClientErrorMock.mock.calls[0][0];
    expect(payload.message).toBe("[scopeD] falló X");
    expect(payload.stack).toBe(boom.stack);
  });

  it("error sintetiza un Error si no se pasa uno", () => {
    logger.error("scopeE", "mensaje plano");
    expect(logClientErrorMock).toHaveBeenCalledTimes(1);
    const payload = logClientErrorMock.mock.calls[0][0];
    expect(payload.message).toBe("[scopeE] mensaje plano");
    expect(typeof payload.stack).toBe("string");
  });

  it("error nunca propaga si logClientError lanza", () => {
    logClientErrorMock.mockImplementationOnce(() => {
      throw new Error("reporte caído");
    });
    expect(() => logger.error("scopeF", "x")).not.toThrow();
  });
});
