import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const { fetchMock, actividad } = vi.hoisted(() => ({ fetchMock: vi.fn(), actividad: vi.fn() }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://cxp-fixture.invalid", "synthetic-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchMock },
    }),
  };
});
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: actividad }));
import { aprobarFacturaProveedor } from "../aprobacionFactura";
import { reemplazarConceptosFactura } from "../conceptosFacturaEditar";

const id = "11111111-1111-4111-8111-111111111111";
const version = "2026-10-06T00:00:00Z";
const actions = {
  aprobación: () => aprobarFacturaProveedor(id, true, "Gasto administrativo", version),
  conceptos: () => reemplazarConceptosFactura({ facturaId: id, expectedUpdatedAt: version,
    conceptos: [{ descripcion: "Servicio", cantidad: 1, importe: 100, iva: 0, ieps: 0 }] }),
};

describe("CxP CAS · transporte SDK y mutación sin reintento", () => {
  beforeEach(() => { fetchMock.mockReset(); actividad.mockReset(); });

  it.each([
    ["aprobación", "PT409", 409], ["aprobación", "40001", 500],
    ["conceptos", "PT409", 409], ["conceptos", "40001", 500],
  ] as const)("%s clasifica %s y envía un único POST", async (action, code, status) => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      code, message: "Versión obsoleta", details: null, hint: null,
    }), { status, headers: { "Content-Type": "application/json" } }));
    // Los retries de consultas no deben extenderse a las mutaciones financieras.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 2 } } });
    try {
      const mutation = qc.getMutationCache().build(qc, { mutationFn: async () => { await actions[action](); } });
      await expect(mutation.execute(undefined)).rejects.toMatchObject({
        message: expect.stringMatching(/cambió desde que la revisaste|LC_CONFLICTO_CONCURRENCIA/),
      });
      expect(mutation.state.status).toBe("error");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
      expect(actividad).not.toHaveBeenCalled();
    } finally { qc.clear(); }
  });
});
