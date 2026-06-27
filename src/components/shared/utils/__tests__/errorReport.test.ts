import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildErrorReport, formatReportMarkdown, formatReportJson } from "../errorReport";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

vi.mock("@/lib/auth/authSnapshot", () => ({
  getAuthSnapshot: () => ({
    userId: "u1",
    email: "u1@test.com",
    organizationId: "o1",
    organizationName: "Org 1",
    effectiveRole: "admin",
  }),
}));

describe("errorReport utility", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { userAgent: "Node" });
    vi.stubGlobal("window", {
      location: { pathname: "/test", search: "?q=1", hash: "#top" },
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 2,
    });
  });

  it("buildErrorReport: construye reporte completo", () => {
    const error = new Error("Boom");
    const report = buildErrorReport({
      error,
      title: "Custom Error",
      phase: "mount",
      method: "GET",
      context: { foo: "bar" },
    });

    expect(report.title).toBe("Custom Error");
    expect(report.errorCode).toBe(ERROR_CODES.UNKNOWN);
    expect(report.user.id).toBe("u1");
    expect(report.route).toBe("/test?q=1#top");
    expect(report.client.viewport).toBe("1024x768");
    expect(report.requestId).toMatch(/^req-|^[0-9a-f-]{36}$/);
    expect(report.context).toEqual({ foo: "bar" });
  });

  it("buildErrorReport: usa requestId y errorCode proveídos", () => {
    const report = buildErrorReport({
      error: new Error("x"),
      requestId: "fixed-id",
      errorCode: "CUSTOM_001",
    });
    expect(report.requestId).toBe("fixed-id");
    expect(report.errorCode).toBe("CUSTOM_001");
  });

  it("formatReportMarkdown y JSON", () => {
    const report = buildErrorReport({ error: new Error("x") });
    const md = formatReportMarkdown(report);
    const json = formatReportJson(report);
    expect(md).toContain("Error");
    expect(JSON.parse(json).requestId).toBe(report.requestId);
  });

  it("maneja entornos sin window/navigator", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    const report = buildErrorReport({ error: new Error("x") });
    expect(report.route).toBe("");
    expect(report.client.userAgent).toBe("");
    expect(report.client.viewport).toBe("");
  });
});
