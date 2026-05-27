/**
 * Tests del clasificador de casts (D16 — 11.64.0).
 * Valida las dos reglas de degradación: test files y SAFE-CAST opt-out.
 */
import { describe, it, expect } from "vitest";
import { classify, applyDowngrades, isTestFile } from "../casts";

describe("classify", () => {
  it("`as any` → CRITICAL", () => {
    expect(classify("foo as any", "any")).toBe("CRITICAL");
  });

  it("`as unknown as X` → HIGH", () => {
    expect(classify("foo as unknown as Bar", "unknown")).toBe("HIGH");
  });

  it("`as Tables<\"x\">` → MEDIUM", () => {
    expect(classify('row as Tables<"clientes">', 'Tables<"clientes">')).toBe("MEDIUM");
  });

  it("`as const` → SAFE", () => {
    expect(classify("[1,2] as const", "const")).toBe("SAFE");
  });
});

describe("isTestFile", () => {
  it("detecta __tests__/", () => {
    expect(isTestFile("src/lib/foo/__tests__/bar.ts")).toBe(true);
  });
  it("detecta .test.ts", () => {
    expect(isTestFile("src/lib/foo.test.ts")).toBe(true);
  });
  it("detecta .spec.tsx", () => {
    expect(isTestFile("src/components/A.spec.tsx")).toBe(true);
  });
  it("no marca productivo", () => {
    expect(isTestFile("src/lib/foo.ts")).toBe(false);
  });
});

describe("applyDowngrades", () => {
  it("test file: HIGH → MEDIUM", () => {
    expect(applyDowngrades("HIGH", { isTest: true, hasSafeCast: false })).toBe("MEDIUM");
  });
  it("test file: CRITICAL → MEDIUM", () => {
    expect(applyDowngrades("CRITICAL", { isTest: true, hasSafeCast: false })).toBe("MEDIUM");
  });
  it("SAFE-CAST en productivo: HIGH → LOW", () => {
    expect(applyDowngrades("HIGH", { isTest: false, hasSafeCast: true })).toBe("LOW");
  });
  it("SAFE-CAST NO degrada CRITICAL en productivo", () => {
    expect(applyDowngrades("CRITICAL", { isTest: false, hasSafeCast: true })).toBe("CRITICAL");
  });
  it("sin marcadores: respeta severidad original", () => {
    expect(applyDowngrades("HIGH", { isTest: false, hasSafeCast: false })).toBe("HIGH");
    expect(applyDowngrades("MEDIUM", { isTest: false, hasSafeCast: false })).toBe("MEDIUM");
  });
});
