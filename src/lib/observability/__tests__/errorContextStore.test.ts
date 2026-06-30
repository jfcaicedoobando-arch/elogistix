import { describe, it, expect, beforeEach } from "vitest";
import {
  getErrorContext,
  setErrorContext,
  __resetErrorContextForTests,
} from "../errorContextStore";

beforeEach(() => __resetErrorContextForTests());

describe("errorContextStore", () => {
  it("arranca vacío con app_version poblado", () => {
    const s = getErrorContext();
    expect(s.organizationId).toBeNull();
    expect(s.route).toBeNull();
    expect(s.appVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("setErrorContext hace merge parcial", () => {
    setErrorContext({ organizationId: "org-1", route: "/embarques" });
    expect(getErrorContext().organizationId).toBe("org-1");
    expect(getErrorContext().route).toBe("/embarques");

    setErrorContext({ effectiveRole: "admin_org" });
    expect(getErrorContext().organizationId).toBe("org-1");
    expect(getErrorContext().effectiveRole).toBe("admin_org");
  });

  it("getErrorContext devuelve copia (no referencia mutable)", () => {
    const a = getErrorContext();
    a.organizationId = "mutated";
    expect(getErrorContext().organizationId).toBeNull();
  });
});
