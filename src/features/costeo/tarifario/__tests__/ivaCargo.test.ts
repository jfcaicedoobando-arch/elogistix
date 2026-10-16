import { describe, it, expect } from "vitest";
import { montoConIva } from "../ivaCargo";

describe("montoConIva", () => {
  it("suma 16% cuando aplica IVA", () => expect(montoConIva(100, true, 0.16)).toBe(116));
  it("no suma IVA cuando no aplica", () => expect(montoConIva(100, false, 0.16)).toBe(100));
});
