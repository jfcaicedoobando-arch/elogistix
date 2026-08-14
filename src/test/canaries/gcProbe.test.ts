import { it, expect } from "vitest";
it("gc expuesto en el fork (--expose-gc)", () => {
  expect(typeof (globalThis as unknown as { gc?: unknown }).gc).toBe("function");
});
