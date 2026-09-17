/**
 * MNY P1.4 — la llave de idempotencia sólo se reutiliza con el MISMO payload.
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePayloadRequestId, scopeDePayload } from "@/lib/idempotency";

describe("idempotency | usePayloadRequestId", () => {
  it("01 — el mismo scope reutiliza la llave (reintento del mismo payload)", () => {
    const { result } = renderHook(() => usePayloadRequestId());
    const a = result.current.get("anticipo|factura|100|2026-09-17");
    const b = result.current.get("anticipo|factura|100|2026-09-17");
    expect(a).toBe(b);
  });

  it("02 — un payload distinto genera una llave nueva", () => {
    const { result } = renderHook(() => usePayloadRequestId());
    const a = result.current.get("anticipo|factura|100|2026-09-17");
    const b = result.current.get("anticipo|otraFactura|100|2026-09-17");
    expect(b).not.toBe(a);
  });

  it("03 — reset genera una llave nueva para el mismo scope", () => {
    const { result } = renderHook(() => usePayloadRequestId());
    const a = result.current.get("x");
    result.current.reset();
    expect(result.current.get("x")).not.toBe(a);
  });

  it("04 — scopeDePayload normaliza null y undefined a cadena vacía", () => {
    expect(scopeDePayload(["a", null, undefined, 3])).toBe("a|||3");
  });

  it("05 — scopeDePayload distingue montos distintos", () => {
    expect(scopeDePayload(["a", 100])).not.toBe(scopeDePayload(["a", 200]));
  });
});
