/**
 * Contrato anti-fuga del Portal del Agente (index.ts).
 *
 * `fetchAgenteContext` y `fetchAgenteRutas` dependen de RPCs
 * SECURITY DEFINER que ignoran RLS: el scoping por agente/organización
 * lo garantiza el servidor filtrando por `auth.uid()`. Estos tests
 * verifican que el cliente NUNCA envía filtros manuales que un atacante
 * pudiera manipular, que se usa la RPC correcta, y el manejo de errores
 * / respuestas vacías.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const mock = createSupabaseMock();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    ...mock.supabase,
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const { fetchAgenteContext, fetchAgenteRutas, fetchAgenteEmbarques } = await import(
  "@/features/portal-agente/services/index"
);
const { supabase } = await import("@/integrations/supabase/client");

describe("portal-agente/services/index · scoping y errores", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
    // SAFE-CAST: mock parcial de auth.getSession para pruebas.
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockReset();
  });

  describe("fetchAgenteContext", () => {
    it("usa la RPC get_current_agente_context (SECURITY DEFINER, no un filtro manual)", async () => {
      (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { session: { user: { email: "agente@x.com" } } },
      });
      mock.setRpcResult("get_current_agente_context", {
        data: [
          {
            agente_id: "ag-1",
            organization_id: "org-1",
            proveedor_id: "prov-1",
            agente_nombre: "Juan",
            organizacion_nombre: "ACME",
          },
        ],
        error: null,
      });

      const ctx = await fetchAgenteContext();

      expect(mock.rpcCalls).toHaveLength(1);
      expect(mock.rpcCalls[0].fn).toBe("get_current_agente_context");
      // No debe mandarse ningún argumento adicional (el agente lo resuelve el server vía auth.uid()).
      expect(ctx.agenteId).toBe("ag-1");
      expect(ctx.organizationId).toBe("org-1");
    });

    it("lanza si no hay sesión ni email de respaldo", async () => {
      (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { session: null },
      });
      await expect(fetchAgenteContext(null)).rejects.toThrow();
    });

    it("lanza si el usuario no está vinculado a ningún agente (RPC vacía)", async () => {
      (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { session: { user: { email: "x@x.com" } } },
      });
      mock.setRpcResult("get_current_agente_context", { data: [], error: null });
      await expect(fetchAgenteContext()).rejects.toThrow(/no está vinculado/i);
    });

    it("propaga el error de Supabase sin datos de otro usuario", async () => {
      (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { session: { user: { email: "x@x.com" } } },
      });
      mock.setRpcResult("get_current_agente_context", {
        data: null,
        error: { message: "permission denied" },
      });
      await expect(fetchAgenteContext()).rejects.toThrow(/permission denied/i);
    });
  });

  describe("fetchAgenteRutas", () => {
    it("usa la RPC get_agente_rutas_v2 y mapea IDs + país/UN-LOCODE (Etapa 6)", async () => {
      mock.setRpcResult("get_agente_rutas_v2", {
        data: [
          {
            id: "r1",
            organization_id: "org-1",
            activa: true,
            puerto_origen_id: "po-1",
            puerto_destino_id: "pd-1",
            puerto_origen_nombre: "Manzanillo",
            puerto_destino_nombre: "Valencia",
            puerto_origen_code: "MXZLO",
            puerto_origen_country: "México",
            puerto_destino_code: "ESVLC",
            puerto_destino_country: "España",
          },
        ],
        error: null,
      });
      const rutas = await fetchAgenteRutas();
      expect(mock.rpcCalls.some((c) => c.fn === "get_agente_rutas_v2")).toBe(true);
      // Nunca debe volver a la v1 (sin país ni código → rutas ambiguas).
      expect(mock.rpcCalls.some((c) => c.fn === "get_agente_rutas")).toBe(false);
      expect(rutas).toHaveLength(1);
      expect(rutas[0]).toMatchObject({
        organization_id: "org-1",
        puerto_origen_id: "po-1",
        puerto_destino_id: "pd-1",
        puerto_origen_code: "MXZLO",
        puerto_origen_country: "México",
        puerto_destino_code: "ESVLC",
        puerto_destino_country: "España",
      });
    });

    it("degrada a null cuando la ruta legacy no trae país ni código", async () => {
      mock.setRpcResult("get_agente_rutas_v2", {
        data: [
          {
            id: "r2",
            organization_id: "org-1",
            activa: true,
            puerto_origen_id: null,
            puerto_destino_id: null,
            puerto_origen_nombre: null,
            puerto_destino_nombre: null,
            puerto_origen_code: null,
            puerto_origen_country: null,
            puerto_destino_code: null,
            puerto_destino_country: null,
          },
        ],
        error: null,
      });
      const [r] = await fetchAgenteRutas();
      expect(r.puerto_origen_nombre).toBeUndefined();
      expect(r.puerto_origen_code).toBeNull();
      expect(r.puerto_destino_country).toBeNull();
    });

    it("devuelve [] cuando la RPC responde data null", async () => {
      mock.setRpcResult("get_agente_rutas_v2", { data: null, error: null });
      const rutas = await fetchAgenteRutas();
      expect(rutas).toEqual([]);
    });

    it("propaga el error de Supabase al listar rutas del agente", async () => {
      mock.setRpcResult("get_agente_rutas_v2", { data: null, error: { message: "boom" } });
      await expect(fetchAgenteRutas()).rejects.toThrow(/boom/i);
    });
  });

  describe("fetchAgenteEmbarques", () => {
    it("consulta la tabla embarques sin exponer filtros manuales adicionales (RLS hace el scoping)", async () => {
      mock.setTableResult("embarques", {
        data: [
          {
            id: "e1",
            expediente: "EXP-1",
            modo: "maritimo",
            estado: "activo",
            bl_master: null,
            puerto_origen: "MX",
            puerto_destino: "US",
            etd: "2026-01-01",
            eta: "2026-01-10",
          },
        ],
        error: null,
      });
      const embarques = await fetchAgenteEmbarques();
      expect(mock.tableCalls[0].table).toBe("embarques");
      // No debe llamarse a `.eq()` con un agente_id/org arbitrario del cliente:
      // el aislamiento lo garantiza RLS server-side, no un filtro manual acá.
      expect(mock.tableCalls[0].ops).not.toContain("eq");
      expect(embarques).toHaveLength(1);
    });

    it("devuelve [] en respuesta vacía", async () => {
      mock.setTableResult("embarques", { data: null, error: null });
      const embarques = await fetchAgenteEmbarques();
      expect(embarques).toEqual([]);
    });

    it("propaga el error de Supabase al listar embarques del agente", async () => {
      mock.setTableResult("embarques", { data: null, error: { message: "denied" } });
      await expect(fetchAgenteEmbarques()).rejects.toThrow(/denied/i);
    });
  });
});
