import { describe, it, expect } from "vitest";
import { resolveLandingRoute } from "@/lib/domain/auth";

describe("resolveLandingRoute", () => {
  it("super_admin → /admin", () => {
    expect(resolveLandingRoute("super_admin")).toBe("/admin");
  });
  it("cliente → /portal", () => {
    expect(resolveLandingRoute("cliente")).toBe("/portal");
  });
  it("operador/admin/viewer → /", () => {
    expect(resolveLandingRoute("operador")).toBe("/");
    expect(resolveLandingRoute("admin")).toBe("/");
    expect(resolveLandingRoute("viewer")).toBe("/");
  });
  it("null → /", () => {
    expect(resolveLandingRoute(null)).toBe("/");
  });
});
