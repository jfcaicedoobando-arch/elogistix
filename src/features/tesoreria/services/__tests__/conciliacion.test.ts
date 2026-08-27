import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  importarMovimientos,
  listarMovimientos,
  sugerirCandidatos,
  conciliarConPago,
  MovimientoVinculoError,
  type MovimientoBBVA,
} from "../conciliacion";


function makeMov(partial: Partial<MovimientoBBVA>): MovimientoBBVA {
  const base: MovimientoBBVA = {
    id: "m1",
    cuenta_bancaria_id: "c1",
    fecha: "2024-01-01",
    concepto: "C",
    referencia: "R",
    cargo: 0,
    abono: 0,
    saldo: 0,
    hash_dedupe: "h",
    estado_conciliacion: "Pendiente",
    pago_proveedor_id: null,
    pago_factura_id: null,
    anticipo_proveedor_id: null,
    pago_proveedor_lote_id: null,
    pago_factura_lote_id: null,
    traspaso_id: null,
    conciliado_at: null,
    conciliado_por: null,
    motivo_ignorar: "",
    importado_en: "2024-01-01T00:00:00Z",
    importado_por: null,
    deleted_at: null,
    deleted_by: null,
    organization_id: "o1",
  };
  return { ...base, ...partial };
}


describe("conciliacion service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
  });

  describe("importarMovimientos", () => {
    it("retorna ceros si no hay movimientos", async () => {
      const res = await importarMovimientos("c1", [], "u1");
      expect(res).toEqual({ total: 0, nuevos: 0, duplicados: 0 });
    });

    it("realiza upsert y cuenta nuevos", async () => {
      mock.setTableResult("bbva_movimientos", { data: [{ id: "1" }], error: null });
      const res = await importarMovimientos("c1", [{ 
        fecha: "2024-01-01", concepto: "C1", referencia: "R1", cargo: 0, abono: 100, saldo: 100, hash_dedupe: "h1" 
      }], "u1");
      expect(res.nuevos).toBe(1);
      expect(mock.tableCalls.some(c => c.table === "bbva_movimientos")).toBe(true);
    });

    it("lanza error si falla supabase", async () => {
      mock.setTableResult("bbva_movimientos", { data: null, error: new Error("db error") });
      await expect(importarMovimientos("c1", [{ 
        fecha: "2024-01-01", concepto: "C1", referencia: "R1", cargo: 0, abono: 100, saldo: 100, hash_dedupe: "h1" 
      }], "u1")).rejects.toThrow("db error");
    });
  });

  describe("listarMovimientos", () => {
    it("aplica filtros de cuenta y estado", async () => {
      mock.setTableResult("bbva_movimientos", { data: [], error: null });
      await listarMovimientos({ cuenta_bancaria_id: "c1", estado: "Pendiente" });
      const call = mock.tableCalls.find(c => c.table === "bbva_movimientos");
      expect(call?.ops).toContain("eq");
    });
  });

  describe("sugerirCandidatos", () => {
    it("retorna vacio si monto <= 0", async () => {
      const res = await sugerirCandidatos(makeMov({ cargo: 0, abono: 0 }));
      expect(res).toEqual([]);
    });

    it("busca en pagos_proveedor para cargos", async () => {
      mock.setTableResult("pagos_proveedor", { data: [], error: null });
      await sugerirCandidatos(makeMov({ cargo: 100, abono: 0, fecha: "2024-01-01" }));
      expect(mock.tableCalls.some(c => c.table === "pagos_proveedor")).toBe(true);
    });
  });

  describe("conciliarConPago", () => {
    it("escribe pago_factura_id (no pago_proveedor_id) cuando tipo=cxc", async () => {
      mock.setTableResult("bbva_movimientos", { data: [{ id: "m1" }], error: null });
      await conciliarConPago("m1", "cxc", "p1", "u1");
      const { assertUpdatePayload, assertEq, findTableCall } = await import(
        "@/test/helpers/assertMutation"
      );
      const call = findTableCall(mock, "bbva_movimientos");
      assertUpdatePayload(call, {
        pago_factura_id: "p1",
        pago_proveedor_id: null,
        estado_conciliacion: "Conciliado",
        conciliado_por: "u1",
      });
      assertEq(call, "id", "m1");
    });

    it("escribe pago_proveedor_id (no pago_factura_id) cuando tipo=cxp", async () => {
      mock.setTableResult("bbva_movimientos", { data: [{ id: "m2" }], error: null });
      await conciliarConPago("m2", "cxp", "p2", "u1");
      const { assertUpdatePayload, findTableCall } = await import(
        "@/test/helpers/assertMutation"
      );
      assertUpdatePayload(findTableCall(mock, "bbva_movimientos"), {
        pago_proveedor_id: "p2",
        pago_factura_id: null,
        estado_conciliacion: "Conciliado",
      });
    });



    it("mapea LC_MOVIMIENTO_ORG_MISMATCH del trigger a MovimientoVinculoError", async () => {
      mock.setTableResult("bbva_movimientos", {
        data: null,
        error: { code: "P0001", message: "LC_MOVIMIENTO_ORG_MISMATCH: el pago pertenece a otra organización" },
      });
      await expect(conciliarConPago("m1", "cxc", "p1", "u1")).rejects.toBeInstanceOf(MovimientoVinculoError);
    });

    it("mapea 23505 sobre uq_bbva_movimientos_pago_factura a LC_MOVIMIENTO_YA_VINCULADO", async () => {
      mock.setTableResult("bbva_movimientos", {
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "uq_bbva_movimientos_pago_factura"' },
      });
      await expect(conciliarConPago("m1", "cxc", "p1", "u1")).rejects.toMatchObject({
        code: "LC_MOVIMIENTO_YA_VINCULADO",
      });
    });

    it("mapea 23505 con status 409 (forma real de PostgREST) preservando el código de dominio", async () => {
      mock.setTableResult("bbva_movimientos", {
        data: null,
        error: {
          code: "23505",
          status: 409,
          message: 'duplicate key value violates unique constraint "uq_bbva_movimientos_pago_proveedor"',
        },
      });
      await expect(conciliarConPago("m1", "cxp", "p9", "u1")).rejects.toMatchObject({
        code: "LC_MOVIMIENTO_YA_VINCULADO",
        name: "MovimientoVinculoError",
      });
    });
  });
});