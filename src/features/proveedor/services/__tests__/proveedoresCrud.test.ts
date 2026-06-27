import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { 
  fetchProveedoresPaginados, 
  fetchProveedoresLite,
  findProveedorByRfc,
  fetchProveedor,
  insertProveedor,
  updateProveedor,
  deleteProveedor
} from "../proveedoresCrud";

describe("proveedor/services/proveedoresCrud", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
  });

  describe("fetchProveedoresPaginados", () => {
    it("llama RPC proveedores_listado con parámetros mapeados", async () => {
      mock.setRpcResult("proveedores_listado", {
        data: [{
          id: "p1", nombre: "P1", total_count: 1, 
          total_operaciones: "100", monto_pendiente: "50"
        }],
        error: null
      });

      const res = await fetchProveedoresPaginados({
        search: "ABC",
        page: 0,
        pageSize: 10,
        organizationId: "org-1",
        origen: "Nacional"
      });

      expect(res.data).toHaveLength(1);
      expect(res.count).toBe(1);
      expect(res.data[0].total_operaciones).toBe(100);
      
      const rpcCall = mock.rpcCalls.find(c => c.fn === "proveedores_listado");
      expect(rpcCall?.args).toMatchObject({
        p_organization_id: "org-1",
        p_search: "ABC",
        p_origen: "Nacional"
      });
    });

    it("maneja origen='todos' y parámetros null", async () => {
      mock.setRpcResult("proveedores_listado", { data: [], error: null });
      await fetchProveedoresPaginados({
        search: "",
        page: 0,
        pageSize: 10,
        organizationId: null,
        origen: "todos"
      });
      const rpcCall = mock.rpcCalls.find(c => c.fn === "proveedores_listado");
      const args = rpcCall?.args as any;
      expect(args.p_origen).toBeUndefined();
      expect(args.p_organization_id).toBeUndefined();
      expect(args.p_search).toBeUndefined();
    });

    it("usa fallbacks para campos opcionales en el mapeo", async () => {
      mock.setRpcResult("proveedores_listado", {
        data: [{ id: "p1", nombre: "P1", total_count: "1", total_operaciones: 0, monto_pendiente: 0 }],
        error: null
      });
      const res = await fetchProveedoresPaginados({ search: "", page: 0, pageSize: 10, organizationId: null });
      expect(res.data[0].rfc).toBe("");
      expect(res.data[0].contacto).toBe("");
      expect(res.data[0].origen_proveedor).toBeNull();
      expect(res.data[0].subtipo_gasto).toBeNull();
    });

    it("lanza error si falla RPC", async () => {
      mock.setRpcResult("proveedores_listado", { data: null, error: { message: "rpc fail" } });
      await expect(fetchProveedoresPaginados({ search: "", page: 0, pageSize: 10, organizationId: null })).rejects.toThrow("rpc fail");
    });
  });

  describe("fetchProveedoresLite", () => {
    it("filtra por organization_id si se provee", async () => {
      mock.setTableResult("proveedores", { data: [], error: null });
      await fetchProveedoresLite("org-1");
      const call = mock.tableCalls.find(c => c.table === "proveedores");
      expect(call?.ops).toContain("eq");
    });

    it("no filtra por organization_id si es null", async () => {
      mock.setTableResult("proveedores", { data: [], error: null });
      await fetchProveedoresLite(null);
      const call = mock.tableCalls.find(c => c.table === "proveedores");
      expect(call?.ops).not.toContain("eq");
    });

    it("lanza error si falla fetchProveedoresLite", async () => {
      mock.setTableResult("proveedores", { data: null, error: { message: "err" } });
      await expect(fetchProveedoresLite()).rejects.toThrow("err");
    });
  });

  describe("findProveedorByRfc", () => {
    it("devuelve null si RFC está vacío", async () => {
      expect(await findProveedorByRfc("")).toBeNull();
      expect(mock.tableCalls).toHaveLength(0);
    });

    it("devuelve el proveedor si existe", async () => {
      mock.setTableResult("proveedores", { data: { id: "p1", nombre: "P1" }, error: null });
      const res = await findProveedorByRfc("rfc123");
      expect(res?.id).toBe("p1");
    });

    it("lanza error si falla findProveedorByRfc", async () => {
      mock.setTableResult("proveedores", { data: null, error: { message: "err" } });
      await expect(findProveedorByRfc("x")).rejects.toThrow("err");
    });
  });

  describe("fetchProveedor", () => {
    it("lanza error si falla fetchProveedor", async () => {
      mock.setTableResult("proveedores", { data: null, error: { message: "err" } });
      await expect(fetchProveedor("id1")).rejects.toThrow("err");
    });
  });

  describe("insertProveedor", () => {
    it("lanza error genérico si falla", async () => {
      mock.setTableResult("proveedores", { data: null, error: { message: "err" } });
      await expect(insertProveedor({ nombre: "P" } as any)).rejects.toThrow("err");
    });

    it("maneja error 23505 (duplicado)", async () => {
      mock.setTableResult("proveedores", { 
        data: null, 
        error: { code: "23505", message: "unique" } 
      });
      // Mock para findProveedorByRfcEnOrg (que hace select)
      // Como setTableResult es global, esto podría interferir si hubiera más llamadas select a proveedores
      // Pero para este test puntual funciona.
      await expect(insertProveedor({ rfc: "XAXX", organization_id: "o1" } as any)).rejects.toThrow();
    });
  });

  describe("updateProveedor", () => {
    it("lanza error si falla updateProveedor", async () => {
      mock.setTableResult("proveedores", { data: null, error: { message: "err" } });
      await expect(updateProveedor("id1", {})).rejects.toThrow("err");
    });
  });

  describe("deleteProveedor", () => {
    it("lanza error si falla deleteProveedor", async () => {
      mock.setTableResult("proveedores", { data: null, error: { message: "err" } });
      await expect(deleteProveedor("id1")).rejects.toThrow("err");
    });
  });
});
