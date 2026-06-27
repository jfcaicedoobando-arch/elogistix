import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchAdminOrganizations,
  fetchOrganizationsList,
  createOrganization,
  fetchAdminOrganization,
  updateAdminOrganization,
  establecerOrganizacionActiva,
} from "@/features/admin/services/organizations";

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
});

describe("services/admin/organizations", () => {
  it("fetchAdminOrganizations devuelve filas", async () => {
    mock.setTableResult("organizations", { data: [{ id: "o1", nombre: "X" }], error: null });
    const r = await fetchAdminOrganizations();
    expect(r).toHaveLength(1);
  });

  it("fetchAdminOrganizations propaga error", async () => {
    mock.setTableResult("organizations", { data: null, error: { message: "x" } });
    await expect(fetchAdminOrganizations()).rejects.toThrow();
  });

  it("fetchAdminOrganizations ordena por nombre", async () => {
    mock.setTableResult("organizations", { data: [], error: null });
    await fetchAdminOrganizations();
    const call = mock.tableCalls[0];
    const idx = call.ops.indexOf("order");
    expect(call.opArgs[idx]).toEqual(["nombre"]);
  });

  it("fetchOrganizationsList devuelve [] cuando data null", async () => {
    mock.setTableResult("organizations", { data: null, error: null });
    expect(await fetchOrganizationsList()).toEqual([]);
  });

  it("fetchOrganizationsList propaga error", async () => {
    mock.setTableResult("organizations", { data: null, error: { message: "x" } });
    await expect(fetchOrganizationsList()).rejects.toThrow();
  });

  it("createOrganization inserta payload", async () => {
    mock.setTableResult("organizations", { data: null, error: null });
    await createOrganization({ nombre: "ACME", rfc: "AAA010101AAA" });
    const p = mock.getMutationPayload("organizations") as Record<string, unknown>;
    expect(p).toEqual({ nombre: "ACME", rfc: "AAA010101AAA" });
  });

  it("createOrganization propaga error", async () => {
    mock.setTableResult("organizations", { data: null, error: { message: "x" } });
    await expect(createOrganization({ nombre: "x", rfc: "y" })).rejects.toThrow();
  });

  it("fetchAdminOrganization devuelve fila única", async () => {
    mock.setTableResult("organizations", { data: { id: "o1", nombre: "X" }, error: null });
    const r = await fetchAdminOrganization("o1");
    expect((r as { id: string }).id).toBe("o1");
  });

  it("fetchAdminOrganization propaga error", async () => {
    mock.setTableResult("organizations", { data: null, error: { message: "x" } });
    await expect(fetchAdminOrganization("o1")).rejects.toThrow();
  });

  it("updateAdminOrganization actualiza payload", async () => {
    mock.setTableResult("organizations", { data: null, error: null });
    await updateAdminOrganization("o1", { nombre: "Y", rfc: "Z", plan: "pro" });
    const p = mock.getMutationPayload("organizations", "update") as Record<string, unknown>;
    expect(p.nombre).toBe("Y");
    expect(p.plan).toBe("pro");
  });

  it("updateAdminOrganization filtra por id", async () => {
    mock.setTableResult("organizations", { data: null, error: null });
    await updateAdminOrganization("o-123", { nombre: "y", rfc: "z", plan: "p" });
    const call = mock.tableCalls[0];
    const idx = call.ops.indexOf("eq");
    expect(call.opArgs[idx]).toEqual(["id", "o-123"]);
  });

  it("establecerOrganizacionActiva manda activo=false", async () => {
    mock.setTableResult("organizations", { data: null, error: null });
    await establecerOrganizacionActiva("o1", false);
    const p = mock.getMutationPayload("organizations", "update") as Record<string, unknown>;
    expect(p).toEqual({ activo: false });
  });

  it("establecerOrganizacionActiva propaga error", async () => {
    mock.setTableResult("organizations", { data: null, error: { message: "x" } });
    await expect(establecerOrganizacionActiva("o1", true)).rejects.toThrow();
  });
});
