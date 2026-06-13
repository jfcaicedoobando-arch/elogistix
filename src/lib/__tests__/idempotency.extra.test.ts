import { describe, it, expect } from "vitest";
import { newRequestId } from "@/lib/idempotency";

describe("idempotency | newRequestId", () => {
  it("01 — retorna un string no vacío", () => {
    expect(typeof newRequestId()).toBe("string");
    expect(newRequestId().length).toBeGreaterThan(0);
  });

  it("02 — retorna un UUID v4 con formato correcto", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(newRequestId()).toMatch(uuidRegex);
  });

  it("03 — genera IDs únicos en llamadas consecutivas", () => {
    const ids = new Set(Array.from({ length: 20 }, () => newRequestId()));
    expect(ids.size).toBe(20);
  });

  it("04 — tiene exactamente 36 caracteres (UUID estándar)", () => {
    expect(newRequestId()).toHaveLength(36);
  });

  it("05 — contiene exactamente 4 guiones", () => {
    expect(newRequestId().split("-").length - 1).toBe(4);
  });

  it("06 — usa el fallback cuando crypto.randomUUID no existe", () => {
    const original = crypto.randomUUID;
    (crypto as unknown as { randomUUID: unknown }).randomUUID = undefined;
    try {
      const id = newRequestId();
      expect(id).toMatch(/^[0-9a-f-]+$/i);
    } finally {
      (crypto as unknown as { randomUUID: typeof original }).randomUUID = original;
    }
  });

  it("07 — el fallback también genera IDs únicos", () => {
    const original = crypto.randomUUID;
    (crypto as unknown as { randomUUID: unknown }).randomUUID = undefined;
    try {
      const ids = new Set(Array.from({ length: 10 }, () => newRequestId()));
      expect(ids.size).toBe(10);
    } finally {
      (crypto as unknown as { randomUUID: typeof original }).randomUUID = original;
    }
  });

  it("08 — no retorna 'undefined' ni 'null' como string", () => {
    const id = newRequestId();
    expect(id).not.toBe("undefined");
    expect(id).not.toBe("null");
  });

  it("09 — el tercer segmento comienza con '4' (versión UUID v4)", () => {
    expect(newRequestId().split("-")[2]?.charAt(0)).toBe("4");
  });

  it("10 — el cuarto segmento empieza con 8, 9, a o b", () => {
    expect(newRequestId().split("-")[3]?.charAt(0)).toMatch(/^[89ab]$/i);
  });

  it("11 — 100 IDs generados son todos distintos", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newRequestId()));
    expect(ids.size).toBe(100);
  });
});
