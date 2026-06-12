import { describe, it, expect } from "vitest";
import { scrubPii, scrubUrl, isSensitiveApiUrl } from "@/lib/observability/piiScrub";

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
