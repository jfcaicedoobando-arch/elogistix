import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  sugerirEmbarquesParaProveedor,
  buscarEmbarquesPorTexto,
  crearConceptoCostoYVincular,
} from "../sugerirEmbarques";

describe("sugerirEmbarques service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
  });

  describe("sugerirEmbarquesParaProveedor", () => {
    it("retorna [] si falta proveedorId", async () => {
      const r = await sugerirEmbarquesParaProveedor("", "org-1");
      expect(r).toEqual([]);
    });
    it("retorna [] si falta organizationId", async () => {
      const r = await sugerirEmbarquesParaProveedor("p1", null);
      expect(r).toEqual([]);
    });
    it("invoca RPC con args y mapea data", async () => {
      const rows = [{ embarque_id: "e1", expediente: "EXP-1", cliente_nombre: "C", estado: "ETD", etd: "2026-01-01", eta: "2026-01-10", match_tipo: "directo", score: 100 }];
      mock.setRpcResult("sugerir_embarques_para_proveedor", { data: rows, error: null });
      const r = await sugerirEmbarquesParaProveedor("p1", "org-1", 5);
      expect(r).toEqual(rows);
    });
    it("[fetchEmbarques] propaga error de Supabase", async () => {
      mock.setRpcResult("sugerir_embarques_para_proveedor", { data: null, error: { message: "boom" } });
      await expect(sugerirEmbarquesParaProveedor("p1", "org-1")).rejects.toMatchObject({ message: "boom" });
    });
    it("retorna [] cuando data es null", async () => {
      mock.setRpcResult("sugerir_embarques_para_proveedor", { data: null, error: null });
      const r = await sugerirEmbarquesParaProveedor("p1", "org-1");
      expect(r).toEqual([]);
    });
  });

  describe("buscarEmbarquesPorTexto", () => {
    it("retorna [] con string vacío o espacios", async () => {
      expect(await buscarEmbarquesPorTexto("   ", "org-1")).toEqual([]);
      expect(await buscarEmbarquesPorTexto("x", null)).toEqual([]);
    });
    it("mapea filas al shape EmbarqueSugerido con match manual y score 0", async () => {
      mock.setTableResult("embarques", {
        data: [{ id: "e1", expediente: "EXP-1", cliente_nombre: "C", estado: "ETD", etd: "2026-01-01", eta: "2026-01-10", bl_master: null, bl_house: null }],
        error: null,
      });
      const r = await buscarEmbarquesPorTexto("EXP", "org-1");
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ embarque_id: "e1", match_tipo: "Búsqueda manual", score: 0 });
      const call = mock.tableCalls.find(c => c.table === "embarques");
      expect(call?.ops).toContain("or");
      expect(call?.ops).toContain("eq");
      expect(call?.ops).toContain("limit");
    });
    it("[fetchSugerencias] propaga error", async () => {
      mock.setTableResult("embarques", { data: null, error: { message: "fail" } });
      await expect(buscarEmbarquesPorTexto("x", "org-1")).rejects.toMatchObject({ message: "fail" });
    });
  });

  describe("crearConceptoCostoYVincular", () => {
    const input = {
      facturaId: "f1",
      organizationId: "org-1",
      embarqueId: "e1",
      proveedorId: "p1",
      proveedorNombre: "Acme",
      concepto: "Flete",
      monto: 1000,
      moneda: "MXN",
      folio: "F-100",
      fechaEmision: "2026-03-10",
      clientRequestId: "req-1",
    };

    it("llama la RPC atómica con los parámetros esperados y retorna conceptoId", async () => {
      mock.setRpcResult("crear_concepto_costo_y_vincular_atomico", {
        data: { concepto_id: "cc1", pfc_id: "pfc1", reintento: false },
        error: null,
      });
      const r = await crearConceptoCostoYVincular(input);
      expect(r.conceptoId).toBe("cc1");
      const call = mock.rpcCalls.find((c) => c.fn === "crear_concepto_costo_y_vincular_atomico");
      expect(call?.args).toMatchObject({
        p_factura_id: "f1",
        p_embarque_id: "e1",
        p_proveedor_id: "p1",
        p_monto: 1000,
        p_moneda: "MXN",
        p_folio: "F-100",
        p_client_request_id: "req-1",
      });
    });

    it("un reintento con el mismo client_request_id devuelve el registro ya creado sin duplicar", async () => {
      mock.setRpcResult("crear_concepto_costo_y_vincular_atomico", {
        data: { concepto_id: "cc1", pfc_id: "pfc1", reintento: false },
        error: null,
      });
      const primero = await crearConceptoCostoYVincular(input);

      mock.setRpcResult("crear_concepto_costo_y_vincular_atomico", {
        data: { concepto_id: "cc1", pfc_id: "pfc1", reintento: true },
        error: null,
      });
      const segundo = await crearConceptoCostoYVincular(input);

      expect(segundo.conceptoId).toBe(primero.conceptoId);
      const llamadas = mock.rpcCalls.filter((c) => c.fn === "crear_concepto_costo_y_vincular_atomico");
      expect(llamadas).toHaveLength(2);
    });

    it("propaga el error de Supabase de la RPC", async () => {
      mock.setRpcResult("crear_concepto_costo_y_vincular_atomico", {
        data: null,
        error: { message: "boom" },
      });
      await expect(crearConceptoCostoYVincular(input)).rejects.toMatchObject({ message: "boom" });
    });
  });
});
