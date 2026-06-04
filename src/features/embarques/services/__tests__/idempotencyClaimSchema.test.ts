import { describe, expect, it } from "vitest";
import {
  idempotencyClaimSchema,
  isCachedClaim,
} from "../idempotencyClaimSchema";

describe("idempotencyClaimSchema", () => {
  it("acepta claim pending", () => {
    const r = idempotencyClaimSchema.safeParse({ __idempotency_pending: true });
    expect(r.success).toBe(true);
    if (r.success) expect(isCachedClaim(r.data)).toBe(false);
  });

  it("acepta claim cacheado con path", () => {
    const r = idempotencyClaimSchema.safeParse({
      path: "embarques/abc/doc/xxx-archivo.pdf",
      fileName: "archivo.pdf",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(isCachedClaim(r.data)).toBe(true);
      if (isCachedClaim(r.data)) expect(r.data.path).toContain("archivo.pdf");
    }
  });

  it("rechaza objeto sin path ni pending flag", () => {
    const r = idempotencyClaimSchema.safeParse({ foo: "bar" });
    expect(r.success).toBe(false);
  });
});
