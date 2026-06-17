/**
 * Tests para `sentryHelpers`: scrub PII de eventos y sampling dinámico por
 * ruta. Las detecciones de React-Refresh ya están cubiertas por
 * `src/lib/__tests__/sentry.test.ts`.
 */
import { describe, it, expect } from "vitest";
import type * as Sentry from "@sentry/react";
import { scrubEventPii, sampleByRoute } from "@/lib/sentryHelpers";

describe("scrubEventPii — recorta PII en eventos Sentry", () => {
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

describe("sampleByRoute — sampling dinámico por ruta", () => {
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
