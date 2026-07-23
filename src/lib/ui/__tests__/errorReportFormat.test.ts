import { describe, it, expect } from "vitest";
import {
  fmtHeader, fmtErrorBlock, fmtContextBlock, fmtStackBlock,
} from "@/lib/ui/errorReportFormat";
import type { ErrorReport } from "@/lib/ui/errorReport";

function baseReport(over: Partial<ErrorReport> = {}): ErrorReport {
  return {
    requestId: "req-test-0001",
    errorCode: "UNKNOWN",
    title: "Error X",
    version: "1.0.0",
    timestampIso: "2026-05-25T00:00:00.000Z",
    timezone: "America/Mexico_City",
    route: "/dashboard",
    user: { id: "u1", email: "u@x.com", organizationId: "o1", organizationName: "Org", effectiveRole: "admin" },
    client: { userAgent: "UA", viewport: "1000x673", devicePixelRatio: 2 },
    errorDetails: {},
    ...over,
  };
}


describe("fmtHeader", () => {
  it("incluye todos los campos cuando vienen", () => {
    const lines = fmtHeader(baseReport({ description: "Pasó X", phase: "save", step: 3 }));
    const txt = lines.join("\n");
    expect(txt).toContain("Título: Error X");
    expect(txt).toContain("Descripción: Pasó X");
    expect(txt).toContain("Fase: save");
    expect(txt).toContain("Paso: 3");
    expect(txt).toContain("Ruta: /dashboard");
    expect(txt).toContain("u@x.com");
  });

  it("omite description/phase/step si faltan", () => {
    const txt = fmtHeader(baseReport()).join("\n");
    expect(txt).not.toContain("Descripción:");
    expect(txt).not.toContain("Fase:");
    expect(txt).not.toContain("Paso:");
  });

  it("muestra '—' cuando user/org no existen", () => {
    const txt = fmtHeader(baseReport({
      user: { id: null, email: null, organizationId: null, organizationName: null, effectiveRole: null },
    })).join("\n");
    expect(txt).toContain("Usuario: —");
  });
});

describe("fmtErrorBlock", () => {
  it("retorna [] si no hay message/code/status", () => {
    expect(fmtErrorBlock({})).toEqual([]);
  });

  it("incluye mensaje y detalles técnicos", () => {
    const out = fmtErrorBlock({ message: "boom", name: "Error", code: "42501", status: 403, details: "d", hint: "h" });
    const txt = out.join("\n");
    expect(txt).toContain("**Mensaje**");
    expect(txt).toContain("boom");
    expect(txt).toContain("name: Error");
    expect(txt).toContain("code: 42501");
    expect(txt).toContain("status: 403");
    expect(txt).toContain("details: d");
    expect(txt).toContain("hint: h");
  });

  it("muestra '(sin mensaje)' si solo viene status/code", () => {
    const out = fmtErrorBlock({ status: 500 });
    expect(out.join("\n")).toContain("(sin mensaje)");
  });
});

describe("fmtContextBlock", () => {
  it("retorna [] si context vacío/ausente", () => {
    expect(fmtContextBlock(undefined)).toEqual([]);
    expect(fmtContextBlock({})).toEqual([]);
  });

  it("serializa context como JSON en bloque markdown", () => {
    const txt = fmtContextBlock({ foo: 1 }).join("\n");
    expect(txt).toContain("**Contexto**");
    expect(txt).toContain("```json");
    expect(txt).toContain('"foo": 1');
  });
});

describe("fmtStackBlock", () => {
  it("retorna [] sin stack", () => {
    expect(fmtStackBlock(undefined)).toEqual([]);
  });

  it("envuelve stack en bloque markdown", () => {
    const txt = fmtStackBlock("at line 1").join("\n");
    expect(txt).toContain("**Stack**");
    expect(txt).toContain("at line 1");
  });
});
