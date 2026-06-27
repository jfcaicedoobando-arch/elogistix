import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  findProveedorByRfcEnOrg,
  ProveedorDuplicadoError,
  RFC_GENERICOS_SAT,
} from "../duplicadoRfc";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("findProveedorByRfcEnOrg", () => {
  it("devuelve null si rfc vacío", async () => {
    expect(await findProveedorByRfcEnOrg("", "org1")).toBeNull();
    expect(mock.tableCalls.length).toBe(0);
  });

  it("devuelve null si organizationId es null", async () => {
    expect(await findProveedorByRfcEnOrg("ABC010101XYZ", null)).toBeNull();
  });

  it("ignora RFCs genéricos SAT", async () => {
    for (const rfc of RFC_GENERICOS_SAT) {
      expect(await findProveedorByRfcEnOrg(rfc, "org1")).toBeNull();
    }
    expect(mock.tableCalls.length).toBe(0);
  });

  it("consulta tabla proveedores con eq+ilike y retorna match", async () => {
    mock.setTableResult("proveedores", { data: { id: "p1", nombre: "Acme" }, error: null });
    const r = await findProveedorByRfcEnOrg(" abc010101xyz ", "org1");
    expect(r).toEqual({ id: "p1", nombre: "Acme" });
    const call = mock.tableCalls.find(c => c.table === "proveedores");
    expect(call?.ops).toContain("eq");
    expect(call?.ops).toContain("ilike");
  });

  it("propaga errores de Supabase", async () => {
    mock.setTableResult("proveedores", { data: null, error: new Error("db") });
    await expect(findProveedorByRfcEnOrg("XYZ010101ABC", "org1")).rejects.toThrow("db");
  });
});

describe("ProveedorDuplicadoError", () => {
  it("incluye el nombre existente en el mensaje", () => {
    const err = new ProveedorDuplicadoError({ id: "p1", nombre: "Acme" }, "RFC1");
    expect(err.message).toContain("Acme");
    expect(err.name).toBe("ProveedorDuplicadoError");
  });

  it("usa el RFC cuando no hay existente", () => {
    const err = new ProveedorDuplicadoError(null, "RFC2");
    expect(err.message).toContain("RFC2");
  });
});
