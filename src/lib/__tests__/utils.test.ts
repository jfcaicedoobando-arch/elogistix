import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combina clases", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("resuelve conflictos Tailwind", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
  it("filtra valores falsy", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
