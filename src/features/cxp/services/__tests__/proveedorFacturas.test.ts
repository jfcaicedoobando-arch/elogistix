import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { 
  fetchFacturasCxP, 
  fetchFacturaProveedor,
  crearFacturaProveedor, 
  existeFacturaDuplicada,
  softDeleteFacturaProveedor
} from "../proveedorFacturas";

describe("proveedorFacturas service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  describe("fetchFacturasCxP", () => {
    it("aplica filtros de proveedor, categoría y moneda", async () => {
      mock.setTableResult("proveedor_facturas", { data: [], error: null });
      await fetchFacturasCxP({
        proveedor_id: "p1",
        categoria_presupuesto_id: "c1",
        moneda: "USD",
        fecha_desde: "2024-01-01",
        fecha_hasta: "2024-12-31",
        search: "ABC"
      });
      
      const calls = mock.tableCalls.filter(c => c.table === "proveedor_facturas");
      expect(calls[0].ops).toContain("eq");
      expect(calls[0].ops).toContain("gte");
      expect(calls[0].ops).toContain("lte");
      expect(calls[0].ops).toContain("or");
    });

    it("no aplica filtros si son 'todos' o 'todas'", async () => {
      mock.setTableResult("proveedor_facturas", { data: [], error: null });
      await fetchFacturasCxP({
        proveedor_id: "todos",
        categoria_presupuesto_id: "todas",
        moneda: "todas"
      });
      const calls = mock.tableCalls.filter(c => c.table === "proveedor_facturas");
      // Solo neq, order, limit que son base
      expect(calls[0].ops).not.toContain("eq");
    });
    it("excluye facturas borradas lógicamente (deleted_at IS NULL)", async () => {
      mock.setTableResult("proveedor_facturas", { data: [], error: null });
      await fetchFacturasCxP();
      const calls = mock.tableCalls.filter(c => c.table === "proveedor_facturas");
      expect(calls[0].ops).toContain("is");
    });


    it("lanza error si falla la consulta", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: { message: "Error fetch" } });
      await expect(fetchFacturasCxP()).rejects.toThrow("Error fetch");
    });

    it("maneja data null en fetchFacturasCxP devolviendo array vacío", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: null });
      const res = await fetchFacturasCxP();
      expect(res).toEqual([]);
    });
  });

  describe("fetchFacturaProveedor", () => {
    it("devuelve la factura mapeada si existe", async () => {
      mock.setTableResult("proveedor_facturas", { data: { id: "f1", total: 100 }, error: null });
      const res = await fetchFacturaProveedor("f1");
      expect(res?.id).toBe("f1");
    });

    it("devuelve null si no existe", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: null });
      const res = await fetchFacturaProveedor("f1");
      expect(res).toBeNull();
    });

    it("lanza error si falla fetchFacturaProveedor", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: { message: "Error fetch" } });
      await expect(fetchFacturaProveedor("f1")).rejects.toThrow("Error fetch");
    });
  });

  describe("crearFacturaProveedor", () => {
    it("inserta y devuelve data", async () => {
      mock.setTableResult("proveedor_facturas", { data: { id: "f1" }, error: null });
      const res = await crearFacturaProveedor({ folio_proveedor: "X" } as any);
      expect(res.id).toBe("f1");
    });

    it("lanza error si falla crearFacturaProveedor", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: { message: "Error create" } });
      await expect(crearFacturaProveedor({} as any)).rejects.toThrow("Error create");
    });
  });

  describe("existeFacturaDuplicada", () => {
    it("devuelve true si encuentra registros", async () => {
      mock.setTableResult("proveedor_facturas", { data: [{ id: "f1" }], error: null });
      const res = await existeFacturaDuplicada("p1", "f1", "2024-01-01");
      expect(res).toBe(true);
    });

    it("devuelve false si no encuentra registros (data null o vacía)", async () => {
      mock.setTableResult("proveedor_facturas", { data: [], error: null });
      const res = await existeFacturaDuplicada("p1", "f1", "2024-01-01");
      expect(res).toBe(false);
    });

    it("aplica neq id si excluirId está presente", async () => {
      mock.setTableResult("proveedor_facturas", { data: [], error: null });
      await existeFacturaDuplicada("p1", "f1", "2024-01-01", "ex-1");
      const call = mock.tableCalls.find(c => c.table === "proveedor_facturas");
      expect(call?.ops.filter(o => o === "neq")).toHaveLength(2); // neq estado y neq id
    });

    it("devuelve false sin consultar si la fecha de emisión viene vacía (R4 P1-2)", async () => {
      mock.setTableResult("proveedor_facturas", { data: [{ id: "f1" }], error: null });
      const res = await existeFacturaDuplicada("p1", "f1", "");
      expect(res).toBe(false);
      expect(mock.tableCalls.find(c => c.table === "proveedor_facturas")).toBeUndefined();
    });

    it("lanza error si falla existeFacturaDuplicada", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: { message: "Error check" } });
      await expect(existeFacturaDuplicada("p1", "f1", "2024-01-01")).rejects.toThrow("Error check");
    });
  });


  describe("softDeleteFacturaProveedor", () => {
    it("invoca RPC soft_delete_proveedor_factura con id y userId", async () => {
      mock.setRpcResult("soft_delete_proveedor_factura", { data: null, error: null });
      await softDeleteFacturaProveedor("f1", "u1");
      const call = mock.rpcCalls.find(c => c.fn === "soft_delete_proveedor_factura");
      expect(call).toBeDefined();
      expect(call?.args).toMatchObject({ p_factura_id: "f1", p_deleted_by: "u1" });
    });

    it("lanza error si falla softDeleteFacturaProveedor", async () => {
      mock.setRpcResult("soft_delete_proveedor_factura", { data: null, error: { message: "Error delete" } });
      await expect(softDeleteFacturaProveedor("f1", "u1")).rejects.toThrow("Error delete");
    });
  });
});
