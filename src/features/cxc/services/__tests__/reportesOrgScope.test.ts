/**
 * Contrato anti-fuga entre organizaciones (Ola 1 · C1).
 *
 * Los reportes leen RPCs `SECURITY DEFINER` que ignoran RLS, así que la
 * organización activa DEBE viajar en cada llamada. Si un refactor olvida el
 * parámetro, un administrador de plataforma vería datos de todos los clientes
 * mezclados. Estos tests fijan el contrato del lado del cliente.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// SAFE-CAST: mock genérico del cliente Supabase para inspeccionar parámetros.
const rpc = vi.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>(
  async () => ({ data: [], error: null }),
);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...(args as [])) },
}));

const { fetchCxcAging } = await import("@/features/cxc/services/cxcAging");
const { fetchCxpAging } = await import("@/features/cxp/services/cxpAging");
const { fetchLibroPagos } = await import("@/features/tesoreria/services/libroPagos");

function argsDe(): { name: string; params: Record<string, unknown> } {
  const [name, params] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
  return { name, params };
}

describe("reportes · la organización activa viaja en la RPC", () => {
  beforeEach(() => {
    rpc.mockClear();
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it("cxc_aging_clientes recibe p_org", async () => {
    await fetchCxcAging("2026-08-09", "org-a");
    const { name, params } = argsDe();
    expect(name).toBe("cxc_aging_clientes");
    expect(params.p_org).toBe("org-a");
    expect(params.p_fecha).toBe("2026-08-09");
  });

  it("cxp_aging_proveedores recibe p_org", async () => {
    await fetchCxpAging("2026-08-09", "org-b");
    const { name, params } = argsDe();
    expect(name).toBe("cxp_aging_proveedores");
    expect(params.p_org).toBe("org-b");
  });

  it("libro_pagos recibe p_org", async () => {
    rpc.mockResolvedValue({ data: { pagos: [] }, error: null });
    await fetchLibroPagos("2026-08-01", "2026-08-31", "org-c");
    const { name, params } = argsDe();
    expect(name).toBe("libro_pagos");
    expect(params.p_org).toBe("org-c");
  });

  it("sin organización activa NO se envía un valor falso (el servidor decide)", async () => {
    await fetchCxcAging("2026-08-09", null);
    expect(argsDe().params.p_org).toBeUndefined();
  });

  it("nunca se envía un p_org distinto al solicitado", async () => {
    await fetchCxpAging("2026-08-09", "org-a");
    expect(argsDe().params.p_org).not.toBe("org-b");
  });
});
