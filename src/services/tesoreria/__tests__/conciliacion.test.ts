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
  type MovimientoBBVA,
} from "../conciliacion";

function makeMov(partial: Partial<MovimientoBBVA>): MovimientoBBVA {
  return {
    id: "m1",
    cuenta_bancaria_id: "c1",
    fecha: "2024-01-01",
    concepto: "C",
    referencia: "R",
    cargo: 0,
    abono: 0,
    saldo: 0,
    hash_dedupe: "h",
    estado: "Pendiente",
    pago_proveedor_id: null,
    pago_cliente_id: null,
    cliente_id: null,
    proveedor_id: null,
    monto_conciliado: null,
    importado_por: null,
    organization_id: "o1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ignorado_motivo: null,
    ...partial,
  } as MovimientoBBVA;
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
      const res = await sugerirCandidatos({ cargo: 0, abono: 0 } as any);
      expect(res).toEqual([]);
    });

    it("busca en pagos_proveedor para cargos", async () => {
      mock.setTableResult("pagos_proveedor", { data: [], error: null });
      await sugerirCandidatos({ cargo: 100, abono: 0, fecha: "2024-01-01" } as any);
      expect(mock.tableCalls.some(c => c.table === "pagos_proveedor")).toBe(true);
    });
  });

  describe("conciliarConPago", () => {
    it("actualiza movimiento con pago_factura_id para cxc", async () => {
      mock.setTableResult("bbva_movimientos", { data: [], error: null });
      await conciliarConPago("m1", "cxc", "p1", "u1");
      const call = mock.tableCalls.find(c => c.table === "bbva_movimientos");
      expect(call?.ops).toContain("update");
    });
  });
});
