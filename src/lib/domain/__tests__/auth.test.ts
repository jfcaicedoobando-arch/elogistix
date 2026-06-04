import { describe, it, expect } from "vitest";
import { resolveLandingRoute } from "@/lib/domain/auth";

describe("resolveLandingRoute", () => {
  it("super_admin → /admin", () => {
    expect(resolveLandingRoute("super_admin")).toBe("/admin");
  });
  it("cliente → /portal", () => {
    expect(resolveLandingRoute("cliente")).toBe("/portal");
  });
  it("operador/admin/viewer → /inicio", () => {
    expect(resolveLandingRoute("operador")).toBe("/inicio");
    expect(resolveLandingRoute("admin")).toBe("/inicio");
    expect(resolveLandingRoute("viewer")).toBe("/inicio");
  });
  it("null → /inicio", () => {
    expect(resolveLandingRoute(null)).toBe("/inicio");
  });
});
