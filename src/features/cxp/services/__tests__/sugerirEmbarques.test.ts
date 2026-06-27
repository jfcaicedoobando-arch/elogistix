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
    it("propaga error de Supabase", async () => {
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
    it("propaga error", async () => {
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
    };

    it("inserta concepto y vínculo, retorna conceptoId", async () => {
      mock.setTableResult("conceptos_costo", { data: { id: "cc1" }, error: null });
      mock.setTableResult("proveedor_facturas_conceptos", { data: null, error: null });
      const r = await crearConceptoCostoYVincular(input);
      expect(r.conceptoId).toBe("cc1");
      const cc = mock.getMutationPayload("conceptos_costo", "insert") as Record<string, unknown>[] | null;
      expect(cc).toBeTruthy();
      expect(cc?.[0]).toMatchObject({
        embarque_id: "e1",
        organization_id: "org-1",
        proveedor_id: "p1",
        monto: 1000,
        moneda: "MXN",
        estado_liquidacion: "Pagado",
        referencia_pago: "F-100",
      });
      const link = mock.getMutationPayload("proveedor_facturas_conceptos", "insert") as Record<string, unknown> | null;
      expect(link).toMatchObject({
        proveedor_factura_id: "f1",
        concepto_costo_id: "cc1",
        monto: 1000,
        cantidad: 1,
      });
    });

    it("propaga error al crear concepto", async () => {
      mock.setTableResult("conceptos_costo", { data: null, error: { message: "x" } });
      await expect(crearConceptoCostoYVincular(input)).rejects.toMatchObject({ message: "x" });
    });

    it("propaga error al insertar vínculo", async () => {
      mock.setTableResult("conceptos_costo", { data: { id: "cc1" }, error: null });
      mock.setTableResult("proveedor_facturas_conceptos", { data: null, error: { message: "linkfail" } });
      await expect(crearConceptoCostoYVincular(input)).rejects.toMatchObject({ message: "linkfail" });
    });
  });
});
