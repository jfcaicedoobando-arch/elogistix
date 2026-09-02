import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { updateProveedor } from "../proveedoresCrud";

/**
 * Simula dos sesiones editando al mismo proveedor: la primera guarda con
 * éxito; la segunda usa un `expectedUpdatedAt` obsoleto (el registro ya
 * cambió) y debe fallar como conflicto de concurrencia en vez de pisar los
 * cambios de la primera (last-write-wins).
 */
describe("proveedor/services/proveedoresCrud · bloqueo optimista (N-06)", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
  });

  it("sesión 1: guarda ok cuando expectedUpdatedAt coincide", async () => {
    mock.setTableResult("proveedores", { data: { id: "p-1" }, error: null });

    await expect(
      updateProveedor(
        "p-1",
        { nombre: "Naviera Uno" },
        "2026-01-01T00:00:00Z",
        "org-1",
      ),
    ).resolves.toBeUndefined();

    const call = mock.tableCalls.find((c) => c.table === "proveedores");
    expect(call?.ops).toContain("update");
    expect(call?.ops.filter((o) => o === "eq")).toHaveLength(3); // id + organization_id + updated_at
  });

  it("sesión 2: expectedUpdatedAt obsoleto (0 filas) lanza LC_CONFLICTO_CONCURRENCIA", async () => {
    // La fila ya cambió (sesión 1 la actualizó): el filtro por
    // `updated_at = expectedUpdatedAt` no encuentra ninguna fila.
    mock.setTableResult("proveedores", { data: null, error: null });

    await expect(
      updateProveedor(
        "p-1",
        { nombre: "Naviera Dos" },
        "2026-01-01T00:00:00Z",
        "org-1",
      ),
    ).rejects.toThrow(/LC_CONFLICTO_CONCURRENCIA/);
  });

  it("sin expectedUpdatedAt: 0 filas lanza error genérico (no de concurrencia)", async () => {
    mock.setTableResult("proveedores", { data: null, error: null });

    await expect(
      updateProveedor("p-1", { nombre: "X" }),
    ).rejects.toThrow(/no tienes permiso o el proveedor ya no existe/);
  });
});
