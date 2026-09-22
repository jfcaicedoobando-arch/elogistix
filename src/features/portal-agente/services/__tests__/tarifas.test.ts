/**
 * `fetchAgenteTarifas` lee `costeo_tarifas` sin filtros manuales de
 * agente/organización desde el cliente: el aislamiento lo garantiza RLS
 * (`current_agente_id`) en el servidor. Este test fija ese contrato: si
 * un refactor futuro agrega un `.eq("agente_id", ...)` proveniente del
 * cliente (potencialmente manipulable) o elimina el filtrado de RLS
 * implícito, debe saltar a la vista.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const mock = createSupabaseMock();
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const { fetchAgenteTarifas } = await import("@/features/portal-agente/services/tarifas");

describe("portal-agente/services/tarifas · fetchAgenteTarifas", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.tableCalls.length = 0;
  });

  it("consulta costeo_tarifas confiando en RLS, sin agregar un filtro de agente/org desde el cliente", async () => {
    mock.setTableResult("costeo_tarifas", {
      data: [
        {
          id: "t1",
          ruta_id: "r1",
          naviera_id: "n1",
          tipo_contenedor_id: "c1",
          moneda: "USD",
          flete_base: "1200.50",
          vigente_desde: "2026-01-01",
          vigente_hasta: "2026-06-01",
          estado: "activa",
          estado_aprobacion: "aprobada",
          motivo_rechazo: null,
          aprobada_en: "2026-01-02",
          transit_time_dias: 12,
          dias_libres_demoras: "5",
          notas: null,
          costeo_agentes: { nombre: "Agente Uno" },
          navieras: { name: "Naviera X" },
          tipos_contenedor: { name: "40HC" },
          costeo_rutas: {
            puerto_origen: { name: "Manzanillo", code: "MXZLO", country: "México" },
            puerto_destino: { name: "LA", code: "USLAX", country: "Estados Unidos" },
          },
        },
      ],
      error: null,
    });

    const tarifas = await fetchAgenteTarifas();

    expect(mock.tableCalls[0].table).toBe("costeo_tarifas");
    // El scoping por agente lo hace RLS server-side; el cliente no debe
    // filtrar manualmente por agente_id/organization_id (sería manipulable).
    expect(mock.tableCalls[0].ops).not.toContain("eq");

    expect(tarifas).toHaveLength(1);
    expect(tarifas[0]).toMatchObject({
      id: "t1",
      flete_base: 1200.5,
      dias_libres_demoras: 5,
      agente_nombre: "Agente Uno",
      naviera_nombre: "Naviera X",
      tipo_contenedor_nombre: "40HC",
      puerto_origen_nombre: "Manzanillo",
      puerto_destino_nombre: "LA",
      // Etapa 6 — identidad global para distinguir puertos homónimos.
      puerto_origen_code: "MXZLO",
      puerto_origen_country: "México",
      puerto_destino_code: "USLAX",
      puerto_destino_country: "Estados Unidos",
    });
    const select = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("select")][0] as string;
    expect(select).toContain("puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name, code, country)");
    expect(select).toContain("puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name, code, country)");
  });

  it("usa guion largo cuando faltan relaciones anidadas", async () => {
    mock.setTableResult("costeo_tarifas", {
      data: [
        {
          id: "t2",
          ruta_id: "r2",
          naviera_id: "n2",
          tipo_contenedor_id: "c2",
          moneda: "MXN",
          flete_base: 100,
          vigente_desde: "2026-01-01",
          vigente_hasta: "2026-06-01",
          estado: "activa",
          estado_aprobacion: "pendiente",
          motivo_rechazo: null,
          aprobada_en: null,
          transit_time_dias: null,
          dias_libres_demoras: null,
          notas: null,
          costeo_agentes: null,
          navieras: null,
          tipos_contenedor: null,
          costeo_rutas: null,
        },
      ],
      error: null,
    });

    const [t] = await fetchAgenteTarifas();
    expect(t.agente_nombre).toBe("—");
    expect(t.naviera_nombre).toBe("—");
    expect(t.puerto_origen_nombre).toBe("—");
    expect(t.puerto_origen_code).toBeNull();
    expect(t.puerto_destino_country).toBeNull();
    expect(t.dias_libres_demoras).toBe(0);
  });

  it("devuelve [] cuando la respuesta viene vacía (data null)", async () => {
    mock.setTableResult("costeo_tarifas", { data: null, error: null });
    const tarifas = await fetchAgenteTarifas();
    expect(tarifas).toEqual([]);
  });

  it("propaga el error de Supabase sin exponer datos de otra organización", async () => {
    mock.setTableResult("costeo_tarifas", {
      data: null,
      error: { message: "permission denied for table costeo_tarifas" },
    });
    await expect(fetchAgenteTarifas()).rejects.toThrow(/permission denied/i);
  });
});
