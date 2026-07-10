import { describe, it, expect } from "vitest";
import { unwrap, unwrapOr, run } from "../response";

// Helpers: Postgrest builders son thenables — simulamos con Promise.
const ok = <T,>(data: T) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: new Error(message) });

describe("supabase/response helpers", () => {
  describe("unwrap", () => {
    it("devuelve data cuando no hay error", async () => {
      await expect(unwrap(ok({ id: "1" }))).resolves.toEqual({ id: "1" });
    });

    it("devuelve null cuando maybeSingle no encontró fila", async () => {
      await expect(unwrap(ok(null))).resolves.toBeNull();
    });

    it("re-lanza el error de Postgrest sin modificar", async () => {
      await expect(unwrap(fail("boom"))).rejects.toThrow("boom");
    });
  });

  describe("unwrapOr", () => {
    it("devuelve data cuando existe", async () => {
      await expect(unwrapOr(ok([1, 2, 3]), [])).resolves.toEqual([1, 2, 3]);
    });

    it("devuelve fallback cuando data es null", async () => {
      await expect(unwrapOr(ok(null), [])).resolves.toEqual([]);
    });

    it("re-lanza el error incluso si hay fallback", async () => {
      await expect(unwrapOr(fail("nope"), [])).rejects.toThrow("nope");
    });
  });

  describe("run", () => {
    it("resuelve sin valor cuando no hay error", async () => {
      await expect(run(ok(null))).resolves.toBeUndefined();
    });

    it("re-lanza el error", async () => {
      await expect(run(fail("delete failed"))).rejects.toThrow("delete failed");
    });
  });
});
