/**
 * Tests para `sentryHelpers`: detección HMR/React-Refresh, scrub PII de
 * eventos y sampling dinámico por ruta.
 */
import { describe, it, expect } from "vitest";
import type * as Sentry from "@sentry/react";
import {
  isReactRefreshHmrError,
  isReactRefreshStackTrace,
  scrubEventPii,
  sampleByRoute,
} from "@/lib/sentryHelpers";

describe("isReactRefreshHmrError", () => {
  it("true cuando mensaje 'is not defined' y stack contiene react-refresh", () => {
    const e = new Error("pendienteOpen is not defined");
    e.stack = "at performReactRefresh (react-refresh.js:1)";
    expect(isReactRefreshHmrError(e)).toBe(true);
  });
  it("false si mensaje no incluye 'is not defined'", () => {
    const e = new Error("otro error");
    e.stack = "react-refresh";
    expect(isReactRefreshHmrError(e)).toBe(false);
  });
  it("false si stack no es de react-refresh", () => {
    const e = new Error("x is not defined");
    e.stack = "at someUserCode (app.tsx:1)";
    expect(isReactRefreshHmrError(e)).toBe(false);
  });
});

describe("isReactRefreshStackTrace", () => {
  it("detecta abs_path con @react-refresh", () => {
    expect(isReactRefreshStackTrace({ frames: [{ abs_path: "/node_modules/@react-refresh/x.js" }] })).toBe(true);
  });
  it("detecta function performReactRefresh / scheduleRefresh", () => {
    expect(isReactRefreshStackTrace({ frames: [{ function: "performReactRefresh" }] })).toBe(true);
    expect(isReactRefreshStackTrace({ frames: [{ function: "scheduleRefresh" }] })).toBe(true);
  });
  it("false para input inválido o frames vacíos", () => {
    expect(isReactRefreshStackTrace(null)).toBe(false);
    expect(isReactRefreshStackTrace("not-object")).toBe(false);
    expect(isReactRefreshStackTrace({})).toBe(false);
    expect(isReactRefreshStackTrace({ frames: [] })).toBe(false);
    expect(isReactRefreshStackTrace({ frames: [{ function: "render" }] })).toBe(false);
  });
});

describe("scrubEventPii", () => {
  it("recorta event.user a sólo { id } y scrubea URL/mensaje/excepción", () => {
    const evt = {
      user: { id: "u-1", email: "alguien@test.com", ip_address: "1.2.3.4" },
      request: { url: "https://app.x/y?token=secreto&otro=ok" },
      message: "RFC ABC010101AAA detectado",
      exception: { values: [{ value: "email leaked alguien@dominio.com" }] },
    } as unknown as Sentry.ErrorEvent;
    const out = scrubEventPii(evt);
    expect(out.user).toEqual({ id: "u-1" });
    expect(out.request?.url).not.toContain("secreto");
    expect(out.message).not.toContain("ABC010101AAA");
    expect(out.exception?.values?.[0]?.value).not.toContain("alguien@dominio.com");
  });
  it("no rompe cuando faltan campos opcionales", () => {
    const evt = {} as Sentry.ErrorEvent;
    expect(() => scrubEventPii(evt)).not.toThrow();
  });
});

describe("sampleByRoute", () => {
  const at = (pathname: string) => ({ location: { pathname } });
  it("rutas de marketing → 0", () => {
    expect(sampleByRoute(at("/"))).toBe(0);
    expect(sampleByRoute(at("/landing"))).toBe(0);
    expect(sampleByRoute(at("/privacidad"))).toBe(0);
    expect(sampleByRoute(at("/tracking"))).toBe(0);
  });
  it("flujos críticos → 1.0", () => {
    expect(sampleByRoute(at("/embarques/nuevo"))).toBe(1.0);
    expect(sampleByRoute(at("/embarques/abc-123/editar"))).toBe(1.0);
    expect(sampleByRoute(at("/cotizaciones/nueva"))).toBe(1.0);
    expect(sampleByRoute(at("/facturas/nueva"))).toBe(1.0);
    expect(sampleByRoute(at("/conciliacion"))).toBe(1.0);
  });
  it("módulos financieros → 0.5", () => {
    expect(sampleByRoute(at("/profit"))).toBe(0.5);
    expect(sampleByRoute(at("/tesoreria/flujo"))).toBe(0.5);
    expect(sampleByRoute(at("/cxc"))).toBe(0.5);
  });
  it("listados frecuentes → 0.05", () => {
    expect(sampleByRoute(at("/dashboard"))).toBe(0.05);
    expect(sampleByRoute(at("/embarques"))).toBe(0.05);
    expect(sampleByRoute(at("/clientes/"))).toBe(0.05);
  });
  it("resto → 0.1", () => {
    expect(sampleByRoute(at("/admin/usuarios"))).toBe(0.1);
    expect(sampleByRoute(at("/configuracion"))).toBe(0.1);
  });
});
