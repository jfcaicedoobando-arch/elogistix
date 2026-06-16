/**
 * Smoke trivial sobre `dialogTokens`. Sólo expone constantes de strings,
 * pero validamos contrato (todas las claves apuntan a `sm:max-w-*`) para
 * detectar cambios accidentales en la convención.
 */
import { describe, it, expect } from "vitest";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";

describe("dialogTokens", () => {
  it("dialogSize cubre tamaños sm..4xl con prefijo sm:max-w-", () => {
    const keys = Object.keys(dialogSize);
    expect(keys).toEqual(["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]);
    for (const [k, v] of Object.entries(dialogSize)) {
      expect(v).toBe(`sm:max-w-${k}`);
    }
  });
  it("scrollableDialog limita altura y activa overflow-y", () => {
    expect(scrollableDialog).toContain("max-h-[85vh]");
    expect(scrollableDialog).toContain("overflow-y-auto");
  });
});
