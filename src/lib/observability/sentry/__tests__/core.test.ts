import { describe, it, expect } from "vitest";
import { isReactRefreshHmrError, isReactRefreshStackTrace } from "@/lib/sentry";


describe("isReactRefreshHmrError", () => {
  it("detecta ReferenceError con stack de react-refresh", () => {
    const err = new Error("pendienteOpen is not defined");
    err.stack = `ReferenceError: pendienteOpen is not defined\n    at eval (http://localhost:8080/src/pages/agentes/AgenteComercial.tsx:42:10)\n    at performReactRefresh (http://localhost:8080/@react-refresh:123:15)`;
    expect(isReactRefreshHmrError(err)).toBe(true);
  });

  it("detecta scheduleRefresh en el stack", () => {
    const err = new Error("count is not defined");
    err.stack = `ReferenceError: count is not defined\n    at scheduleRefresh (http://localhost:8080/@react-refresh:456:7)`;
    expect(isReactRefreshHmrError(err)).toBe(true);
  });

  it("ignora errores 'is not defined' sin stack de react-refresh", () => {
    const err = new Error("foo is not defined");
    err.stack = `ReferenceError: foo is not defined\n    at bar (http://localhost:8080/src/app.tsx:10:5)`;
    expect(isReactRefreshHmrError(err)).toBe(false);
  });

  it("ignora otros tipos de error aun con react-refresh en stack", () => {
    const err = new Error("Network error");
    err.stack = `Error: Network error\n    at performReactRefresh (http://localhost:8080/@react-refresh:123:15)`;
    expect(isReactRefreshHmrError(err)).toBe(false);
  });
});

describe("isReactRefreshStackTrace", () => {
  it("detecta frames con abs_path de @react-refresh", () => {
    const st = {
      frames: [{ abs_path: "http://localhost:8080/@react-refresh", function: "init" }],
    };
    expect(isReactRefreshStackTrace(st)).toBe(true);
  });

  it("detecta frames con function performReactRefresh", () => {
    const st = {
      frames: [{ abs_path: "app.tsx", function: "performReactRefresh" }],
    };
    expect(isReactRefreshStackTrace(st)).toBe(true);
  });

  it("detecta frames con function scheduleRefresh", () => {
    const st = {
      frames: [{ abs_path: "app.tsx", function: "scheduleRefresh" }],
    };
    expect(isReactRefreshStackTrace(st)).toBe(true);
  });

  it("ignora stacktraces sin señales de react-refresh", () => {
    const st = {
      frames: [{ abs_path: "app.tsx", function: "handleClick" }],
    };
    expect(isReactRefreshStackTrace(st)).toBe(false);
  });

  it("ignora null / no-object", () => {
    expect(isReactRefreshStackTrace(null)).toBe(false);
    expect(isReactRefreshStackTrace(undefined)).toBe(false);
    expect(isReactRefreshStackTrace("string")).toBe(false);
  });
});
