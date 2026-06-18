/**
 * F5 (audit Sentry 13.65.0): valida los nuevos scrubs sobre eventos Sentry —
 * `request.headers` sensibles, breadcrumbs de `fetch/navigation` con URLs
 * con query strings sensibles, y mensaje de breadcrumb con PII.
 */
import { describe, it, expect } from "vitest";
import type * as Sentry from "@sentry/react";
import { scrubEventPii, sampleByRoute } from "@/lib/observability/sentry/helpers";

describe("scrubEventPii — F5 nuevos campos", () => {
  it("redacta Authorization / Cookie / apikey / x-supabase-* en request.headers", () => {
    const evt = {
      request: {
        url: "https://x.supabase.co/rest/v1/embarques",
        headers: {
          Authorization: "Bearer eyJzecreto",
          cookie: "sb-access=xxx",
          ApiKey: "anon-key",
          "x-supabase-auth": "tok",
          "x-trace-id": "ok-keep",
        },
      },
    } as unknown as Sentry.ErrorEvent;
    const out = scrubEventPii(evt);
    const h = out.request!.headers as Record<string, string>;
    expect(h.Authorization).toBe("[Filtered]");
    expect(h.cookie).toBe("[Filtered]");
    expect(h.ApiKey).toBe("[Filtered]");
    expect(h["x-supabase-auth"]).toBe("[Filtered]");
    expect(h["x-trace-id"]).toBe("ok-keep");
  });

  it("scrubea url/to/from en breadcrumbs[].data y mensaje con PII", () => {
    const evt = {
      breadcrumbs: [
        { category: "fetch", data: { url: "https://api/x?token=secreto&id=1" } },
        { category: "navigation", data: { from: "/old?email=a@b.com", to: "/new?token=zzz" } },
        { category: "ui.click", message: "click en email alguien@dominio.com" },
      ],
    } as unknown as Sentry.ErrorEvent;
    const out = scrubEventPii(evt);
    const b = out.breadcrumbs!;
    const fetchUrl = (b[0].data as { url: string }).url;
    expect(fetchUrl).not.toContain("secreto");
    const nav = b[1].data as { from: string; to: string };
    expect(nav.to).not.toContain("zzz");
    expect(b[2].message).not.toContain("alguien@dominio.com");
  });

  it("no rompe si event.request o event.breadcrumbs no existen", () => {
    const evt = {} as Sentry.ErrorEvent;
    expect(() => scrubEventPii(evt)).not.toThrow();
  });
});

describe("sampleByRoute — F5 ampliación", () => {
  it("/reportes/* se muestrea al 50%", () => {
    expect(sampleByRoute({ location: { pathname: "/reportes/cierre" } })).toBe(0.5);
  });

  it("/auditoria y /admin se muestrean al 30%", () => {
    expect(sampleByRoute({ location: { pathname: "/auditoria/abc-123" } })).toBe(0.3);
    expect(sampleByRoute({ location: { pathname: "/admin/usuarios" } })).toBe(0.3);
  });

  it("rutas críticas siguen al 100% (regression guard)", () => {
    expect(sampleByRoute({ location: { pathname: "/embarques/nuevo" } })).toBe(1.0);
    expect(sampleByRoute({ location: { pathname: "/cotizaciones/nueva" } })).toBe(1.0);
  });
});
