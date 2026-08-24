import { describe, it, expect } from "vitest";
import { scrubPii, scrubUrl, scrubPathTokens, isSensitiveApiUrl } from "@/lib/observability/piiScrub";

describe("scrubPii", () => {
  it("redacta RFC mexicano persona física (13)", () => {
    expect(scrubPii("Cliente XAXX010101000 facturó")).toBe("Cliente [RFC] facturó");
  });
  it("redacta RFC moral (12)", () => {
    expect(scrubPii("RFC ABC920101AB1 ok")).toBe("RFC [RFC] ok");
  });
  it("redacta email", () => {
    expect(scrubPii("Contact: john.doe@example.com here")).toBe("Contact: [EMAIL] here");
  });
  it("no rompe cuando no hay match", () => {
    expect(scrubPii("hola mundo")).toBe("hola mundo");
  });
  it("acepta undefined", () => {
    expect(scrubPii(undefined)).toBeUndefined();
  });
});

describe("scrubUrl", () => {
  it("redacta token en query string", () => {
    const out = scrubUrl("https://api.test/v1?token=secret123&keep=1");
    expect(out).toContain("token=%5BREDACTED%5D");
    expect(out).toContain("keep=1");
  });
  it("redacta email en query string", () => {
    expect(scrubUrl("/login?email=a@b.com")).toContain("[REDACTED]");
  });
  it("aplica scrubPii al fallback", () => {
    expect(scrubUrl("/log/john@example.com")).toContain("[EMAIL]");
  });
  it("redacta token de tracking (32 hex) en el path", () => {
    expect(scrubUrl("/tracking/0123456789abcdef0123456789abcdef")).toBe("/tracking/[token]");
  });
  it("redacta UUID de proforma en el path y conserva el resto", () => {
    expect(scrubUrl("/portal/proformas/123e4567-e89b-12d3-a456-426614174000")).toBe(
      "/portal/proformas/[token]",
    );
  });
  it("redacta path y query a la vez en URL absoluta", () => {
    const out = scrubUrl("https://app.test/tracking/0123456789abcdef0123456789abcdef?token=abc&keep=1");
    expect(out).toContain("/tracking/[token]");
    expect(out).toContain("token=%5BREDACTED%5D");
    expect(out).toContain("keep=1");
  });
  it("redacta el token de /unsubscribe vía query string", () => {
    const out = scrubUrl("/unsubscribe?token=0123456789abcdef0123456789abcdef");
    expect(out).toBe("/unsubscribe?token=[REDACTED]");
  });
  it("no toca segmentos que no son tokens", () => {
    expect(scrubUrl("/embarques/EXP-2026-0001/tracking")).toBe("/embarques/EXP-2026-0001/tracking");
    // Hex corto (no 32) no es token de tracking.
    expect(scrubUrl("/clientes/deadbeef")).toBe("/clientes/deadbeef");
  });
});

describe("scrubPathTokens", () => {
  it("redacta 32-hex y UUID como segmentos completos", () => {
    expect(scrubPathTokens("/tracking/0123456789abcdef0123456789abcdef")).toBe("/tracking/[token]");
    expect(scrubPathTokens("/a/123e4567-e89b-12d3-a456-426614174000/b")).toBe("/a/[token]/b");
  });
  it("no redacta subcadenas dentro de un segmento mayor", () => {
    expect(scrubPathTokens("/x/0123456789abcdef0123456789abcdefEXTRA")).toBe(
      "/x/0123456789abcdef0123456789abcdefEXTRA",
    );
  });
  it("acepta undefined/null", () => {
    expect(scrubPathTokens(undefined)).toBeUndefined();
    expect(scrubPathTokens(null)).toBeUndefined();
  });
});

describe("isSensitiveApiUrl", () => {
  it("detecta endpoints de datos sensibles", () => {
    expect(isSensitiveApiUrl("https://x.supabase.co/rest/v1/clientes?select=*")).toBe(true);
    expect(isSensitiveApiUrl("/rest/v1/facturas")).toBe(true);
  });
  it("no marca endpoints inocuos", () => {
    expect(isSensitiveApiUrl("/rest/v1/puertos")).toBe(false);
    expect(isSensitiveApiUrl(undefined)).toBe(false);
  });
});
