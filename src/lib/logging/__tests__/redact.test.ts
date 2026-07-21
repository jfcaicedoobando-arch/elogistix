import { describe, it, expect } from "vitest";
import { redact, maskEmail } from "../redact";

describe("maskEmail", () => {
  it("enmascara usuario preservando dominio", () => {
    expect(maskEmail("hector@lopezbenavides.com")).toBe("h*****@lopezbenavides.com");
  });
  it("devuelve el input si no parece email", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("redact", () => {
  it("enmascara claves sensibles", () => {
    const out = redact({
      authorization: "Bearer abc",
      api_key: "sk_123",
      password: "hunter2",
      token: "t",
      access_token: "a",
      refresh_token: "r",
      rfc: "XAXX010101000",
      email: "x@y.com",
      keep: "ok",
    });
    expect(out).toMatchObject({
      authorization: "[REDACTED]",
      api_key: "[REDACTED]",
      password: "[REDACTED]",
      token: "[REDACTED]",
      access_token: "[REDACTED]",
      refresh_token: "[REDACTED]",
      rfc: "[REDACTED]",
      email: "[REDACTED]",
      keep: "ok",
    });
  });
  it("enmascara emails embebidos en strings", () => {
    const out = redact({ msg: "Falló envío a hector@acme.com hoy" });
    expect((out as { msg: string }).msg).toContain("h****@acme.com");
    expect((out as { msg: string }).msg).not.toContain("hector@acme.com");
  });
  it("es idempotente", () => {
    const once = redact({ password: "x", user: { email: "a@b.com" } });
    expect(redact(once)).toEqual(once);
  });
  it("recorre arrays y objetos anidados", () => {
    const out = redact({ list: [{ token: "t" }, { ok: 1 }] }) as {
      list: Array<Record<string, unknown>>;
    };
    expect(out.list[0].token).toBe("[REDACTED]");
    expect(out.list[1].ok).toBe(1);
  });
});
