import { describe, it, expect } from "vitest";
import type * as Sentry from "@sentry/react";
import { shouldDropSentryEvent } from "../dropPredicate";

type Evt = Sentry.ErrorEvent;

const baseEvent = (extra: Partial<Evt> = {}): Evt =>
  ({ exception: { values: [{ value: "unknown error" }] }, ...extra }) as Evt;

describe("shouldDropSentryEvent — filtros de ruido", () => {
  it("descarta errores con cause de túnel Cloudflare (1033)", () => {
    const err = new Error("unknown error") as Error & { cause?: unknown };
    err.cause = { cloudflare_error: true, error_code: 1033, status: 530 };
    expect(shouldDropSentryEvent(baseEvent(), { originalException: err })).toBe(true);
  });

  it("descarta eventos originados en túneles efímeros trycloudflare.com", () => {
    const evt = baseEvent({
      request: { url: "https://abc-def.trycloudflare.com/compras/facturas" },
    });
    expect(shouldDropSentryEvent(evt, { originalException: new Error("Failed to fetch") })).toBe(
      true,
    );
  });

  it("descarta rechazos de RLS (42501) cuando sólo viven en tags", () => {
    const evt = baseEvent({ tags: { pg_code: "42501" } });
    expect(shouldDropSentryEvent(evt, { originalException: new Error("new row violates") })).toBe(
      true,
    );
  });

  it("descarta rechazos de RLS reportados en extra.original", () => {
    const evt = baseEvent({ extra: { original: { code: "42501" } } });
    expect(shouldDropSentryEvent(evt, { originalException: new Error("x") })).toBe(true);
  });

  it("conserva errores reales de la app", () => {
    const evt = baseEvent({
      exception: { values: [{ value: "Cannot read properties of undefined" }] },
      request: { url: "https://librecarga.com/embarques" },
    });
    const dropped = shouldDropSentryEvent(evt, {
      originalException: new Error("Cannot read properties of undefined"),
    });
    expect(dropped).toBe(false);
  });
});

describe("shouldDropSentryEvent — reglas de negocio y red", () => {
  it("descarta reglas de negocio de la BD (P0001)", () => {
    const evt = baseEvent({ tags: { pg_code: "P0001" } });
    const err = new Error("Embarque cerrado: usa reabrir_embarque para modificarlo");
    expect(shouldDropSentryEvent(evt, { originalException: err })).toBe(true);
  });

  it("descarta violaciones de unicidad (23505) reportadas en extra.original", () => {
    const evt = baseEvent({ extra: { original: { code: "23505" } } });
    expect(shouldDropSentryEvent(evt, { originalException: new Error("duplicate key") })).toBe(true);
  });

  it("descarta pérdidas de conectividad del cliente", () => {
    const err = new Error("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
    expect(shouldDropSentryEvent(baseEvent(), { originalException: err })).toBe(true);
  });

  it("descarta rechazos de promesa serializados vacíos", () => {
    const evt = baseEvent({
      exception: { values: [{ value: "Object captured as promise rejection with keys: message" }] },
      extra: { __serialized__: { message: "" } },
    });
    expect(shouldDropSentryEvent(evt, {})).toBe(true);
  });

  it("conserva errores de BD que no son reglas de negocio", () => {
    const evt = baseEvent({
      exception: { values: [{ value: "column does not exist", stacktrace: { frames: [{ filename: "app.js" }] } }] },
      tags: { pg_code: "42703" },
    });
    expect(shouldDropSentryEvent(evt, { originalException: new Error("column does not exist") })).toBe(false);
  });

  it("descarta validaciones de negocio re-envueltas como Error plano", () => {
    const err = new Error('El contenedor "PRUE1234569" ya está registrado en este embarque.');
    expect(shouldDropSentryEvent(baseEvent(), { originalException: err })).toBe(true);
    const sat = new Error("Verifica el UUID en el SAT antes de aprobar.");
    expect(shouldDropSentryEvent(baseEvent(), { originalException: sat })).toBe(true);
  });

  it("descarta timeouts y 5xx del gateway", () => {
    const err = new Error("upstream request timeout");
    expect(shouldDropSentryEvent(baseEvent(), { originalException: err })).toBe(true);
    const http = Object.assign(new Error("HTTP Client Error with status code: 504"), { status: 504 });
    expect(shouldDropSentryEvent(baseEvent(), { originalException: http })).toBe(true);
  });
});
