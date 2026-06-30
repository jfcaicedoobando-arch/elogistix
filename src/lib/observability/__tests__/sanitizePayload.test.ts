import { describe, it, expect } from "vitest";
import { sanitizePayload } from "../sanitizePayload";

describe("sanitizePayload", () => {
  it("redacta claves sensibles (case insensitive)", () => {
    const out = sanitizePayload({
      api_key: "sk_live_xxx",
      API_KEY: "x",
      password: "p",
      rfc: "ABC010101AB1",
      email: "a@b.com",
      ok: "visible",
    }) as Record<string, unknown>;
    expect(out.api_key).toBe("[REDACTED]");
    expect(out.API_KEY).toBe("[REDACTED]");
    expect(out.password).toBe("[REDACTED]");
    expect(out.rfc).toBe("[REDACTED]");
    expect(out.email).toBe("[REDACTED]");
    expect(out.ok).toBe("visible");
  });

  it("redacta recursivamente en objetos anidados y arrays", () => {
    const out = sanitizePayload({
      args: [{ token: "t", id: 1 }],
      nested: { deep: { password: "x", keep: 7 } },
    }) as Record<string, Record<string, unknown>>;
    const args = out.args as unknown as Array<Record<string, unknown>>;
    expect(args[0].token).toBe("[REDACTED]");
    expect(args[0].id).toBe(1);
    const deep = (out.nested.deep as Record<string, unknown>);
    expect(deep.password).toBe("[REDACTED]");
    expect(deep.keep).toBe(7);
  });

  it("maneja referencias circulares", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const out = sanitizePayload(obj) as Record<string, unknown>;
    expect(out.a).toBe(1);
    expect(out.self).toBe("[Circular]");
  });

  it("serializa BigInt y Date", () => {
    const out = sanitizePayload({ n: 10n, d: new Date("2026-06-30T00:00:00Z") }) as Record<
      string,
      unknown
    >;
    expect(out.n).toBe("10");
    expect(out.d).toBe("2026-06-30T00:00:00.000Z");
  });

  it("trunca payloads > 8KB", () => {
    const big = { blob: "x".repeat(20_000) };
    const out = sanitizePayload(big) as Record<string, unknown>;
    expect(out.__truncated).toBe(true);
    expect(typeof out.preview).toBe("string");
  });
});
