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
