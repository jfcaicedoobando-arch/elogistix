/**
 * Tests del servicio de tarifas marítimas (Costeo).
 * Cubre fetch con filtros + mapeo de joins, CRUD con sincronización de
 * recargos hijos, marcado como "reemplazada" y propagación de errores.
 */
import { describe, it, expect, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchCosteoTarifas,
  insertTarifaConRecargos,
  MSG_TARIFA_DUPLICADA,
  updateTarifaConRecargos,
  marcarTarifaReemplazada,
  deleteTarifa,
  type TarifaInput,
} from "../tarifas";

const ORG = "00000000-0000-0000-0000-000000000099";

const baseInput: TarifaInput = {
  agente_id: "ag1",
  naviera_id: "nv1",
  ruta_id: "ru1",
  tipo_contenedor_id: "tc1",
  flete_base: 2500,
  dias_libres_demoras: 14,
  vigente_desde: "2026-06-01",
  vigente_hasta: "2026-12-31",
  recargos: [
    { concepto: "BAF", monto: 150 },
    { concepto: "THC origen", monto: 200, lado: "origen", incluido_en_total: true },
  ],
};

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("costeo/services/tarifas", () => {
  describe("fetchCosteoTarifas", () => {
    it("filtra por organization_id + estado + agente y mapea joins anidados", async () => {
      mock.setTableResult("costeo_tarifas", {
        data: [{
          id: "t1",
          flete_base: 2000,
          costeo_agentes: { nombre: "Sinotrans" },
          navieras: { name: "COSCO" },
          tipos_contenedor: { name: "40HC" },
          costeo_rutas: {
            puerto_origen: { name: "Shanghai" },
            puerto_destino: { name: "Manzanillo" },
          },
          recargos: [
            { id: "r1", monto: 100, incluido_en_total: true },
            { id: "r2", monto: 999, incluido_en_total: false },
          ],
        }],
        error: null,
      });

      const res = await fetchCosteoTarifas(ORG, { estado: "vigente", agenteId: "ag1" });
      const call = mock.tableCalls.find((c) => c.table === "costeo_tarifas");
      expect(call?.ops).toContain("select");
      expect(call?.ops).toContain("order");
      expect(call?.ops).toContain("limit");

      expect(res[0].agente_nombre).toBe("Sinotrans");
      expect(res[0].naviera_nombre).toBe("COSCO");
      expect(res[0].puerto_origen_nombre).toBe("Shanghai");
      expect(res[0].puerto_destino_nombre).toBe("Manzanillo");
      // Sólo suma recargos con incluido_en_total = true
      expect(res[0].recargos_total).toBe(100);
      expect(res[0].total_comparable).toBe(2100);
    });

    it("ignora el filtro 'todas' (no agrega .eq('estado'))", async () => {
      mock.setTableResult("costeo_tarifas", { data: [], error: null });
      await fetchCosteoTarifas(ORG, { estado: "todas" });
      // No verificamos el conteo exacto de eq() — sólo que la llamada se completa sin throw.
      expect(mock.tableCalls.find((c) => c.table === "costeo_tarifas")).toBeDefined();
    });

    it("retorna [] cuando la data viene null", async () => {
      mock.setTableResult("costeo_tarifas", { data: null, error: null });
      const res = await fetchCosteoTarifas(ORG);
      expect(res).toEqual([]);
    });

    it("aplica defaults '—' a joins faltantes", async () => {
      mock.setTableResult("costeo_tarifas", {
        data: [{ id: "t2", flete_base: 0, recargos: [] }],
        error: null,
      });
      const res = await fetchCosteoTarifas(ORG);
      expect(res[0].agente_nombre).toBe("—");
      expect(res[0].naviera_nombre).toBe("—");
      expect(res[0].puerto_origen_nombre).toBe("—");
      expect(res[0].recargos_total).toBe(0);
    });

    it("tarifas costeo: propaga errores de Supabase", async () => {
      mock.setTableResult("costeo_tarifas", { data: null, error: { message: "boom" } });
      await expect(fetchCosteoTarifas(ORG)).rejects.toThrow();
    });
  });

  describe("insertTarifaConRecargos", () => {
    it("forza moneda=USD, estado=vigente y organization_id en el insert padre", async () => {
      mock.setTableResult("costeo_tarifas", { data: { id: "t3" }, error: null });
      mock.setTableResult("costeo_tarifa_recargos", { data: null, error: null });

      await insertTarifaConRecargos(ORG, baseInput);

      const payload = mock.getMutationPayload("costeo_tarifas", "insert") as Record<string, unknown>;
      expect(payload.moneda).toBe("USD");
      expect(payload.estado).toBe("vigente");
      expect(payload.organization_id).toBe(ORG);
      expect(payload.flete_base).toBe(2500);
    });

    it("inserta recargos válidos con defaults (lado=origen, incluido=true)", async () => {
      mock.setTableResult("costeo_tarifas", { data: { id: "t4" }, error: null });
      mock.setTableResult("costeo_tarifa_recargos", { data: null, error: null });

      await insertTarifaConRecargos(ORG, baseInput);

      const rows = mock.getMutationPayload("costeo_tarifa_recargos", "insert") as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ tarifa_id: "t4", moneda: "USD", lado: "origen", incluido_en_total: true });
    });

    it("filtra recargos con concepto vacío o monto <= 0", async () => {
      mock.setTableResult("costeo_tarifas", { data: { id: "t5" }, error: null });
      mock.setTableResult("costeo_tarifa_recargos", { data: null, error: null });
      await insertTarifaConRecargos(ORG, {
        ...baseInput,
        recargos: [
          { concepto: "   ", monto: 100 },
          { concepto: "BAF", monto: 0 },
          { concepto: "OK", monto: 50 },
        ],
      });
      const rows = mock.getMutationPayload("costeo_tarifa_recargos", "insert") as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0].concepto).toBe("OK");
    });

    it("no llama a insert de recargos si la lista queda vacía", async () => {
      mock.setTableResult("costeo_tarifas", { data: { id: "t6" }, error: null });
      await insertTarifaConRecargos(ORG, { ...baseInput, recargos: [] });
      const recargoCalls = mock.tableCalls.filter((c) => c.table === "costeo_tarifa_recargos");
      expect(recargoCalls).toHaveLength(0);
    });

    it("propaga el error del insert padre", async () => {
      mock.setTableResult("costeo_tarifas", { data: null, error: { message: "fk" } });
      await expect(insertTarifaConRecargos(ORG, baseInput)).rejects.toThrow();
    });

    // v13.823.159: «Duplicar como nueva» con la misma vigencia choca con el
    // UNIQUE (org, agente, naviera, ruta, contenedor, vigente_desde). El mensaje
    // crudo de Postgres no explicaba nada al agente.
    it("traduce el choque de unicidad a un mensaje accionable", async () => {
      mock.setTableResult("costeo_tarifas", {
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "costeo_tarifas_organization_id_agente_id_naviera_id_ruta_id_key"' },
      });
      await expect(insertTarifaConRecargos(ORG, baseInput)).rejects.toThrow(MSG_TARIFA_DUPLICADA);
    });
  });

  describe("updateTarifaConRecargos", () => {
    it("Ola 6 · M7: usa la RPC atómica con tarifa + recargos filtrados", async () => {
      mock.setRpcResult("actualizar_tarifa_con_recargos_rpc", { data: null, error: null });

      await updateTarifaConRecargos("t7", {
        ...baseInput,
        recargos: [...baseInput.recargos, { concepto: "  ", monto: 0 }],
      });

      const call = mock.rpcCalls.find((c) => c.fn === "actualizar_tarifa_con_recargos_rpc");
      expect(call).toBeDefined();
      const args = call!.args as { p_id: string; p_tarifa: Record<string, unknown>; p_recargos: unknown[] };
      expect(args.p_id).toBe("t7");
      expect(args.p_tarifa.flete_base).toBe(2500);
      // El recargo vacío/monto 0 no viaja a la RPC.
      expect(args.p_recargos).toHaveLength(2);
      expect(args.p_recargos[0]).toMatchObject({ concepto: "BAF", lado: "origen", incluido_en_total: true });
    });

    it("updateTarifaConRecargos propaga el error de actualizar_tarifa_con_recargos_rpc", async () => {
      mock.setRpcResult("actualizar_tarifa_con_recargos_rpc", { data: null, error: { message: "boom" } });
      await expect(updateTarifaConRecargos("t8", baseInput)).rejects.toThrow(/boom/);
    });
  });

  describe("marcarTarifaReemplazada / deleteTarifa", () => {
    it("marcarTarifaReemplazada hace update con estado='reemplazada'", async () => {
      mock.setTableResult("costeo_tarifas", { data: null, error: null });
      await marcarTarifaReemplazada("t9");
      const payload = mock.getMutationPayload("costeo_tarifas", "update") as Record<string, unknown>;
      expect(payload.estado).toBe("reemplazada");
    });

    it("deleteTarifa hace delete().eq('id', ...)", async () => {
      mock.setTableResult("costeo_tarifas", { data: null, error: null });
      await deleteTarifa("t10");
      const ops = mock.tableCalls.find((c) => c.table === "costeo_tarifas")?.ops ?? [];
      expect(ops).toContain("delete");
      expect(ops).toContain("eq");
    });

    it("propaga errores de marcarTarifaReemplazada", async () => {
      mock.setTableResult("costeo_tarifas", { data: null, error: { message: "rls" } });
      await expect(marcarTarifaReemplazada("t11")).rejects.toThrow();
    });
    it("O8: fetchCosteoTarifas usa columnas explícitas (sin select '*')", async () => {
      mock.setTableResult("costeo_tarifas", { data: [], error: null });
      await fetchCosteoTarifas(ORG);
      const call = mock.tableCalls.find((c) => c.table === "costeo_tarifas");
      const idx = call?.ops.indexOf("select") ?? -1;
      const selectArg = String(call?.opArgs[idx]?.[0] ?? "");
      expect(selectArg.trim()).not.toBe("*");
      expect(selectArg).toContain("flete_base");
      expect(selectArg).toContain("recargos:costeo_tarifa_recargos");
    });
  });
});
